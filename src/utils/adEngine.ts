import type {
  AdAudience,
  AdComputedStatus,
  AdDevice,
  AdEventItem,
  AdGlobalSettings,
  AdPlacementType,
  AdTargetContentType,
  CustomAdItem,
  UserProfile,
  VastAdItem,
  VastAdType,
} from '../types/streaming';

// --- Ad Status & Validation Helpers ---

export function computeAdStatus(
  ad: { status: 'active' | 'inactive'; startDate: string; endDate: string },
  nowMs = Date.now()
): AdComputedStatus {
  if (ad.status !== 'active') return 'inactive';
  const startMs = Date.parse(ad.startDate);
  const endMs = Date.parse(ad.endDate);
  if (Number.isFinite(startMs) && nowMs < startMs) return 'scheduled';
  if (Number.isFinite(endMs) && nowMs > endMs) return 'expired';
  return 'active';
}

export function isValidAdRedirectUrl(rawUrl: string): { valid: boolean; error?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Redirect URL is required.' };
  }
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, error: 'Unsafe URL protocol is blocked.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must start with https://.' };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, error: 'Enter a valid domain URL (e.g. https://example.com).' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format. Include https://.' };
  }
}

export function isValidVastTagUrl(rawUrl: string): { valid: boolean; error?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'VAST tag URL is required.' };
  }
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, error: 'Unsafe URL protocol is blocked.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'VAST tag URL must use https://.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Enter a valid VAST XML endpoint URL.' };
  }
}

const ALLOWED_AD_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function validateAdImageFile(file: {
  type: string;
  size: number;
  name?: string;
}): { valid: boolean; error?: string } {
  const maxBytes = 1024 * 1024; // 1 MB max
  const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
  const extOk = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  if (!ALLOWED_AD_IMAGE_MIME.has(file.type) && !extOk) {
    return { valid: false, error: 'Only JPG, PNG, WebP, or GIF images are allowed.' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Selected image file is empty.' };
  }
  if (file.size > maxBytes) {
    return { valid: false, error: 'Image must be 1 MB or smaller.' };
  }
  return { valid: true };
}

export function validateCustomAdDraft(draft: Partial<CustomAdItem>): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = (draft.name || '').trim();
  if (name.length < 2 || name.length > 60) {
    errors.name = 'Ad name must be between 2 and 60 characters.';
  }
  const urlCheck = isValidAdRedirectUrl(draft.redirectUrl || '');
  if (!urlCheck.valid) {
    errors.redirectUrl = urlCheck.error || 'Invalid redirect URL.';
  }
  if (!(draft.imageUrl || '').trim()) {
    errors.imageUrl = 'Desktop ad image is required.';
  }
  const startMs = Date.parse(draft.startDate || '');
  const endMs = Date.parse(draft.endDate || '');
  if (!Number.isFinite(startMs)) {
    errors.startDate = 'Valid start date is required.';
  }
  if (!Number.isFinite(endMs)) {
    errors.endDate = 'Valid end date is required.';
  }
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
    errors.endDate = 'End date must be after start date.';
  }
  if ((draft.priority ?? 5) < 1 || (draft.priority ?? 5) > 10) {
    errors.priority = 'Priority must be between 1 and 10.';
  }
  if ((draft.weight ?? 50) < 1 || (draft.weight ?? 50) > 100) {
    errors.weight = 'Weight must be between 1 and 100.';
  }
  return errors;
}

export function validateVastAdDraft(draft: Partial<VastAdItem>): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = (draft.name || '').trim();
  if (name.length < 2 || name.length > 60) {
    errors.name = 'Ad name must be between 2 and 60 characters.';
  }
  const tagCheck = isValidVastTagUrl(draft.vastTagUrl || '');
  if (!tagCheck.valid) {
    errors.vastTagUrl = tagCheck.error || 'Invalid VAST tag URL.';
  }
  const startMs = Date.parse(draft.startDate || '');
  const endMs = Date.parse(draft.endDate || '');
  if (!Number.isFinite(startMs)) {
    errors.startDate = 'Valid start date is required.';
  }
  if (!Number.isFinite(endMs)) {
    errors.endDate = 'Valid end date is required.';
  }
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
    errors.endDate = 'End date must be after start date.';
  }
  const skip = draft.skipAfterSeconds ?? 5;
  if (skip !== 0 && (skip < 5 || skip > 15)) {
    errors.skipAfterSeconds = 'Skip delay must be 0 (non-skippable) or 5–15 seconds.';
  }
  if (draft.type === 'mid-roll' && (!draft.midRollAtSeconds || draft.midRollAtSeconds.length === 0)) {
    errors.midRollAtSeconds = 'Add at least one mid-roll cue time in seconds.';
  }
  return errors;
}

// --- VAST 2/3/4 XML Lightweight Parser ---

export interface ParsedVastResult {
  valid: boolean;
  kind?: 'InLine' | 'Wrapper';
  mediaFileUrl?: string;
  wrapperTagUrl?: string;
  clickThroughUrl?: string;
  durationSec?: number;
  title?: string;
  error?: string;
}

export function parseVastDuration(raw?: string | null): number {
  if (!raw) return 15;
  const parts = raw.trim().split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return Math.max(1, parts[0] * 3600 + parts[1] * 60 + Math.round(parts[2]));
  }
  const sec = Number(raw);
  return Number.isFinite(sec) && sec > 0 ? Math.round(sec) : 15;
}

function stripCdata(raw?: string): string {
  return (raw || '')
    .replace(/^[\s]*<!\[CDATA\[/i, '')
    .replace(/\]\]>[\s]*$/i, '')
    .trim();
}

export function parseVastXmlSummary(xmlText: string): ParsedVastResult {
  const xml = (xmlText || '').trim();
  if (!xml || !/<VAST[\s>]/i.test(xml)) {
    return { valid: false, error: 'Response is not a valid VAST XML document.' };
  }

  const wrapperMatch = xml.match(/<VASTAdTagURI\b[^>]*>([\s\S]*?)<\/VASTAdTagURI>/i);
  const mediaMatches = Array.from(
    xml.matchAll(/<MediaFile\b[^>]*>([\s\S]*?)<\/MediaFile>/gi)
  ).map((m) => stripCdata(m[1]));
  const mp4Media =
    mediaMatches.find((u) => /\.mp4(\?|$)/i.test(u)) ||
    mediaMatches.find((u) => /^https?:\/\//i.test(u));

  const clickMatch = xml.match(/<ClickThrough\b[^>]*>([\s\S]*?)<\/ClickThrough>/i);
  const durationMatch = xml.match(/<Duration\b[^>]*>([\s\S]*?)<\/Duration>/i);
  const titleMatch = xml.match(/<AdTitle\b[^>]*>([\s\S]*?)<\/AdTitle>/i);

  if (mp4Media) {
    return {
      valid: true,
      kind: 'InLine',
      mediaFileUrl: mp4Media,
      clickThroughUrl: stripCdata(clickMatch?.[1]),
      durationSec: parseVastDuration(durationMatch?.[1]),
      title: stripCdata(titleMatch?.[1]),
    };
  }
  const wrapperUri = stripCdata(wrapperMatch?.[1]);
  if (wrapperUri) {
    return {
      valid: true,
      kind: 'Wrapper',
      wrapperTagUrl: wrapperUri,
      clickThroughUrl: stripCdata(clickMatch?.[1]),
      durationSec: parseVastDuration(durationMatch?.[1]),
      title: stripCdata(titleMatch?.[1]),
    };
  }
  return {
    valid: false,
    error: 'VAST XML parsed cleanly, but no <MediaFile> or <VASTAdTagURI> Wrapper was found.',
  };
}

// --- AdEngine Eligibility & Weighted Rotation ---

export interface AdMatchContext {
  placement?: AdPlacementType;
  contentType?: AdTargetContentType;
  contentId?: string;
  episodeId?: string;
  device: AdDevice;
  user: UserProfile | null;
}

export function detectCurrentDevice(width = typeof window !== 'undefined' ? window.innerWidth : 1280): AdDevice {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function matchesAdAudience(audience: AdAudience, user: UserProfile | null): boolean {
  if (audience === 'all') return true;
  if (audience === 'guest') return !user;
  if (audience === 'premium') return user?.plan === 'premium';
  if (audience === 'free') return !user || user.plan !== 'premium';
  return true;
}

export function matchesTargetContent(
  targetType: AdTargetContentType,
  targetIds: string[],
  ctxType?: AdTargetContentType,
  contentId?: string,
  episodeId?: string
): boolean {
  if (targetType !== 'all' && ctxType && ctxType !== 'all' && targetType !== ctxType) {
    return false;
  }
  if (!targetIds || targetIds.length === 0) return true;
  if (episodeId && targetIds.includes(episodeId)) return true;
  if (contentId && targetIds.includes(contentId)) return true;
  return false;
}

export function isPremiumAdExempt(
  settings: AdGlobalSettings,
  user: UserProfile | null
): boolean {
  return Boolean(settings.hideAdsForPremium && user?.plan === 'premium');
}

export function pickEligibleCustomAds(
  ads: CustomAdItem[],
  settings: AdGlobalSettings,
  ctx: AdMatchContext,
  dailyImpressionsByAd: Record<string, number> = {},
  nowMs = Date.now()
): CustomAdItem[] {
  if (!settings.adsEnabled) return [];
  if (isPremiumAdExempt(settings, ctx.user)) return [];

  return ads.filter((ad) => {
    if (ctx.placement && ad.placement !== ctx.placement) return false;
    if (computeAdStatus(ad, nowMs) !== 'active') return false;
    if (!matchesAdAudience(ad.audience, ctx.user)) return false;
    if (ad.devices.length > 0 && !ad.devices.includes(ctx.device)) return false;

    const cap = ad.dailyImpressionCap > 0 ? ad.dailyImpressionCap : settings.defaultDailyCap;
    if (cap > 0 && (dailyImpressionsByAd[ad.id] ?? 0) >= cap) return false;

    // Home placement applies globally without content targeting
    if (ad.placement !== 'home') {
      if (
        !matchesTargetContent(
          ad.targetContentType,
          ad.targetIds,
          ctx.contentType,
          ctx.contentId,
          ctx.episodeId
        )
      ) {
        return false;
      }
    }
    return true;
  });
}

export function pickWeightedAd<T extends { priority: number; weight?: number }>(
  eligible: T[],
  rand: () => number = Math.random
): T | null {
  if (eligible.length === 0) return null;
  const maxPriority = Math.max(...eligible.map((a) => a.priority ?? 1));
  const tier = eligible.filter((a) => (a.priority ?? 1) === maxPriority);
  if (tier.length === 1) return tier[0];

  const totalWeight = tier.reduce((sum, a) => sum + Math.max(1, a.weight ?? 50), 0);
  let cursor = rand() * totalWeight;
  for (const item of tier) {
    cursor -= Math.max(1, item.weight ?? 50);
    if (cursor <= 0) return item;
  }
  return tier[0];
}

export function pickEligibleVastAds(
  ads: VastAdItem[],
  settings: AdGlobalSettings,
  ctx: AdMatchContext,
  vastType: VastAdType,
  sessionAdsShown = 0,
  lastVideoAdAtMs = 0,
  nowMs = Date.now()
): VastAdItem[] {
  if (!settings.adsEnabled) return [];
  if (isPremiumAdExempt(settings, ctx.user)) return [];
  if (settings.maxAdsPerSession > 0 && sessionAdsShown >= settings.maxAdsPerSession) {
    return [];
  }
  if (
    vastType !== 'overlay' &&
    lastVideoAdAtMs > 0 &&
    settings.minSecondsBetweenVideoAds > 0 &&
    nowMs - lastVideoAdAtMs < settings.minSecondsBetweenVideoAds * 1000
  ) {
    return [];
  }

  return ads.filter((ad) => {
    if (ad.type !== vastType) return false;
    if (computeAdStatus(ad, nowMs) !== 'active') return false;
    if (!matchesAdAudience(ad.audience, ctx.user)) return false;
    if (ad.devices.length > 0 && !ad.devices.includes(ctx.device)) return false;
    return matchesTargetContent(
      ad.targetType,
      ad.targetIds,
      ctx.contentType,
      ctx.contentId,
      ctx.episodeId
    );
  });
}

// --- Metrics & Reports ---

export function computeAdMetrics(ad: {
  impressions: number;
  clicks: number;
  completions?: number;
  skips?: number;
}): { ctrPct: string; completionRatePct: string; skipRatePct: string } {
  const imp = Math.max(0, ad.impressions || 0);
  const ctr = imp > 0 ? ((ad.clicks || 0) / imp) * 100 : 0;
  const comp = imp > 0 && ad.completions !== undefined ? (ad.completions / imp) * 100 : 0;
  const skip = imp > 0 && ad.skips !== undefined ? (ad.skips / imp) * 100 : 0;
  return {
    ctrPct: `${ctr.toFixed(2)}%`,
    completionRatePct: `${comp.toFixed(1)}%`,
    skipRatePct: `${skip.toFixed(1)}%`,
  };
}

export function formatReportTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleCaseLabel(v: string): string {
  if (!v) return '';
  if (v === 'home') return 'Home Page';
  if (v === 'tvshow') return 'Tvshow';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildCustomAdReportTable(
  ads: CustomAdItem[],
  resolveTargetNames: (ids: string[]) => string
): { headers: string[]; rows: string[][] } {
  const headers = [
    'Name',
    'Type',
    'Placement',
    'Redirect Url',
    'Target Content Type',
    'Target Titles',
    'Start Date',
    'End Date',
    'Status',
    'Impressions',
    'Clicks',
    'CTR',
  ];
  const rows = ads.map((ad) => {
    const metrics = computeAdMetrics(ad);
    const computed = computeAdStatus(ad);
    return [
      ad.name,
      'Image',
      titleCaseLabel(ad.placement),
      ad.redirectUrl,
      ad.placement === 'home' ? '' : titleCaseLabel(ad.targetContentType),
      ad.placement === 'home' ? '' : resolveTargetNames(ad.targetIds) || 'All Titles',
      ad.startDate.slice(0, 10),
      ad.endDate.slice(0, 10),
      titleCaseLabel(computed),
      String(ad.impressions),
      String(ad.clicks),
      metrics.ctrPct,
    ];
  });
  return { headers, rows };
}

export function buildVastAdReportTable(
  ads: VastAdItem[],
  resolveTargetNames: (ids: string[]) => string
): { headers: string[]; rows: string[][] } {
  const headers = [
    'Name',
    'Type',
    'Target Type',
    'Target Selection',
    'Start Date',
    'End Date',
    'Status',
    'Impressions',
    'Clicks',
    'CTR',
  ];
  const rows = ads.map((ad) => {
    const metrics = computeAdMetrics(ad);
    const computed = computeAdStatus(ad);
    return [
      ad.name,
      titleCaseLabel(ad.type),
      titleCaseLabel(ad.targetType),
      resolveTargetNames(ad.targetIds) || `All ${titleCaseLabel(ad.targetType)}`,
      ad.startDate.slice(0, 10),
      ad.endDate.slice(0, 10),
      titleCaseLabel(computed),
      String(ad.impressions),
      String(ad.clicks),
      metrics.ctrPct,
    ];
  });
  return { headers, rows };
}

export function generateAdsReportCsv(
  title: string,
  adminName: string,
  headers: string[],
  rows: string[][],
  generatedAt = new Date()
): string {
  const lines = [
    [title],
    [`Generated By: ${adminName}`],
    [`Generated On: ${formatReportTimestamp(generatedAt)}`],
    headers,
    ...rows,
  ];
  return lines.map((cols) => cols.map(escapeCsvCell).join(',')).join('\r\n');
}

export function generateAdsReportExcelHtml(
  title: string,
  adminName: string,
  headers: string[],
  rows: string[][],
  generatedAt = new Date()
): string {
  const colSpan = headers.length;
  const headerCells = headers
    .map((h) => `<th style="font-weight:bold;text-align:left;padding:6px 9px;border:1px solid #000;">${escapeHtml(h)}</th>`)
    .join('');
  const bodyRows = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c) =>
              `<td style="vertical-align:top;text-align:left;padding:6px 9px;border:1px solid #000;">${escapeHtml(c)}</td>`
          )
          .join('')}</tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; background: #fff; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  .r-title { font-size: 14pt; font-weight: bold; padding: 6px 9px; border: 1px solid #000; }
  .r-meta { font-size: 10pt; padding: 4px 9px; border: 1px solid #000; }
</style>
</head>
<body>
<table>
  <tbody>
    <tr><td class="r-title" colspan="${colSpan}">${escapeHtml(title)}</td></tr>
    <tr><td class="r-meta" colspan="${colSpan}">Generated By: ${escapeHtml(adminName)}</td></tr>
    <tr><td class="r-meta" colspan="${colSpan}">Generated On: ${escapeHtml(formatReportTimestamp(generatedAt))}</td></tr>
    <tr>${headerCells}</tr>
    ${bodyRows}
  </tbody>
</table>
</body>
</html>`;
}

export function summarizeAdEventsByDay(
  events: AdEventItem[],
  days = 7,
  nowMs = Date.now()
): { date: string; label: string; impressions: number; clicks: number }[] {
  const out: { date: string; label: string; impressions: number; clicks: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      impressions: 0,
      clicks: 0,
    });
  }
  const map = new Map(out.map((item) => [item.date, item]));
  for (const ev of events) {
    const dayKey = (ev.createdAt || '').slice(0, 10);
    const bucket = map.get(dayKey);
    if (!bucket) continue;
    if (ev.event === 'impression') bucket.impressions += 1;
    if (ev.event === 'click') bucket.clicks += 1;
  }
  return out;
}
