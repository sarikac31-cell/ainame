import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import {
  DEFAULT_AD_SETTINGS,
  DEFAULT_UNLOCK_SETTINGS,
  SEED_CUSTOM_ADS,
  SEED_VAST_ADS,
} from '../data/seedAds';
import type {
  AccessEventItem,
  AdEventItem,
  AdGlobalSettings,
  CustomAdItem,
  VastAdItem,
} from '../types/streaming';
import { db, logAdminAction, OperationType, handleFirestoreError, storage } from './firebase';

const ADS_CACHE_KEY = 'kv_ads_bundle_v1';
const ADS_CACHE_TTL_MS = 5 * 60 * 1000;
const DAILY_CAPS_KEY = 'kv_daily_ad_caps_v1';

interface CachedAdsBundle {
  fetchedAt: number;
  customAds: CustomAdItem[];
  vastAds: VastAdItem[];
  adSettings: AdGlobalSettings;
}

let memoryAdsBundle: CachedAdsBundle | null = null;

export function clearAdsBundleCache(): void {
  memoryAdsBundle = null;
  try {
    sessionStorage.removeItem(ADS_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getDailyImpressionCounts(): Record<string, number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(DAILY_CAPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { date?: string; counts?: Record<string, number> };
    if (parsed.date !== today) return {};
    return parsed.counts || {};
  } catch {
    return {};
  }
}

export function incrementLocalDailyImpression(adId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const current = getDailyImpressionCounts();
  const next = { ...current, [adId]: (current[adId] ?? 0) + 1 };
  try {
    localStorage.setItem(DAILY_CAPS_KEY, JSON.stringify({ date: today, counts: next }));
  } catch {
    // Ignore storage failures
  }
}

export async function fetchAdSettings(): Promise<AdGlobalSettings> {
  try {
    const snap = await getDoc(doc(db, 'adSettings', 'global'));
    if (snap.exists()) {
      const data = snap.data() as Partial<AdGlobalSettings>;
      return {
        ...DEFAULT_AD_SETTINGS,
        ...data,
        unlockSettings: {
          ...DEFAULT_UNLOCK_SETTINGS,
          ...(data.unlockSettings || {}),
        },
      };
    }
    return DEFAULT_AD_SETTINGS;
  } catch {
    return DEFAULT_AD_SETTINGS;
  }
}

export async function saveAdSettings(
  settings: AdGlobalSettings,
  adminUid: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'adSettings', 'global'), settings);
    clearAdsBundleCache();
    await logAdminAction(adminUid, 'Updated global Ad Settings', 'adSettings/global');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'adSettings/global');
  }
}

/**
 * Loads active ads + global adSettings for the user portal in a single filtered batch,
 * cached in memory & sessionStorage for 5 minutes.
 */
export async function loadAds(): Promise<{
  customAds: CustomAdItem[];
  vastAds: VastAdItem[];
  adSettings: AdGlobalSettings;
}> {
  const now = Date.now();
  if (memoryAdsBundle && now - memoryAdsBundle.fetchedAt < ADS_CACHE_TTL_MS) {
    return {
      customAds: memoryAdsBundle.customAds,
      vastAds: memoryAdsBundle.vastAds,
      adSettings: memoryAdsBundle.adSettings,
    };
  }
  try {
    const raw = sessionStorage.getItem(ADS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedAdsBundle;
      if (now - parsed.fetchedAt < ADS_CACHE_TTL_MS) {
        memoryAdsBundle = parsed;
        return {
          customAds: parsed.customAds,
          vastAds: parsed.vastAds,
          adSettings: parsed.adSettings,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }

  try {
    const todayIso = new Date(now - 86400_000).toISOString().slice(0, 10);
    const [customSnap, vastSnap, adSettings] = await Promise.all([
      getDocs(
        query(
          collection(db, 'customAds'),
          where('status', '==', 'active'),
          where('endDate', '>=', todayIso)
        )
      ),
      getDocs(
        query(
          collection(db, 'vastAds'),
          where('status', '==', 'active'),
          where('endDate', '>=', todayIso)
        )
      ),
      fetchAdSettings(),
    ]);

    const customAds = customSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CustomAdItem, 'id'>),
    }));
    const vastAds = vastSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<VastAdItem, 'id'>),
    }));

    // If database has no ads stored yet, check if collection is completely empty before falling back to seed
    let resolvedCustom = customAds;
    let resolvedVast = vastAds;
    if (customAds.length === 0 && vastAds.length === 0) {
      const [anyCustom, anyVast] = await Promise.all([
        getDocs(query(collection(db, 'customAds'), limit(1))),
        getDocs(query(collection(db, 'vastAds'), limit(1))),
      ]);
      if (anyCustom.empty) resolvedCustom = SEED_CUSTOM_ADS;
      if (anyVast.empty) resolvedVast = SEED_VAST_ADS;
    }

    const bundle: CachedAdsBundle = {
      fetchedAt: now,
      customAds: resolvedCustom,
      vastAds: resolvedVast,
      adSettings,
    };
    memoryAdsBundle = bundle;
    try {
      sessionStorage.setItem(ADS_CACHE_KEY, JSON.stringify(bundle));
    } catch {}
    return {
      customAds: bundle.customAds,
      vastAds: bundle.vastAds,
      adSettings: bundle.adSettings,
    };
  } catch {
    return {
      customAds: SEED_CUSTOM_ADS,
      vastAds: SEED_VAST_ADS,
      adSettings: DEFAULT_AD_SETTINGS,
    };
  }
}

export async function fetchAllAdsAdminData(): Promise<{
  customAds: CustomAdItem[];
  vastAds: VastAdItem[];
  adEvents: AdEventItem[];
  adSettings: AdGlobalSettings;
}> {
  const [customSnap, vastSnap, eventsSnap, adSettings] = await Promise.all([
    getDocs(collection(db, 'customAds')),
    getDocs(collection(db, 'vastAds')),
    getDocs(query(collection(db, 'adEvents'), limit(300))),
    fetchAdSettings(),
  ]);

  const customAds = customSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CustomAdItem, 'id'>) }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const vastAds = vastSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<VastAdItem, 'id'>) }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const adEvents = eventsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdEventItem, 'id'>) }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return { customAds, vastAds, adEvents, adSettings };
}

export async function saveCustomAdDoc(
  ad: CustomAdItem,
  adminUid: string,
  isNew: boolean
): Promise<void> {
  const { id, ...payload } = ad;
  try {
    await setDoc(doc(db, 'customAds', id), payload);
    clearAdsBundleCache();
    await logAdminAction(
      adminUid,
      `${isNew ? 'Created' : 'Updated'} custom ad "${ad.name}"`,
      `customAds/${id}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customAds/${id}`);
  }
}

export async function deleteCustomAdDoc(
  ad: CustomAdItem,
  adminUid: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customAds', ad.id));
    if (ad.imageUrl && ad.imageUrl.includes('firebasestorage.googleapis.com')) {
      try {
        await deleteObject(ref(storage, ad.imageUrl));
      } catch {
        // Ignore if file already missing
      }
    }
    if (ad.mobileImageUrl && ad.mobileImageUrl.includes('firebasestorage.googleapis.com')) {
      try {
        await deleteObject(ref(storage, ad.mobileImageUrl));
      } catch {
        // Ignore
      }
    }
    clearAdsBundleCache();
    await logAdminAction(adminUid, `Deleted custom ad "${ad.name}"`, `customAds/${ad.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customAds/${ad.id}`);
  }
}

export async function saveVastAdDoc(
  ad: VastAdItem,
  adminUid: string,
  isNew: boolean
): Promise<void> {
  const { id, ...payload } = ad;
  try {
    await setDoc(doc(db, 'vastAds', id), payload);
    clearAdsBundleCache();
    await logAdminAction(
      adminUid,
      `${isNew ? 'Created' : 'Updated'} VAST ad "${ad.name}"`,
      `vastAds/${id}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vastAds/${id}`);
  }
}

export async function deleteVastAdDoc(
  ad: VastAdItem,
  adminUid: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'vastAds', ad.id));
    clearAdsBundleCache();
    await logAdminAction(adminUid, `Deleted VAST ad "${ad.name}"`, `vastAds/${ad.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vastAds/${ad.id}`);
  }
}

export async function seedSampleAdsToFirestore(adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  for (const ad of SEED_CUSTOM_ADS) {
    const { id, ...payload } = ad;
    batch.set(doc(db, 'customAds', id), payload);
  }
  for (const ad of SEED_VAST_ADS) {
    const { id, ...payload } = ad;
    batch.set(doc(db, 'vastAds', id), payload);
  }
  batch.set(doc(db, 'adSettings', 'global'), DEFAULT_AD_SETTINGS);
  await batch.commit();
  clearAdsBundleCache();
  await logAdminAction(adminUid, 'Seeded sample Custom & VAST Ads to Firestore', 'advertising');
}

// --- Batch AdEvent Queue + Counter Sync ---

let pendingEventQueue: Omit<AdEventItem, 'id'>[] = [];
let flushTimer: number | null = null;

export function trackAdEvent(
  input: Omit<AdEventItem, 'id' | 'createdAt'>,
  testMode = false
): void {
  if (testMode) return;
  if (input.event === 'impression') {
    incrementLocalDailyImpression(input.adId);
  }
  pendingEventQueue.push({
    ...input,
    createdAt: new Date().toISOString(),
  });
  if (pendingEventQueue.length >= 5) {
    void flushAdEvents();
  } else if (flushTimer === null && typeof window !== 'undefined') {
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void flushAdEvents();
    }, 2500);
  }
}

export async function flushAdEvents(): Promise<void> {
  if (pendingEventQueue.length === 0) return;
  const events = pendingEventQueue.splice(0, 20);
  const batch = writeBatch(db);
  const counterDeltas: Record<string, { kind: 'custom' | 'vast'; field: string; inc: number }> = {};

  for (const ev of events) {
    const id = `adev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    batch.set(doc(db, 'adEvents', id), ev);

    const fieldMap: Record<AdEventItem['event'], string> = {
      impression: 'impressions',
      click: 'clicks',
      complete: 'completions',
      skip: 'skips',
      error: 'errors',
    };
    const field = fieldMap[ev.event];
    const key = `${ev.adKind}:${ev.adId}:${field}`;
    if (!counterDeltas[key]) {
      counterDeltas[key] = { kind: ev.adKind, field, inc: 0 };
    }
    counterDeltas[key].inc += 1;
  }

  try {
    await batch.commit();
    await Promise.all(
      Object.entries(counterDeltas).map(([k, delta]) => {
        const [, adId] = k.split(':');
        const colName = delta.kind === 'custom' ? 'customAds' : 'vastAds';
        return updateDoc(doc(db, colName, adId), {
          [delta.field]: increment(delta.inc),
        }).catch(() => undefined);
      })
    );
  } catch {
    // Silent non-blocking analytics failure when running offline/on seed ads
  }
}

// --- Access Gate & Ad-Unlock Funnel Events ---

let pendingAccessQueue: Omit<AccessEventItem, 'id'>[] = [];
let accessFlushTimer: number | null = null;

export function trackAccessEvent(
  input: Omit<AccessEventItem, 'id' | 'createdAt'>,
  testMode = false
): void {
  if (testMode) return;
  pendingAccessQueue.push({
    ...input,
    createdAt: new Date().toISOString(),
  });
  if (pendingAccessQueue.length >= 4) {
    void flushAccessEvents();
  } else if (accessFlushTimer === null && typeof window !== 'undefined') {
    accessFlushTimer = window.setTimeout(() => {
      accessFlushTimer = null;
      void flushAccessEvents();
    }, 2000);
  }
}

export async function flushAccessEvents(): Promise<void> {
  if (pendingAccessQueue.length === 0) return;
  const events = pendingAccessQueue.splice(0, 20);
  const batch = writeBatch(db);
  for (const ev of events) {
    const id = `acev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cleanPayload: Record<string, string> = {
      event: ev.event,
      contentId: ev.contentId.slice(0, 128),
      contentType: ev.contentType,
      uid: (ev.uid || 'guest').slice(0, 128),
      device: ev.device,
      createdAt: ev.createdAt,
    };
    if (ev.seriesId) cleanPayload.seriesId = ev.seriesId.slice(0, 128);
    if (ev.adId) cleanPayload.adId = ev.adId.slice(0, 128);
    batch.set(doc(db, 'accessEvents', id), cleanPayload);
  }
  try {
    await batch.commit();
  } catch {
    // Non-blocking funnel telemetry
  }
}

export async function fetchAccessEvents(): Promise<AccessEventItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'accessEvents'), limit(500)));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AccessEventItem, 'id'>) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

