import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AccessRule,
  ActivityLogItem,
  AdUnlockRecord,
  BannerItem,
  CommentItem,
  ContactMessage,
  CustomPage,
  EpisodeItem,
  GenreItem,
  MovieItem,
  ReportItem,
  SiteSettings,
  SubscriptionPlan,
  UserProfile,
  WatchHistoryItem,
  WatchlistItem,
} from '../types/streaming';
import {
  DEFAULT_SITE_SETTINGS,
  SEED_BANNERS,
  SEED_COMMENTS,
  SEED_EPISODES,
  SEED_GENRES,
  SEED_HYBRID_BANNERS,
  SEED_HYBRID_EPISODES,
  SEED_HYBRID_MOVIES,
  SEED_MOVIES,
  SEED_PAGES,
  SEED_PLANS,
} from '../data/seedCatalog';
import { DEFAULT_AD_SETTINGS, SEED_VAST_ADS } from '../data/seedAds';
import { isUnlockValid } from '../utils/accessControl';
import { mergeSiteSettings } from '../utils/customization';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'krushnachaware84@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'krushnachaware84@gmail.com',
  'sarikac31@gmail.com',
];

const app = initializeApp(firebaseConfig);
export const db = getFirestoreCompat();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

function getFirestoreCompat() {
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    await getDoc(doc(db, 'settings', 'site'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('the client is offline') ||
        error.message.includes('unavailable'))
    ) {
      console.warn('Firestore backend unavailable or offline; using cached/seed fallback.');
    }
    return false;
  }
}

export function isUserAdmin(profile: UserProfile | null, authUser: User | null): boolean {
  if (!authUser) return false;
  if (
    authUser.email &&
    BOOTSTRAPPED_ADMIN_EMAILS.includes(authUser.email.toLowerCase()) &&
    authUser.emailVerified
  ) {
    return true;
  }
  return profile?.role === 'admin';
}

// --- Auth & User Profile ---

export async function signInWithGooglePopup(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Google Sign-In is not yet authorized for "${host}". Add it in Firebase Console → Authentication → Settings → Authorized domains, or sign in with Email & Password.`
      );
    }
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  await sendEmailVerification(result.user).catch(() => undefined);
  return result.user;
}

export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function updateCurrentUserPassword(newPassword: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Not signed in.');
  await updatePassword(auth.currentUser, newPassword);
}

export async function deleteCurrentUserAccount(): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('Not signed in.');
  try {
    await deleteDoc(doc(db, 'users', current.uid));
  } catch {
    // Ignore if doc already absent
  }
  await deleteUser(current);
}

export async function syncUserProfileOnLogin(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const nowIso = new Date().toISOString();
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      await updateDoc(userRef, {
        lastLoginAt: nowIso,
        displayName: existing.displayName || user.displayName || 'Member',
        photoURL: existing.photoURL || user.photoURL || '',
      });
      return { ...existing, uid: user.uid, lastLoginAt: nowIso };
    }

    const isBootstrapAdmin = Boolean(
      user.email &&
        BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.toLowerCase()) &&
        user.emailVerified
    );
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Member',
      email: user.email || '',
      photoURL: user.photoURL || '',
      role: isBootstrapAdmin ? 'admin' : 'user',
      status: 'active',
      plan: isBootstrapAdmin ? 'premium' : 'free',
      subscriptionPlanId: null,
      subscriptionPlanName: null,
      planExpiresAt: null,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };
    const { uid: _omit, ...docPayload } = newProfile;
    await setDoc(userRef, docPayload);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateOwnUserProfile(
  uid: string,
  updates: { displayName?: string; photoURL?: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, string> = { lastLoginAt: new Date().toISOString() };
    if (updates.displayName !== undefined) payload.displayName = updates.displayName.slice(0, 100);
    if (updates.photoURL !== undefined) payload.photoURL = updates.photoURL.slice(0, 1000);
    await updateDoc(doc(db, 'users', uid), payload);
    if (auth.currentUser && updates.displayName) {
      await updateProfile(auth.currentUser, {
        displayName: updates.displayName,
        photoURL: updates.photoURL || auth.currentUser.photoURL,
      }).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Storage Upload Helper ---

export function uploadFileWithProgress(
  storagePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// --- Public / User Data Fetching ---

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'site'));
    if (snap.exists()) {
      return mergeSiteSettings(snap.data() as Partial<SiteSettings>);
    }
    return mergeSiteSettings(DEFAULT_SITE_SETTINGS);
  } catch {
    return mergeSiteSettings(DEFAULT_SITE_SETTINGS);
  }
}

export async function fetchPublishedPages(): Promise<CustomPage[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'pages'), where('status', '==', 'published'))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPage, 'id'>) }));
    return list.length > 0 ? list : SEED_PAGES;
  } catch {
    return SEED_PAGES;
  }
}

export async function createContactMessage(
  msg: Omit<ContactMessage, 'id' | 'status' | 'createdAt'>
): Promise<ContactMessage> {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload: Omit<ContactMessage, 'id'> = {
    name: msg.name.trim().slice(0, 100),
    email: msg.email.trim().slice(0, 200),
    subject: msg.subject.trim().slice(0, 160),
    message: msg.message.trim().slice(0, 3000),
    pageSlug: (msg.pageSlug || 'contact').slice(0, 80),
    status: 'unread',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'messages', id), payload);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `messages/${id}`);
  }
}

export async function fetchPublishedCatalog(maxCount = 60): Promise<{
  movies: MovieItem[];
  genres: GenreItem[];
  banners: BannerItem[];
  plans: SubscriptionPlan[];
  fromSeed: boolean;
}> {
  try {
    const [moviesSnap, genresSnap, bannersSnap, plansSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'movies'),
          where('status', '==', 'published'),
          limit(maxCount)
        )
      ),
      getDocs(query(collection(db, 'genres'), orderBy('order', 'asc'))),
      getDocs(query(collection(db, 'banners'), where('isActive', '==', true))),
      getDocs(query(collection(db, 'plans'), where('isActive', '==', true))),
    ]);

    const movies = moviesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MovieItem, 'id'>) }));
    const genres = genresSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GenreItem, 'id'>) }));
    const banners = bannersSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<BannerItem, 'id'>) }))
      .sort((a, b) => a.order - b.order);
    const plans = plansSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionPlan, 'id'>) }))
      .sort((a, b) => a.order - b.order);

    if (movies.length === 0) {
      return {
        movies: SEED_MOVIES,
        genres: genres.length > 0 ? genres : SEED_GENRES,
        banners: banners.length > 0 ? banners : SEED_BANNERS,
        plans: plans.length > 0 ? plans : SEED_PLANS,
        fromSeed: true,
      };
    }

    return {
      movies,
      genres: genres.length > 0 ? genres : SEED_GENRES,
      banners: banners.length > 0 ? banners : SEED_BANNERS,
      plans: plans.length > 0 ? plans : SEED_PLANS,
      fromSeed: false,
    };
  } catch {
    return {
      movies: SEED_MOVIES,
      genres: SEED_GENRES,
      banners: SEED_BANNERS,
      plans: SEED_PLANS,
      fromSeed: true,
    };
  }
}

export async function subscribeUserToPlan(
  uid: string,
  plan: SubscriptionPlan
): Promise<{ plan: 'premium'; subscriptionPlanId: string; subscriptionPlanName: string; planExpiresAt: string }> {
  const now = Date.now();
  const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    plan: 'premium' as const,
    subscriptionPlanId: plan.id,
    subscriptionPlanName: plan.name.slice(0, 100),
    planExpiresAt: expiresAt,
    lastLoginAt: new Date(now).toISOString(),
  };
  try {
    await updateDoc(doc(db, 'users', uid), payload);
    return {
      plan: 'premium',
      subscriptionPlanId: plan.id,
      subscriptionPlanName: payload.subscriptionPlanName,
      planExpiresAt: expiresAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function cancelUserSubscription(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan: 'free',
      subscriptionPlanId: null,
      subscriptionPlanName: null,
      planExpiresAt: null,
      lastLoginAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function fetchSeriesEpisodes(seriesId: string): Promise<EpisodeItem[]> {
  try {
    const allEpisodes: EpisodeItem[] = [];
    for (const seasonNum of [1, 2, 3, 4]) {
      const seasonId = `season-${seasonNum}`;
      const snap = await getDocs(
        collection(db, 'series', seriesId, 'seasons', seasonId, 'episodes')
      );
      snap.forEach((d) => {
        const data = d.data() as Omit<EpisodeItem, 'id' | 'seriesId' | 'seasonId'>;
        allEpisodes.push({
          ...data,
          id: d.id,
          seriesId,
          seasonId,
          seasonNumber: data.seasonNumber ?? seasonNum,
        });
      });
    }
    if (allEpisodes.length > 0) {
      return allEpisodes.sort(
        (a, b) => a.seasonNumber - b.seasonNumber || a.number - b.number
      );
    }
    return SEED_EPISODES[seriesId] ?? SEED_HYBRID_EPISODES[seriesId] ?? [];
  } catch {
    return SEED_EPISODES[seriesId] ?? SEED_HYBRID_EPISODES[seriesId] ?? [];
  }
}

export async function fetchUserAdUnlocks(uid: string): Promise<Record<string, AdUnlockRecord>> {
  const nowMs = Date.now();
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'adUnlocks'));
    const valid: Record<string, AdUnlockRecord> = {};
    const expiredDocIds: string[] = [];

    snap.forEach((d) => {
      const rec = d.data() as AdUnlockRecord;
      // Session-scoped unlocks are never auto-persisted across logins unless still valid
      if (rec && rec.expiresAt && isUnlockValid(rec, nowMs)) {
        valid[d.id] = rec;
      } else if (rec && rec.expiresAt && !isUnlockValid(rec, nowMs)) {
        expiredDocIds.push(d.id);
      } else if (rec && !rec.expiresAt) {
        valid[d.id] = rec;
      }
    });

    // Lazy cleanup of expired unlock records
    if (expiredDocIds.length > 0) {
      const batch = writeBatch(db);
      for (const id of expiredDocIds.slice(0, 100)) {
        batch.delete(doc(db, 'users', uid, 'adUnlocks', id));
      }
      await batch.commit().catch(() => undefined);
    }

    return valid;
  } catch {
    return {};
  }
}

export async function saveUserAdUnlock(
  uid: string,
  record: AdUnlockRecord
): Promise<void> {
  const path = `users/${uid}/adUnlocks/${record.contentId}`;
  const payload: Record<string, string | null> = {
    contentId: record.contentId.slice(0, 128),
    contentType: record.contentType,
    unlockedAt: record.unlockedAt,
    expiresAt: record.expiresAt,
    adId: (record.adId || 'rewarded').slice(0, 128),
    method: 'rewarded_ad',
  };
  if (record.seriesId) {
    payload.seriesId = record.seriesId.slice(0, 128);
  }
  try {
    await setDoc(doc(db, 'users', uid, 'adUnlocks', record.contentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserPersonalData(uid: string): Promise<{
  watchlist: WatchlistItem[];
  history: WatchHistoryItem[];
  ratings: Record<string, number>;
  likes: string[];
}> {
  try {
    const [wlSnap, histSnap, ratingsSnap, likesSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'watchlist')),
      getDocs(collection(db, 'users', uid, 'history')),
      getDocs(collection(db, 'users', uid, 'ratings')),
      getDocs(collection(db, 'users', uid, 'likes')),
    ]);

    const watchlist = wlSnap.docs.map((d) => d.data() as WatchlistItem);
    const history = histSnap.docs
      .map((d) => d.data() as WatchHistoryItem)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const ratings: Record<string, number> = {};
    ratingsSnap.forEach((d) => {
      const val = (d.data() as { value: number }).value;
      if (typeof val === 'number') ratings[d.id] = val;
    });
    const likes = likesSnap.docs.map((d) => d.id);

    return { watchlist, history, ratings, likes };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export async function toggleUserWatchlist(
  uid: string,
  movieId: string,
  add: boolean
): Promise<void> {
  const refDoc = doc(db, 'users', uid, 'watchlist', movieId);
  try {
    if (add) {
      await setDoc(refDoc, { movieId, addedAt: new Date().toISOString() });
    } else {
      await deleteDoc(refDoc);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/watchlist/${movieId}`);
  }
}

export async function saveUserWatchHistory(
  uid: string,
  entry: WatchHistoryItem
): Promise<void> {
  const refDoc = doc(db, 'users', uid, 'history', entry.movieId);
  try {
    const payload: Record<string, string | number> = {
      movieId: entry.movieId,
      progressSeconds: Math.max(0, Math.round(entry.progressSeconds)),
      durationSeconds: Math.max(0, Math.round(entry.durationSeconds)),
      updatedAt: new Date().toISOString(),
    };
    if (entry.seasonId) payload.seasonId = entry.seasonId;
    if (entry.episodeId) payload.episodeId = entry.episodeId;
    await setDoc(refDoc, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/history/${entry.movieId}`);
  }
}

export async function removeUserHistoryItem(uid: string, movieId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'history', movieId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/history/${movieId}`);
  }
}

export async function clearUserHistory(uid: string, movieIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of movieIds) {
    batch.delete(doc(db, 'users', uid, 'history', id));
  }
  await batch.commit();
}

export async function saveUserRating(
  uid: string,
  movieId: string,
  value: number
): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid, 'ratings', movieId), { value });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/ratings/${movieId}`);
  }
}

export async function toggleUserLike(
  uid: string,
  movieId: string,
  liked: boolean
): Promise<void> {
  try {
    const likeRef = doc(db, 'users', uid, 'likes', movieId);
    const movieRef = doc(db, 'movies', movieId);
    if (liked) {
      await setDoc(likeRef, { movieId, addedAt: new Date().toISOString() });
      await updateDoc(movieRef, { likesCount: increment(1) }).catch(() => undefined);
    } else {
      await deleteDoc(likeRef);
      await updateDoc(movieRef, { likesCount: increment(-1) }).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/likes/${movieId}`);
  }
}

export async function incrementMovieViews(movieId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'movies', movieId), { views: increment(1) });
  } catch {
    // Silent if movie exists only in starter seed or user is guest
  }
}

export async function fetchMovieComments(movieId: string): Promise<CommentItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'comments'),
        where('movieId', '==', movieId),
        where('isHidden', '==', false),
        limit(50)
      )
    );
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CommentItem, 'id'>),
    }));
    if (list.length === 0) {
      return SEED_COMMENTS.filter((c) => c.movieId === movieId);
    }
    return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return SEED_COMMENTS.filter((c) => c.movieId === movieId);
  }
}

export async function createComment(comment: Omit<CommentItem, 'id'>): Promise<CommentItem> {
  const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'comments', id), comment);
    return { id, ...comment };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `comments/${id}`);
  }
}

export async function deleteCommentDoc(commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
  }
}

export async function createReportDoc(
  report: Omit<ReportItem, 'id' | 'status' | 'createdAt'>
): Promise<ReportItem> {
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload: Omit<ReportItem, 'id'> = {
    ...report,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'reports', id), payload);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reports/${id}`);
  }
}

// --- Admin Data & Mutations ---

export async function logAdminAction(
  adminUid: string,
  action: string,
  targetId: string
): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'activityLogs', id), {
      adminUid,
      action: action.slice(0, 200),
      targetId: targetId.slice(0, 128),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Non-fatal audit failure
  }
}

export async function fetchAllAdminData(): Promise<{
  movies: MovieItem[];
  genres: GenreItem[];
  banners: BannerItem[];
  plans: SubscriptionPlan[];
  users: UserProfile[];
  comments: CommentItem[];
  reports: ReportItem[];
  pages: CustomPage[];
  messages: ContactMessage[];
  logs: ActivityLogItem[];
  settings: SiteSettings;
}> {
  const [
    moviesSnap,
    genresSnap,
    bannersSnap,
    plansSnap,
    usersSnap,
    commentsSnap,
    reportsSnap,
    pagesSnap,
    messagesSnap,
    logsSnap,
    settings,
  ] = await Promise.all([
    getDocs(collection(db, 'movies')),
    getDocs(query(collection(db, 'genres'), orderBy('order', 'asc'))),
    getDocs(collection(db, 'banners')),
    getDocs(collection(db, 'plans')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'comments')),
    getDocs(collection(db, 'reports')),
    getDocs(collection(db, 'pages')),
    getDocs(collection(db, 'messages')),
    getDocs(query(collection(db, 'activityLogs'), limit(100))),
    fetchSiteSettings(),
  ]);

  return {
    movies: moviesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MovieItem, 'id'>) })),
    genres: genresSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GenreItem, 'id'>) })),
    banners: bannersSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<BannerItem, 'id'>) }))
      .sort((a, b) => a.order - b.order),
    plans: plansSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionPlan, 'id'>) }))
      .sort((a, b) => a.order - b.order),
    users: usersSnap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) })),
    comments: commentsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<CommentItem, 'id'>) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    reports: reportsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ReportItem, 'id'>) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    pages: pagesSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPage, 'id'>) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    messages: messagesSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ContactMessage, 'id'>) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    logs: logsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLogItem, 'id'>) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    settings,
  };
}

export async function saveMovieDoc(
  movie: MovieItem,
  adminUid: string,
  isNew: boolean
): Promise<void> {
  const { id, ...payload } = movie;
  try {
    await setDoc(doc(db, 'movies', id), payload);
    await logAdminAction(
      adminUid,
      `${isNew ? 'Created' : 'Updated'} ${movie.type} "${movie.title}"`,
      id
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `movies/${id}`);
  }
}

export async function deleteMovieDoc(movieId: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'movies', movieId));
    await logAdminAction(adminUid, 'Deleted title', movieId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `movies/${movieId}`);
  }
}

export async function saveEpisodeDoc(
  episode: EpisodeItem,
  adminUid: string
): Promise<void> {
  const { id, seriesId, seasonId, ...rest } = episode;
  try {
    await setDoc(
      doc(db, 'series', seriesId, 'seasons', seasonId, 'episodes', id),
      rest
    );
    await logAdminAction(
      adminUid,
      `Saved S${episode.seasonNumber}E${episode.number} "${episode.title}"`,
      `${seriesId}/${id}`
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `series/${seriesId}/seasons/${seasonId}/episodes/${id}`
    );
  }
}

export async function deleteEpisodeDoc(
  seriesId: string,
  seasonId: string,
  episodeId: string,
  adminUid: string
): Promise<void> {
  try {
    await deleteDoc(
      doc(db, 'series', seriesId, 'seasons', seasonId, 'episodes', episodeId)
    );
    await logAdminAction(adminUid, 'Deleted episode', `${seriesId}/${episodeId}`);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}`
    );
  }
}

export async function saveGenreDoc(genre: GenreItem, adminUid: string): Promise<void> {
  const { id, ...payload } = genre;
  try {
    await setDoc(doc(db, 'genres', id), payload);
    await logAdminAction(adminUid, `Saved genre "${genre.name}"`, id);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `genres/${id}`);
  }
}

export async function deleteGenreDoc(genreId: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'genres', genreId));
    await logAdminAction(adminUid, 'Deleted genre', genreId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `genres/${genreId}`);
  }
}

export async function saveBannerDoc(banner: BannerItem, adminUid: string): Promise<void> {
  const { id, ...payload } = banner;
  try {
    await setDoc(doc(db, 'banners', id), payload);
    await logAdminAction(adminUid, `Saved banner for ${banner.movieId}`, id);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `banners/${id}`);
  }
}

export async function deleteBannerDoc(bannerId: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'banners', bannerId));
    await logAdminAction(adminUid, 'Deleted banner', bannerId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `banners/${bannerId}`);
  }
}

export async function updateAdminUserDoc(
  targetUid: string,
  updates: Partial<UserProfile>,
  adminUid: string
): Promise<void> {
  const { uid: _omit, ...payload } = updates;
  try {
    await updateDoc(doc(db, 'users', targetUid), payload);
    await logAdminAction(adminUid, 'Updated user profile/permissions', targetUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function deleteAdminUserDoc(targetUid: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', targetUid));
    await logAdminAction(adminUid, 'Deleted user record', targetUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${targetUid}`);
  }
}

export async function toggleCommentVisibility(
  commentId: string,
  isHidden: boolean,
  adminUid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'comments', commentId), { isHidden });
    await logAdminAction(adminUid, isHidden ? 'Hid comment' : 'Unhid comment', commentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
  }
}

export async function updateReportStatus(
  reportId: string,
  status: 'open' | 'resolved',
  adminUid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), { status });
    await logAdminAction(adminUid, `Marked report ${status}`, reportId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function saveSiteSettingsDoc(
  settings: SiteSettings,
  adminUid: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'site'), settings);
    await logAdminAction(adminUid, 'Updated site settings', 'settings/site');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/site');
  }
}

export async function savePlanDoc(
  plan: SubscriptionPlan,
  adminUid: string,
  isNew: boolean
): Promise<void> {
  const { id, ...payload } = plan;
  try {
    await setDoc(doc(db, 'plans', id), payload);
    await logAdminAction(
      adminUid,
      `${isNew ? 'Created' : 'Updated'} subscription plan "${plan.name}"`,
      id
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `plans/${id}`);
  }
}

export async function deletePlanDoc(planId: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'plans', planId));
    await logAdminAction(adminUid, 'Deleted subscription plan', planId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `plans/${planId}`);
  }
}

export async function saveCustomPageDoc(
  page: CustomPage,
  adminUid: string,
  isNew: boolean
): Promise<void> {
  const { id, ...payload } = page;
  try {
    await setDoc(doc(db, 'pages', id), payload);
    await logAdminAction(
      adminUid,
      `${isNew ? 'Created' : 'Updated'} custom page "${page.title}"`,
      id
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pages/${id}`);
  }
}

export async function deleteCustomPageDoc(pageId: string, adminUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'pages', pageId));
    await logAdminAction(adminUid, 'Deleted custom page', pageId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `pages/${pageId}`);
  }
}

export async function updateContactMessageStatus(
  messageId: string,
  status: 'unread' | 'read' | 'archived',
  adminUid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'messages', messageId), { status });
    await logAdminAction(adminUid, `Marked contact message ${status}`, messageId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `messages/${messageId}`);
  }
}

export async function deleteContactMessageDoc(
  messageId: string,
  adminUid: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'messages', messageId));
    await logAdminAction(adminUid, 'Deleted contact message', messageId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}`);
  }
}

export async function seedCatalogToFirestore(adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  for (const plan of SEED_PLANS) {
    const { id, ...payload } = plan;
    batch.set(doc(db, 'plans', id), payload);
  }
  for (const genre of SEED_GENRES) {
    const { id, ...payload } = genre;
    batch.set(doc(db, 'genres', id), payload);
  }
  for (const movie of SEED_MOVIES) {
    const { id, ...payload } = movie;
    batch.set(doc(db, 'movies', id), payload);
  }
  for (const [seriesId, eps] of Object.entries(SEED_EPISODES)) {
    for (const ep of eps) {
      const { id, seriesId: _s, seasonId, ...payload } = ep;
      batch.set(doc(db, 'series', seriesId, 'seasons', seasonId, 'episodes', id), payload);
    }
  }
  for (const banner of SEED_BANNERS) {
    const { id, ...payload } = banner;
    batch.set(doc(db, 'banners', id), payload);
  }
  for (const comment of SEED_COMMENTS) {
    const { id, ...payload } = comment;
    batch.set(doc(db, 'comments', id), payload);
  }
  for (const page of SEED_PAGES) {
    const { id, ...payload } = page;
    batch.set(doc(db, 'pages', id), payload);
  }
  batch.set(doc(db, 'settings', 'site'), DEFAULT_SITE_SETTINGS);
  await batch.commit();
  await logAdminAction(adminUid, 'Seeded initial streaming catalog, pages & plans', 'catalog');
}

export async function bulkUpdateAccessRules(params: {
  seriesId: string;
  movieAccessPatch?: AccessRule;
  seasonAccessPatch?: Record<string, AccessRule>;
  episodePatches?: {
    seasonId: string;
    episodeId: string;
    access: AccessRule;
  }[];
  adminUid: string;
  actionSummary: string;
}): Promise<void> {
  const {
    seriesId,
    movieAccessPatch,
    seasonAccessPatch,
    episodePatches = [],
    adminUid,
    actionSummary,
  } = params;

  try {
    const ops: { apply: (batch: ReturnType<typeof writeBatch>) => void }[] = [];

    if (movieAccessPatch || seasonAccessPatch) {
      const moviePatch: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (movieAccessPatch) {
        moviePatch.access = movieAccessPatch;
        moviePatch.isPremium =
          movieAccessPatch.mode === 'subscription_only' ||
          movieAccessPatch.mode === 'subscription_or_ad';
        moviePatch.requiredPlanId = movieAccessPatch.planId ?? null;
        moviePatch.requiredPlanName = movieAccessPatch.planName ?? null;
        moviePatch.requiresSignIn = Boolean(movieAccessPatch.requiresSignIn);
      }
      if (seasonAccessPatch) {
        moviePatch.seasonAccess = seasonAccessPatch;
      }
      ops.push({
        apply: (b) => b.update(doc(db, 'movies', seriesId), moviePatch),
      });
    }

    for (const ep of episodePatches) {
      ops.push({
        apply: (b) =>
          b.update(
            doc(db, 'series', seriesId, 'seasons', ep.seasonId, 'episodes', ep.episodeId),
            { access: ep.access }
          ),
      });
    }

    const CHUNK = 450;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + CHUNK)) {
        op.apply(batch);
      }
      await batch.commit();
    }

    await logAdminAction(adminUid, actionSummary, seriesId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `movies/${seriesId}`);
  }
}

export async function seedHybridAccessDemoToFirestore(adminUid: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    const cinemaPlus = SEED_PLANS.find((p) => p.id === 'plan-cinema-plus');
    if (cinemaPlus) {
      const { id, ...planPayload } = cinemaPlus;
      batch.set(doc(db, 'plans', id), planPayload, { merge: true });
    }

    for (const movie of SEED_HYBRID_MOVIES) {
      const { id, ...payload } = movie;
      batch.set(doc(db, 'movies', id), payload);
    }

    for (const [seriesId, eps] of Object.entries(SEED_HYBRID_EPISODES)) {
      for (const ep of eps) {
        const { id, seriesId: _s, seasonId, ...payload } = ep;
        batch.set(doc(db, 'series', seriesId, 'seasons', seasonId, 'episodes', id), payload);
      }
    }

    for (const banner of SEED_HYBRID_BANNERS) {
      const { id, ...payload } = banner;
      batch.set(doc(db, 'banners', id), payload);
    }

    for (const vast of SEED_VAST_ADS.slice(0, 2)) {
      const { id, ...payload } = vast;
      batch.set(doc(db, 'vastAds', id), payload, { merge: true });
    }

    batch.set(doc(db, 'adSettings', 'global'), DEFAULT_AD_SETTINGS, { merge: true });

    await batch.commit();
    await logAdminAction(
      adminUid,
      'Seeded 2-Season Hybrid Access Demo Series & Access Defaults',
      'the-amber-signal'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'movies/the-amber-signal');
  }
}
