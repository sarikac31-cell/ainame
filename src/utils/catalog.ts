import type {
  BrowseFilters,
  DashboardStats,
  MovieItem,
  ReportItem,
  SortOption,
  SubscriptionPlan,
  UserProfile,
} from '../types/streaming';
import { resolveEffectiveAccess } from './accessControl';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'untitled';
}

export function sanitizeText(input: string, maxLength = 1000): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(value));
}

export function formatRelativeTime(isoDate: string, nowMs = Date.now()): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 'just now';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export function filterMovies(movies: MovieItem[], filters: BrowseFilters, includeDrafts = false): MovieItem[] {
  return movies.filter((movie) => {
    if (!includeDrafts && movie.status !== 'published') return false;
    if (filters.type && filters.type !== 'all' && movie.type !== filters.type) return false;
    if (filters.genre && filters.genre !== 'all') {
      const target = filters.genre.toLowerCase();
      const hasGenre = movie.genres.some(
        (g) => g.toLowerCase() === target || slugify(g) === target
      );
      if (!hasGenre) return false;
    }
    if (filters.minYear && movie.releaseYear < filters.minYear) return false;
    if (filters.maxYear && movie.releaseYear > filters.maxYear) return false;
    if (filters.minRating && movie.rating < filters.minRating) return false;
    if (filters.language && filters.language !== 'all') {
      if (movie.language.toLowerCase() !== filters.language.toLowerCase()) return false;
    }

    const effective = resolveEffectiveAccess(movie);
    if (filters.access === 'free' && (effective.mode !== 'free' || effective.requiresSignIn)) {
      return false;
    }
    if (filters.access === 'signin' && !(effective.mode === 'free' && effective.requiresSignIn)) {
      return false;
    }
    if (
      filters.access === 'premium' &&
      effective.mode !== 'subscription_only' &&
      effective.mode !== 'subscription_or_ad'
    ) {
      return false;
    }
    if (
      filters.access === 'ad_unlock' &&
      effective.mode !== 'subscription_or_ad' &&
      effective.mode !== 'ad_unlock_only'
    ) {
      return false;
    }
    if (filters.access === 'ad_only' && effective.mode !== 'ad_unlock_only') {
      return false;
    }
    if (filters.access === 'sub_only' && effective.mode !== 'subscription_only') {
      return false;
    }
    return true;
  });
}

export function sortMovies(movies: MovieItem[], sortBy: SortOption): MovieItem[] {
  const copy = [...movies];
  switch (sortBy) {
    case 'rating':
      return copy.sort((a, b) => b.rating - a.rating || b.views - a.views);
    case 'views':
      return copy.sort((a, b) => b.views - a.views || b.rating - a.rating);
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'newest':
    default:
      return copy.sort(
        (a, b) =>
          b.releaseYear - a.releaseYear ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
  }
}

export function searchMovies(movies: MovieItem[], query: string, includeDrafts = false): MovieItem[] {
  const q = query.trim().toLowerCase();
  const pool = includeDrafts ? movies : movies.filter((m) => m.status === 'published');
  if (!q) return pool;

  return pool.filter((m) => {
    if (m.title.toLowerCase().includes(q)) return true;
    if (m.director.toLowerCase().includes(q)) return true;
    if (m.cast.some((actor) => actor.toLowerCase().includes(q))) return true;
    if (m.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
    if (m.genres.some((genre) => genre.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function getSimilarMovies(
  movie: MovieItem,
  allMovies: MovieItem[],
  limit = 8
): MovieItem[] {
  const targetGenres = new Set(movie.genres.map((g) => g.toLowerCase()));
  return allMovies
    .filter((m) => m.id !== movie.id && m.status === 'published')
    .map((m) => {
      const overlap = m.genres.filter((g) => targetGenres.has(g.toLowerCase())).length;
      return { movie: m, score: overlap * 10 + m.rating };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.movie);
}

export interface WatchRecommendationsResult {
  sameGenre: MovieItem[];
  fallback: MovieItem[];
  items: MovieItem[];
  matchedGenres: string[];
}

export function getWatchRecommendations(
  movie: MovieItem,
  allMovies: MovieItem[],
  limit = 12
): WatchRecommendationsResult {
  const targetGenresLower = new Set(movie.genres.map((g) => g.trim().toLowerCase()).filter(Boolean));
  const candidates = allMovies.filter((m) => m.id !== movie.id && m.status === 'published');

  const scored = candidates.map((candidate) => {
    const shared = candidate.genres.filter((g) => targetGenresLower.has(g.trim().toLowerCase()));
    const boost = candidate.isTrending ? 0.5 : 0;
    return {
      movie: candidate,
      overlapCount: shared.length,
      sharedGenres: shared,
      score: shared.length * 20 + candidate.rating + boost,
    };
  });

  const sameGenreEntries = scored
    .filter((entry) => entry.overlapCount > 0)
    .sort((a, b) => b.score - a.score || b.movie.views - a.movie.views);

  const otherEntries = scored
    .filter((entry) => entry.overlapCount === 0)
    .sort((a, b) => b.movie.rating - a.movie.rating || b.movie.views - a.movie.views);

  const sameGenre = sameGenreEntries.slice(0, limit).map((e) => e.movie);
  const remaining = Math.max(0, limit - sameGenre.length);
  const fallback = remaining > 0 ? otherEntries.slice(0, remaining).map((e) => e.movie) : [];

  const seenGenre = new Set<string>();
  const matchedGenres: string[] = [];
  for (const g of movie.genres) {
    const lower = g.trim().toLowerCase();
    if (
      sameGenreEntries.some((entry) =>
        entry.sharedGenres.some((sg) => sg.trim().toLowerCase() === lower)
      ) &&
      !seenGenre.has(lower)
    ) {
      seenGenre.add(lower);
      matchedGenres.push(g.trim());
    }
  }

  return {
    sameGenre,
    fallback,
    items: [...sameGenre, ...fallback],
    matchedGenres,
  };
}

export function canCommentRateLimit(
  lastCommentMs: number,
  nowMs = Date.now(),
  cooldownMs = 10_000
): { allowed: boolean; waitSeconds: number } {
  if (!lastCommentMs || lastCommentMs <= 0) {
    return { allowed: true, waitSeconds: 0 };
  }
  const elapsed = nowMs - lastCommentMs;
  if (elapsed >= cooldownMs) {
    return { allowed: true, waitSeconds: 0 };
  }
  return {
    allowed: false,
    waitSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
  };
}

export function validateMovieDraft(draft: Partial<MovieItem>): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = (draft.title ?? '').trim();
  const slug = (draft.slug ?? '').trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 180) errors.title = 'Title must be 180 characters or fewer.';

  if (!slug) errors.slug = 'Slug is required.';
  else if (!/^[a-z0-9-]+$/.test(slug)) errors.slug = 'Slug may only contain lowercase letters, numbers, and hyphens.';

  const year = Number(draft.releaseYear);
  if (!Number.isFinite(year) || year < 1888 || year > 2100) {
    errors.releaseYear = 'Enter a valid release year (1888–2100).';
  }

  const duration = Number(draft.duration);
  if (!Number.isFinite(duration) || duration < 1 || duration > 1500) {
    errors.duration = 'Duration must be between 1 and 1500 minutes.';
  }

  const rating = Number(draft.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    errors.rating = 'Rating must be between 0 and 10.';
  }

  if (!draft.description || draft.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  }

  if (!draft.genres || draft.genres.length === 0) {
    errors.genres = 'Select at least one genre.';
  }

  return errors;
}

export function exportUsersToCsv(users: UserProfile[]): string {
  const headers = ['UID', 'Name', 'Email', 'Role', 'Status', 'Plan', 'Plan Expires', 'Created At', 'Last Login'];
  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = users.map((u) =>
    [
      u.uid,
      u.displayName,
      u.email,
      u.role,
      u.status,
      u.plan,
      u.planExpiresAt ?? '',
      u.createdAt,
      u.lastLoginAt,
    ]
      .map(escapeCell)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function formatMonthlyPrice(pricePerMonth: number, currency = 'USD'): string {
  const safePrice = Number.isFinite(pricePerMonth) && pricePerMonth >= 0 ? pricePerMonth : 0;
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: safePrice % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(safePrice);
    return `${formatted}/mo`;
  } catch {
    return `${currency.toUpperCase()} ${safePrice.toFixed(2)}/mo`;
  }
}

export interface VideoAccessResult {
  allowed: boolean;
  reason?: 'sign_in_required' | 'auth_required' | 'plan_required' | 'expired';
  requiredPlan?: SubscriptionPlan;
  requiredPlanName?: string;
}

export function canUserWatchMovie(
  movie: MovieItem,
  user: UserProfile | null,
  plans: SubscriptionPlan[] = [],
  nowMs = Date.now()
): VideoAccessResult {
  if (user?.role === 'admin') {
    return { allowed: true };
  }

  const requiredPlan = movie.requiredPlanId
    ? plans.find((p) => p.id === movie.requiredPlanId)
    : undefined;
  const requiredPlanName =
    requiredPlan?.name ?? movie.requiredPlanName ?? 'Monthly Subscription';
  const isPlanGated = Boolean(movie.requiredPlanId) || movie.isPremium;
  const isSignInGated = Boolean(movie.requiresSignIn);

  if (!isPlanGated && !isSignInGated) {
    return { allowed: true };
  }

  if (!user) {
    if (isPlanGated) {
      return {
        allowed: false,
        reason: 'auth_required',
        requiredPlan,
        requiredPlanName,
      };
    }
    return {
      allowed: false,
      reason: 'sign_in_required',
    };
  }

  // Free video that only required signing in
  if (!isPlanGated) {
    return { allowed: true };
  }

  const expiresMs = user.planExpiresAt ? Date.parse(user.planExpiresAt) : NaN;
  if (user.planExpiresAt && !Number.isNaN(expiresMs) && expiresMs < nowMs) {
    return {
      allowed: false,
      reason: 'expired',
      requiredPlan,
      requiredPlanName,
    };
  }

  if (movie.requiredPlanId) {
    if (user.plan === 'premium' && user.subscriptionPlanId === movie.requiredPlanId) {
      return { allowed: true, requiredPlan, requiredPlanName };
    }
    return {
      allowed: false,
      reason: 'plan_required',
      requiredPlan,
      requiredPlanName,
    };
  }

  if (user.plan === 'premium' || Boolean(user.subscriptionPlanId)) {
    return { allowed: true, requiredPlan, requiredPlanName };
  }

  return {
    allowed: false,
    reason: 'plan_required',
    requiredPlan,
    requiredPlanName,
  };
}

export function validateSubscriptionPlanDraft(
  draft: Partial<SubscriptionPlan>
): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = (draft.name ?? '').trim();
  const slug = (draft.slug ?? '').trim();
  const price = Number(draft.pricePerMonth);
  const currency = (draft.currency ?? '').trim();

  if (!name) errors.name = 'Plan name is required.';
  else if (name.length > 80) errors.name = 'Plan name must be 80 characters or fewer.';

  if (!slug) errors.slug = 'Plan slug is required.';
  else if (!/^[a-z0-9-]+$/.test(slug)) errors.slug = 'Slug must use lowercase letters, numbers, and hyphens.';

  if (!Number.isFinite(price) || price < 0 || price > 10000) {
    errors.pricePerMonth = 'Enter a monthly price between 0 and 10,000.';
  }

  if (!currency || currency.length > 10) {
    errors.currency = 'Enter a valid currency code (e.g. USD).';
  }

  return errors;
}

export function calculateDashboardStats(
  movies: MovieItem[],
  users: UserProfile[],
  reports: ReportItem[],
  nowMs = Date.now()
): DashboardStats {
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  return {
    totalMovies: movies.filter((m) => m.type === 'movie').length,
    totalSeries: movies.filter((m) => m.type === 'series').length,
    totalUsers: users.length,
    premiumUsers: users.filter((u) => u.plan === 'premium').length,
    totalViews: movies.reduce((acc, m) => acc + (m.views || 0), 0),
    openReports: reports.filter((r) => r.status === 'open').length,
    newUsersLast7Days: users.filter((u) => Date.parse(u.createdAt) >= sevenDaysAgo).length,
  };
}
