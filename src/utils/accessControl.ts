import type {
  AccessMode,
  AccessRule,
  AdDevice,
  AdGlobalSettings,
  AdUnlockRecord,
  AdUnlockSettings,
  EpisodeItem,
  MovieItem,
  SubscriptionPlan,
  UserProfile,
  VastAdItem,
} from '../types/streaming';
import { DEFAULT_UNLOCK_SETTINGS } from '../data/seedAds';
import {
  computeAdStatus,
  matchesAdAudience,
  matchesTargetContent,
  pickWeightedAd,
} from './adEngine';
import { formatMonthlyPrice } from './catalog';

const GUEST_UNLOCKS_KEY = 'kv_guest_ad_unlocks_v1';
const RATE_LIMIT_KEY = 'kv_ad_unlock_rate_v1';

export interface EffectiveAccessRule {
  mode: Exclude<AccessMode, 'inherit'>;
  planId: string | null;
  planName: string | null;
  requiresSignIn: boolean;
  adUnlockAllowed: boolean;
  adsRequired: number;
  adSource: 'any_vast' | 'specific_ad_ids';
  adIds: string[];
  unlockValidityHours: number | null;
  unlockValidityMode: 'episode_hours' | 'session' | null;
  inheritedFrom: 'episode' | 'season' | 'title' | 'legacy';
}

export interface WatchGateEvaluation {
  allowed: boolean;
  reason:
    | 'free'
    | 'admin_bypass'
    | 'subscribed'
    | 'ad_unlocked'
    | 'allow_once_fallback'
    | 'sign_in_required'
    | 'plan_required'
    | 'ad_unlock_or_plan'
    | 'ad_unlock_only'
    | 'expired_unlock';
  mode: Exclude<AccessMode, 'inherit'>;
  effectiveRule: EffectiveAccessRule;
  requiredPlan?: SubscriptionPlan;
  planName: string;
  priceText: string;
  canSubscribe: boolean;
  canWatchAd: boolean;
  requiresSignInFirst: boolean;
  adsRequired: number;
  adIds: string[];
  unlockRecord?: AdUnlockRecord;
  unlockExpired?: boolean;
  expiresAt?: string | null;
  expiresInText?: string;
  rateLimited: boolean;
  remainingHourlyUnlocks: number;
  copy: {
    gateTitle: string;
    gateDescription: string;
    lockHeading: string;
    lockSubline: string;
    watchAdLabel: string;
    watchAdSubline: string;
    subscribeLabel: string;
    subscribersNote: string;
  };
}

export function getUnlockSettings(adSettings?: AdGlobalSettings | null): AdUnlockSettings {
  return {
    ...DEFAULT_UNLOCK_SETTINGS,
    ...(adSettings?.unlockSettings || {}),
  };
}

export function normalizeLegacyAccessRule(movie: MovieItem): EffectiveAccessRule {
  const isPlanGated = Boolean(movie.requiredPlanId) || movie.isPremium;
  const isSignInGated = Boolean(movie.requiresSignIn);
  if (isPlanGated) {
    return {
      mode: 'subscription_only',
      planId: movie.requiredPlanId ?? null,
      planName: movie.requiredPlanName ?? 'Cinema Plus',
      requiresSignIn: true,
      adUnlockAllowed: false,
      adsRequired: 1,
      adSource: 'any_vast',
      adIds: [],
      unlockValidityHours: null,
      unlockValidityMode: null,
      inheritedFrom: 'legacy',
    };
  }
  return {
    mode: 'free',
    planId: null,
    planName: null,
    requiresSignIn: isSignInGated,
    adUnlockAllowed: false,
    adsRequired: 1,
    adSource: 'any_vast',
    adIds: [],
    unlockValidityHours: null,
    unlockValidityMode: null,
    inheritedFrom: 'legacy',
  };
}

function fromExplicitRule(
  rule: AccessRule,
  inheritedFrom: EffectiveAccessRule['inheritedFrom'],
  fallbackPlanId?: string | null,
  fallbackPlanName?: string | null
): EffectiveAccessRule {
  const mode = rule.mode === 'inherit' ? 'free' : rule.mode;
  const adUnlockAllowed =
    mode === 'ad_unlock_only' ||
    mode === 'subscription_or_ad' ||
    Boolean(rule.adUnlockAllowed && mode !== 'subscription_only' && mode !== 'free');
  const planId =
    mode === 'subscription_only' || mode === 'subscription_or_ad'
      ? rule.planId ?? fallbackPlanId ?? null
      : null;
  const planName =
    mode === 'subscription_only' || mode === 'subscription_or_ad'
      ? rule.planName ?? fallbackPlanName ?? 'Cinema Plus'
      : null;

  return {
    mode,
    planId,
    planName,
    requiresSignIn:
      mode === 'subscription_only'
        ? true
        : Boolean(rule.requiresSignIn),
    adUnlockAllowed,
    adsRequired: Math.min(3, Math.max(1, Number(rule.adsRequired || 1))),
    adSource: rule.adSource === 'specific_ad_ids' ? 'specific_ad_ids' : 'any_vast',
    adIds: Array.isArray(rule.adIds) ? rule.adIds.filter(Boolean) : [],
    unlockValidityHours:
      typeof rule.unlockValidityHours === 'number' && rule.unlockValidityHours > 0
        ? rule.unlockValidityHours
        : null,
    unlockValidityMode: rule.unlockValidityMode ?? null,
    inheritedFrom,
  };
}

/**
 * Hierarchical access resolution:
 * Episode (explicit != 'inherit') -> Season (`seasonAccess[season-${ep.seasonNumber}]`)
 * -> Series / Movie (`movie.access`) -> Legacy (`isPremium`, `requiredPlanId`, `requiresSignIn`).
 */
export function resolveEffectiveAccess(
  movie: MovieItem,
  episode?: EpisodeItem | null
): EffectiveAccessRule {
  const titleRule = movie.access;
  const fallbackPlanId = titleRule?.planId ?? movie.requiredPlanId ?? null;
  const fallbackPlanName = titleRule?.planName ?? movie.requiredPlanName ?? 'Cinema Plus';

  if (episode) {
    if (episode.access && episode.access.mode !== 'inherit') {
      return fromExplicitRule(episode.access, 'episode', fallbackPlanId, fallbackPlanName);
    }
    const seasonKey = `season-${episode.seasonNumber}`;
    const seasonRule = movie.seasonAccess?.[seasonKey];
    if (seasonRule && seasonRule.mode !== 'inherit') {
      return fromExplicitRule(seasonRule, 'season', fallbackPlanId, fallbackPlanName);
    }
  }

  if (titleRule && titleRule.mode !== 'inherit') {
    return fromExplicitRule(titleRule, 'title', fallbackPlanId, fallbackPlanName);
  }

  return normalizeLegacyAccessRule(movie);
}

export function isUnlockValid(record: AdUnlockRecord | undefined, nowMs = Date.now()): boolean {
  if (!record) return false;
  if (record.expiresAt === null || record.expiresAt === undefined || record.expiresAt === '') {
    // Session-scoped unlock: valid for current browser session
    return true;
  }
  const expMs = Date.parse(record.expiresAt);
  if (Number.isNaN(expMs)) return false;
  return expMs > nowMs;
}

export function formatRemainingDuration(expiresAt: string | null | undefined, nowMs = Date.now()): string {
  if (!expiresAt) return 'this browser session';
  const diffMs = Date.parse(expiresAt) - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'expired';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin < 60) return `${totalMin}m remaining`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hrs}h ${mins}m remaining` : `${hrs}h remaining`;
}

export function computeUnlockExpiration(
  rule: EffectiveAccessRule,
  unlockSettings: AdUnlockSettings,
  nowMs = Date.now()
): string | null {
  const mode = rule.unlockValidityMode ?? unlockSettings.unlockValidityMode;
  if (mode === 'session') return null;
  const hours = Math.max(
    1,
    Number(rule.unlockValidityHours ?? unlockSettings.unlockValidityHours ?? 24)
  );
  return new Date(nowMs + hours * 3600_000).toISOString();
}

export function formatGateTemplate(
  template: string,
  vars: {
    plan: string;
    price: string;
    title: string;
    episode?: string;
    ads: number;
  }
): string {
  return (template || '')
    .replace(/\{plan\}/gi, vars.plan)
    .replace(/\{price\}/gi, vars.price)
    .replace(/\{title\}/gi, vars.title)
    .replace(/\{episode\}/gi, vars.episode || vars.title)
    .replace(/\{ads\}/gi, String(vars.ads));
}

// --- Guest Storage & Hourly Rate Limiting ---

export function loadGuestAdUnlocks(nowMs = Date.now()): Record<string, AdUnlockRecord> {
  const merged: Record<string, AdUnlockRecord> = {};
  const readFrom = (storage: Storage) => {
    try {
      const raw = storage.getItem(GUEST_UNLOCKS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, AdUnlockRecord>;
      for (const [k, rec] of Object.entries(parsed)) {
        if (rec && isUnlockValid(rec, nowMs)) {
          merged[k] = rec;
        }
      }
    } catch {
      // Ignore storage errors
    }
  };
  if (typeof window !== 'undefined') {
    readFrom(window.sessionStorage);
    readFrom(window.localStorage);
  }
  return merged;
}

export function saveGuestAdUnlock(
  record: AdUnlockRecord,
  isSessionOnly: boolean
): Record<string, AdUnlockRecord> {
  if (typeof window === 'undefined') return { [record.contentId]: record };
  try {
    const targetStorage = isSessionOnly ? window.sessionStorage : window.localStorage;
    const raw = targetStorage.getItem(GUEST_UNLOCKS_KEY);
    const current = raw ? (JSON.parse(raw) as Record<string, AdUnlockRecord>) : {};
    const pruned = pruneExpiredUnlockMap(current);
    pruned[record.contentId] = record;
    targetStorage.setItem(GUEST_UNLOCKS_KEY, JSON.stringify(pruned));
  } catch {
    // Ignore storage errors
  }
  return loadGuestAdUnlocks();
}

export function pruneExpiredUnlockMap(
  map: Record<string, AdUnlockRecord>,
  nowMs = Date.now()
): Record<string, AdUnlockRecord> {
  const out: Record<string, AdUnlockRecord> = {};
  for (const [key, rec] of Object.entries(map)) {
    if (isUnlockValid(rec, nowMs)) {
      out[key] = rec;
    }
  }
  return out;
}

export function checkAdUnlockRateLimit(
  uid: string | null | undefined,
  maxUnlocksPerHour = 20,
  nowMs = Date.now()
): { allowed: boolean; remaining: number; usedLastHour: number } {
  if (maxUnlocksPerHour <= 0) {
    return { allowed: true, remaining: 999, usedLastHour: 0 };
  }
  const bucketKey = `${RATE_LIMIT_KEY}:${uid || 'guest'}`;
  const cutoff = nowMs - 3600_000;
  try {
    const raw = localStorage.getItem(bucketKey);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    const recent = list.filter((ts) => typeof ts === 'number' && ts >= cutoff);
    if (recent.length !== list.length) {
      localStorage.setItem(bucketKey, JSON.stringify(recent));
    }
    const remaining = Math.max(0, maxUnlocksPerHour - recent.length);
    return {
      allowed: recent.length < maxUnlocksPerHour,
      remaining,
      usedLastHour: recent.length,
    };
  } catch {
    return { allowed: true, remaining: maxUnlocksPerHour, usedLastHour: 0 };
  }
}

export function recordLocalUnlockTimestamp(
  uid: string | null | undefined,
  nowMs = Date.now()
): void {
  const bucketKey = `${RATE_LIMIT_KEY}:${uid || 'guest'}`;
  const cutoff = nowMs - 3600_000;
  try {
    const raw = localStorage.getItem(bucketKey);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    const next = [...list.filter((ts) => typeof ts === 'number' && ts >= cutoff), nowMs];
    localStorage.setItem(bucketKey, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

// --- Master Access Gate Decision Engine (`canWatch`) ---

export function hasActiveUserSubscription(
  user: UserProfile | null,
  requiredPlanId: string | null,
  nowMs = Date.now()
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.planExpiresAt) {
    const expMs = Date.parse(user.planExpiresAt);
    if (!Number.isNaN(expMs) && expMs < nowMs) {
      return false;
    }
  }
  if (requiredPlanId) {
    return user.plan === 'premium' && user.subscriptionPlanId === requiredPlanId;
  }
  return user.plan === 'premium' || Boolean(user.subscriptionPlanId);
}

export function canWatch(params: {
  user: UserProfile | null;
  movie: MovieItem;
  episode?: EpisodeItem | null;
  plans: SubscriptionPlan[];
  unlocksMap: Record<string, AdUnlockRecord>;
  adSettings?: AdGlobalSettings | null;
  allowOnceContentIds?: Record<string, boolean>;
  nowMs?: number;
}): WatchGateEvaluation {
  const {
    user,
    movie,
    episode = null,
    plans,
    unlocksMap,
    adSettings,
    allowOnceContentIds = {},
    nowMs = Date.now(),
  } = params;

  const unlockSettings = getUnlockSettings(adSettings);
  const rule = resolveEffectiveAccess(movie, episode);
  const contentId = episode ? episode.id : movie.id;

  const requiredPlan = rule.planId
    ? plans.find((p) => p.id === rule.planId)
    : plans.find((p) => p.isActive) ?? plans[0];

  const planName = requiredPlan?.name ?? rule.planName ?? 'Cinema Plus';
  const priceText = requiredPlan
    ? formatMonthlyPrice(requiredPlan.pricePerMonth, requiredPlan.currency)
    : '$9.99/mo';

  const unlockRecord = unlocksMap[contentId];
  const hasUnlockRecord = Boolean(unlockRecord);
  const validUnlock = isUnlockValid(unlockRecord, nowMs);
  const unlockExpired = hasUnlockRecord && !validUnlock;

  const rateStatus = checkAdUnlockRateLimit(user?.uid, unlockSettings.maxUnlocksPerHour, nowMs);

  const adsRequired = rule.adsRequired;
  const watchAdSubline =
    adsRequired > 1
      ? `Free · Watch ${adsRequired} short ads`
      : 'Free · about 30 seconds';

  const titleLabel = episode
    ? `${movie.title} — S${episode.seasonNumber}E${episode.number}`
    : movie.title;

  const defaultCopy = {
    gateTitle:
      rule.mode === 'ad_unlock_only'
        ? episode
          ? 'Watch an ad to unlock this episode'
          : 'Watch an ad to unlock this title'
        : formatGateTemplate(unlockSettings.gateTitle || 'Unlock this episode', {
            plan: planName,
            price: priceText,
            title: movie.title,
            episode: titleLabel,
            ads: adsRequired,
          }),
    gateDescription: formatGateTemplate(
      unlockSettings.gateDescription ||
        'Watch a short ad to play this episode for free, or subscribe to {plan} for unlimited ad-free viewing.',
      {
        plan: planName,
        price: priceText,
        title: movie.title,
        episode: titleLabel,
        ads: adsRequired,
      }
    ),
    lockHeading:
      rule.mode === 'ad_unlock_only'
        ? 'Ad-Unlocked Access'
        : `Subscription Required: ${planName}`,
    lockSubline:
      rule.mode === 'ad_unlock_only'
        ? `“${titleLabel}” is available free after watching ${adsRequired === 1 ? 'a short sponsor ad' : `${adsRequired} short sponsor ads`}.`
        : `“${titleLabel}” requires an active “${planName}” subscription (${priceText}).`,
    watchAdLabel: adsRequired > 1 ? `Watch ${adsRequired} Ads to Unlock` : 'Watch Ad to Unlock',
    watchAdSubline,
    subscribeLabel: `View ${planName} Plan (${priceText})`,
    subscribersNote: 'Subscribers watch without ads',
  };

  if (user?.role === 'admin') {
    return {
      allowed: true,
      reason: 'admin_bypass',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: rule.adIds,
      rateLimited: false,
      remainingHourlyUnlocks: 999,
      copy: defaultCopy,
    };
  }

  if (rule.mode === 'free' && !rule.requiresSignIn) {
    return {
      allowed: true,
      reason: 'free',
      mode: 'free',
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: [],
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: defaultCopy,
    };
  }

  if (rule.mode === 'free' && rule.requiresSignIn) {
    if (user) {
      return {
        allowed: true,
        reason: 'free',
        mode: 'free',
        effectiveRule: rule,
        requiredPlan,
        planName,
        priceText,
        canSubscribe: false,
        canWatchAd: false,
        requiresSignInFirst: false,
        adsRequired,
        adIds: [],
        rateLimited: false,
        remainingHourlyUnlocks: rateStatus.remaining,
        copy: defaultCopy,
      };
    }
    return {
      allowed: false,
      reason: 'sign_in_required',
      mode: 'free',
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: true,
      adsRequired,
      adIds: [],
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: {
        ...defaultCopy,
        lockHeading: 'Sign In Required',
        lockSubline: `Sign in with a free account to watch “${titleLabel}”.`,
      },
    };
  }

  // Subscription bypass (unless content is strictly ad-only without plan exemption? Subscribers always watch ad-free!)
  if (
    (rule.mode === 'subscription_only' || rule.mode === 'subscription_or_ad') &&
    hasActiveUserSubscription(user, rule.planId, nowMs)
  ) {
    return {
      allowed: true,
      reason: 'subscribed',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: [],
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: defaultCopy,
    };
  }

  // Ad-only titles still grant free instant ad-free playback to active paid subscribers
  if (
    rule.mode === 'ad_unlock_only' &&
    user &&
    hasActiveUserSubscription(user, null, nowMs)
  ) {
    return {
      allowed: true,
      reason: 'subscribed',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: [],
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: defaultCopy,
    };
  }

  // Check rewarded ad unlock validity (strictly per contentId)
  const adUnlockFeatureActive =
    unlockSettings.adUnlockEnabled &&
    (adSettings?.adsEnabled ?? true) &&
    rule.adUnlockAllowed &&
    rule.mode !== 'subscription_only';

  if (adUnlockFeatureActive && validUnlock && unlockRecord) {
    return {
      allowed: true,
      reason: 'ad_unlocked',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: rule.adIds,
      unlockRecord,
      expiresAt: unlockRecord.expiresAt,
      expiresInText: formatRemainingDuration(unlockRecord.expiresAt, nowMs),
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: defaultCopy,
    };
  }

  if (allowOnceContentIds[contentId]) {
    return {
      allowed: true,
      reason: 'allow_once_fallback',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe: false,
      canWatchAd: false,
      requiresSignInFirst: false,
      adsRequired,
      adIds: rule.adIds,
      rateLimited: false,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: defaultCopy,
    };
  }

  const canSubscribe = rule.mode === 'subscription_only' || rule.mode === 'subscription_or_ad';

  if (!user) {
    const guestCanWatchAd = adUnlockFeatureActive && unlockSettings.allowGuestAdUnlock;
    return {
      allowed: false,
      reason: unlockExpired
        ? 'expired_unlock'
        : guestCanWatchAd
          ? rule.mode === 'ad_unlock_only'
            ? 'ad_unlock_only'
            : 'ad_unlock_or_plan'
          : 'plan_required',
      mode: rule.mode,
      effectiveRule: rule,
      requiredPlan,
      planName,
      priceText,
      canSubscribe,
      canWatchAd: guestCanWatchAd,
      requiresSignInFirst: !guestCanWatchAd,
      adsRequired,
      adIds: rule.adIds,
      unlockExpired,
      rateLimited: !rateStatus.allowed,
      remainingHourlyUnlocks: rateStatus.remaining,
      copy: {
        ...defaultCopy,
        watchAdLabel: 'Watch Ad to Watch',
      },
    };
  }

  const canWatchAd = adUnlockFeatureActive;
  return {
    allowed: false,
    reason: unlockExpired
      ? 'expired_unlock'
      : canWatchAd
        ? rule.mode === 'ad_unlock_only'
          ? 'ad_unlock_only'
          : 'ad_unlock_or_plan'
        : 'plan_required',
    mode: rule.mode,
    effectiveRule: rule,
    requiredPlan,
    planName,
    priceText,
    canSubscribe,
    canWatchAd,
    requiresSignInFirst: false,
    adsRequired,
    adIds: rule.adIds,
    unlockExpired,
    rateLimited: !rateStatus.allowed,
    remainingHourlyUnlocks: rateStatus.remaining,
    copy: defaultCopy,
  };
}

// --- VAST Ad Picker for Rewarded Unlock (Banner -> Episode -> Title -> Pool) ---

export function pickUnlockVastAds(params: {
  vastAds: VastAdItem[];
  adSettings?: AdGlobalSettings | null;
  movie: MovieItem;
  episode?: EpisodeItem | null;
  user: UserProfile | null;
  device: AdDevice;
  bannerAdMode?: 'inherit' | 'specific_ad_ids';
  bannerUnlockAdIds?: string[];
  adsRequired?: number;
  nowMs?: number;
}): VastAdItem[] {
  const {
    vastAds,
    adSettings,
    movie,
    episode = null,
    user,
    device,
    bannerAdMode,
    bannerUnlockAdIds = [],
    adsRequired = 1,
    nowMs = Date.now(),
  } = params;

  const rule = resolveEffectiveAccess(movie, episode);
  const count = Math.min(3, Math.max(1, adsRequired || rule.adsRequired || 1));

  // Build prioritized specific IDs: 1) Hero Banner override, 2) Episode/Season/Title rule
  const explicitIds =
    bannerAdMode === 'specific_ad_ids' && bannerUnlockAdIds.length > 0
      ? bannerUnlockAdIds
      : rule.adSource === 'specific_ad_ids' && rule.adIds.length > 0
        ? rule.adIds
        : [];

  const isPlayableRewardVast = (ad: VastAdItem, ignoreTargeting = false) => {
    if (ad.type === 'overlay') return false;
    if (!adSettings?.testMode && computeAdStatus(ad, nowMs) !== 'active') return false;
    if (adSettings?.testMode && ad.status !== 'active') return false;
    if (!matchesAdAudience(ad.audience, user)) return false;
    if (ad.devices.length > 0 && !ad.devices.includes(device)) return false;
    if (ignoreTargeting) return true;
    const ctxType = movie.type === 'series' ? 'tvshow' : 'movie';
    return matchesTargetContent(ad.targetType, ad.targetIds, ctxType, movie.id, episode?.id);
  };

  const picked: VastAdItem[] = [];
  const usedIds = new Set<string>();

  if (explicitIds.length > 0) {
    for (const id of explicitIds) {
      const found = vastAds.find((a) => a.id === id && (a.status === 'active' || adSettings?.testMode));
      if (found && !usedIds.has(found.id)) {
        picked.push(found);
        usedIds.add(found.id);
      }
      if (picked.length >= count) return picked;
    }
  }

  // General pre-roll pool first, then any video VAST
  const prerollPool = vastAds.filter(
    (ad) => !usedIds.has(ad.id) && ad.type === 'pre-roll' && isPlayableRewardVast(ad)
  );
  const relaxedPrerollPool =
    prerollPool.length > 0
      ? prerollPool
      : vastAds.filter(
          (ad) => !usedIds.has(ad.id) && ad.type === 'pre-roll' && isPlayableRewardVast(ad, true)
        );

  const anyVideoPool =
    relaxedPrerollPool.length > 0
      ? relaxedPrerollPool
      : vastAds.filter((ad) => !usedIds.has(ad.id) && isPlayableRewardVast(ad, true));

  const remainingPool = [...anyVideoPool];
  while (picked.length < count && remainingPool.length > 0) {
    const chosen = pickWeightedAd(remainingPool);
    if (!chosen) break;
    picked.push(chosen);
    usedIds.add(chosen.id);
    const idx = remainingPool.findIndex((item) => item.id === chosen.id);
    if (idx >= 0) remainingPool.splice(idx, 1);
  }

  // If still fewer than `count` (e.g., 2 ads required with 1 unique VAST configured), repeat top ad
  while (picked.length > 0 && picked.length < count) {
    picked.push(picked[picked.length % picked.length]);
  }

  return picked;
}

// --- Card & Episode Badge Model ---

export type AccessBadgeKind =
  | 'paid'
  | 'ad_unlock'
  | 'hybrid'
  | 'free'
  | 'included'
  | 'signin';

export interface AccessBadgeModel {
  kind: AccessBadgeKind;
  show: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  compactCode: string;
  tooltip: string;
  ariaLabel: string;
  hasMixedFreeEpisodes?: boolean;
}

export function getBadgeModel(params: {
  movie: MovieItem;
  episode?: EpisodeItem | null;
  user: UserProfile | null;
  plans: SubscriptionPlan[];
  adSettings?: AdGlobalSettings | null;
  episodes?: EpisodeItem[];
  unlocksMap?: Record<string, AdUnlockRecord>;
  nowMs?: number;
}): AccessBadgeModel {
  const {
    movie,
    episode = null,
    user,
    plans,
    adSettings,
    episodes,
    unlocksMap = {},
    nowMs = Date.now(),
  } = params;

  const unlockSettings = getUnlockSettings(adSettings);
  const rule = resolveEffectiveAccess(movie, episode);

  const planObj = rule.planId ? plans.find((p) => p.id === rule.planId) : undefined;
  const planDisplay =
    planObj?.name ?? rule.planName ?? unlockSettings.paidBadgeText ?? 'Cinema Plus';
  const paidText =
    rule.planName && rule.planName !== 'Cinema Plus'
      ? rule.planName
      : unlockSettings.paidBadgeText || planDisplay;
  const adText = unlockSettings.adBadgeText || 'Free with Ads';
  const freeText = unlockSettings.freeBadgeText || 'Free';
  const includedText = unlockSettings.includedBadgeText || 'Included';

  const hasMixedFreeEpisodes =
    movie.type === 'series' &&
    !episode &&
    Array.isArray(episodes) &&
    episodes.some((ep) => resolveEffectiveAccess(movie, ep).mode === 'free');

  const contentId = episode ? episode.id : movie.id;
  const isUnlockedByAd = isUnlockValid(unlocksMap[contentId], nowMs);
  const isSubscribed =
    (rule.mode === 'subscription_only' || rule.mode === 'subscription_or_ad') &&
    hasActiveUserSubscription(user, rule.planId, nowMs);

  if (!unlockSettings.showCardBadges) {
    return {
      kind: 'free',
      show: false,
      primaryLabel: '',
      compactCode: '',
      tooltip: '',
      ariaLabel: '',
      hasMixedFreeEpisodes,
    };
  }

  if (isSubscribed || isUnlockedByAd) {
    if (unlockSettings.showIncludedBadge) {
      return {
        kind: 'included',
        show: true,
        primaryLabel: isUnlockedByAd && !isSubscribed ? 'Unlocked' : includedText,
        compactCode: 'INC',
        tooltip: isSubscribed
          ? `Included in your ${planDisplay} subscription`
          : 'Temporarily unlocked via rewarded ad',
        ariaLabel: isSubscribed ? 'Included in your plan' : 'Unlocked with ad',
        hasMixedFreeEpisodes,
      };
    }
    return {
      kind: 'included',
      show: false,
      primaryLabel: includedText,
      compactCode: 'INC',
      tooltip: `Included with ${planDisplay}`,
      ariaLabel: `Included with ${planDisplay}`,
      hasMixedFreeEpisodes,
    };
  }

  if (rule.mode === 'free') {
    if (rule.requiresSignIn) {
      return {
        kind: 'signin',
        show: true,
        primaryLabel: 'Sign In',
        compactCode: 'SIGN',
        tooltip: 'Free with a signed-in account',
        ariaLabel: 'Sign in required for free playback',
        hasMixedFreeEpisodes,
      };
    }
    if (unlockSettings.showFreeBadge) {
      return {
        kind: 'free',
        show: true,
        primaryLabel: freeText,
        compactCode: 'FREE',
        tooltip: 'Free to watch without an account or ads',
        ariaLabel: 'Free to watch',
        hasMixedFreeEpisodes,
      };
    }
    return {
      kind: 'free',
      show: false,
      primaryLabel: freeText,
      compactCode: 'FREE',
      tooltip: 'Free to watch',
      ariaLabel: 'Free to watch',
      hasMixedFreeEpisodes,
    };
  }

  if (rule.mode === 'subscription_only' || !unlockSettings.adUnlockEnabled) {
    return {
      kind: 'paid',
      show: true,
      primaryLabel: paidText,
      compactCode: 'PRO',
      tooltip: `Requires an active ${planDisplay} subscription`,
      ariaLabel: `Subscription required: ${planDisplay}`,
      hasMixedFreeEpisodes,
    };
  }

  if (rule.mode === 'ad_unlock_only') {
    return {
      kind: 'ad_unlock',
      show: true,
      primaryLabel: adText,
      compactCode: 'AD',
      tooltip: `Watch ${rule.adsRequired === 1 ? '1 short ad' : `${rule.adsRequired} short ads`} to watch free`,
      ariaLabel: `${adText}: watch an ad to unlock`,
      hasMixedFreeEpisodes,
    };
  }

  // subscription_or_ad -> Paired badges ("Cinema Plus" + "Free with Ads")
  return {
    kind: 'hybrid',
    show: true,
    primaryLabel: paidText,
    secondaryLabel: adText,
    compactCode: 'PRO+AD',
    tooltip: `Included in ${planDisplay} or watch free with a short ad`,
    ariaLabel: `${paidText} or ${adText}`,
    hasMixedFreeEpisodes,
  };
}
