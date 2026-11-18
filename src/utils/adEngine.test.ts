import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdGlobalSettings, CustomAdItem, UserProfile, VastAdItem } from '../types/streaming';
import {
  buildCustomAdReportTable,
  buildVastAdReportTable,
  computeAdMetrics,
  computeAdStatus,
  generateAdsReportCsv,
  generateAdsReportExcelHtml,
  isValidAdRedirectUrl,
  parseVastXmlSummary,
  pickEligibleCustomAds,
  pickEligibleVastAds,
  pickWeightedAd,
  validateAdImageFile,
  validateCustomAdDraft,
} from './adEngine';

const BASE_SETTINGS: AdGlobalSettings = {
  adsEnabled: true,
  hideAdsForPremium: true,
  maxAdsPerSession: 5,
  minSecondsBetweenVideoAds: 300,
  adLabelText: 'Ad',
  showAdLabel: true,
  testMode: false,
  defaultDailyCap: 0,
};

const NOW = Date.parse('2026-11-17T12:00:00Z');

const SAMPLE_CUSTOM_AD: CustomAdItem = {
  id: 'ad-home-1',
  name: 'BigSale',
  type: 'image',
  placement: 'home',
  imageUrl: '/src/assets/images/hero_solaris_drift_1794830225360.jpg',
  altText: 'Big Sale',
  redirectUrl: 'https://example.com/sale',
  openInNewTab: true,
  targetContentType: 'all',
  targetIds: [],
  startDate: '2026-09-29',
  endDate: '2027-09-29',
  status: 'active',
  priority: 8,
  weight: 80,
  dailyImpressionCap: 0,
  devices: ['desktop', 'mobile', 'tablet'],
  audience: 'all',
  impressions: 1000,
  clicks: 45,
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  createdBy: 'admin-1',
};

const SAMPLE_VAST_AD: VastAdItem = {
  id: 'vast-pre-1',
  name: 'BigSale',
  type: 'pre-roll',
  vastTagUrl: 'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480',
  targetType: 'movie',
  targetIds: ['solaris-drift'],
  midRollAtSeconds: [],
  overlayStartSeconds: 10,
  overlayDurationSeconds: 12,
  skipAfterSeconds: 5,
  startDate: '2026-09-29',
  endDate: '2027-09-29',
  status: 'active',
  priority: 7,
  audience: 'all',
  devices: ['desktop', 'mobile', 'tablet'],
  impressions: 200,
  completions: 150,
  skips: 40,
  clicks: 10,
  errors: 2,
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  createdBy: 'admin-1',
};

const PREMIUM_USER: UserProfile = {
  uid: 'u-prem',
  displayName: 'Pro User',
  email: 'pro@example.com',
  photoURL: '',
  role: 'user',
  status: 'active',
  plan: 'premium',
  planExpiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: '2026-11-17T00:00:00Z',
};

test('computeAdStatus identifies active, scheduled, expired, and inactive', () => {
  assert.equal(computeAdStatus(SAMPLE_CUSTOM_AD, NOW), 'active');
  assert.equal(
    computeAdStatus({ ...SAMPLE_CUSTOM_AD, status: 'inactive' }, NOW),
    'inactive'
  );
  assert.equal(
    computeAdStatus({ ...SAMPLE_CUSTOM_AD, startDate: '2027-01-01' }, NOW),
    'scheduled'
  );
  assert.equal(
    computeAdStatus({ ...SAMPLE_CUSTOM_AD, endDate: '2026-01-01' }, NOW),
    'expired'
  );
});

test('isValidAdRedirectUrl blocks javascript: and data: schemes', () => {
  assert.equal(isValidAdRedirectUrl('https://partner.example.com/offer').valid, true);
  assert.equal(isValidAdRedirectUrl('javascript:alert(1)').valid, false);
  assert.equal(isValidAdRedirectUrl('data:text/html,<script>').valid, false);
  assert.equal(isValidAdRedirectUrl('').valid, false);
});

test('validateAdImageFile enforces 1 MB cap and allowed MIME/ext', () => {
  assert.equal(validateAdImageFile({ type: 'image/png', size: 250_000, name: 'ad.png' }).valid, true);
  assert.equal(validateAdImageFile({ type: 'image/png', size: 1_500_000, name: 'big.png' }).valid, false);
  assert.equal(validateAdImageFile({ type: 'image/svg+xml', size: 10_000, name: 'vec.svg' }).valid, false);
});

test('validateCustomAdDraft requires endDate strictly after startDate', () => {
  const errs = validateCustomAdDraft({
    ...SAMPLE_CUSTOM_AD,
    startDate: '2026-12-01',
    endDate: '2026-11-01',
  });
  assert.ok(errs.endDate);
});

test('pickEligibleCustomAds enforces hideAdsForPremium, devices, daily cap, and targetIds', () => {
  // Hidden for premium user
  const premRes = pickEligibleCustomAds(
    [SAMPLE_CUSTOM_AD],
    BASE_SETTINGS,
    { placement: 'home', device: 'desktop', user: PREMIUM_USER },
    {},
    NOW
  );
  assert.equal(premRes.length, 0);

  // Visible for guest
  const guestRes = pickEligibleCustomAds(
    [SAMPLE_CUSTOM_AD],
    BASE_SETTINGS,
    { placement: 'home', device: 'desktop', user: null },
    {},
    NOW
  );
  assert.equal(guestRes.length, 1);

  // Blocked by daily impression cap
  const capped = pickEligibleCustomAds(
    [{ ...SAMPLE_CUSTOM_AD, dailyImpressionCap: 50 }],
    BASE_SETTINGS,
    { placement: 'home', device: 'desktop', user: null },
    { [SAMPLE_CUSTOM_AD.id]: 50 },
    NOW
  );
  assert.equal(capped.length, 0);

  // Target ID matching on player placement
  const playerAd: CustomAdItem = {
    ...SAMPLE_CUSTOM_AD,
    id: 'ad-player-1',
    placement: 'player',
    targetContentType: 'movie',
    targetIds: ['solaris-drift'],
  };
  assert.equal(
    pickEligibleCustomAds(
      [playerAd],
      BASE_SETTINGS,
      { placement: 'player', contentType: 'movie', contentId: 'solaris-drift', device: 'desktop', user: null },
      {},
      NOW
    ).length,
    1
  );
  assert.equal(
    pickEligibleCustomAds(
      [playerAd],
      BASE_SETTINGS,
      { placement: 'player', contentType: 'movie', contentId: 'other-movie', device: 'desktop', user: null },
      {},
      NOW
    ).length,
    0
  );
});

test('pickWeightedAd selects highest priority tier and respects weight', () => {
  const low = { id: 'low', priority: 2, weight: 100 };
  const highA = { id: 'highA', priority: 9, weight: 90 };
  const highB = { id: 'highB', priority: 9, weight: 10 };
  assert.equal(pickWeightedAd([low, highA, highB], () => 0.5)?.id, 'highA');
  assert.equal(pickWeightedAd([low, highA, highB], () => 0.95)?.id, 'highB');
});

test('pickEligibleVastAds respects minSecondsBetweenVideoAds and maxAdsPerSession', () => {
  const ok = pickEligibleVastAds(
    [SAMPLE_VAST_AD],
    BASE_SETTINGS,
    { contentType: 'movie', contentId: 'solaris-drift', device: 'desktop', user: null },
    'pre-roll',
    0,
    0,
    NOW
  );
  assert.equal(ok.length, 1);

  // Cooldown active (60s elapsed < 300s min)
  const cooldownBlocked = pickEligibleVastAds(
    [SAMPLE_VAST_AD],
    BASE_SETTINGS,
    { contentType: 'movie', contentId: 'solaris-drift', device: 'desktop', user: null },
    'pre-roll',
    1,
    NOW - 60_000,
    NOW
  );
  assert.equal(cooldownBlocked.length, 0);

  // Session cap reached
  const capBlocked = pickEligibleVastAds(
    [SAMPLE_VAST_AD],
    BASE_SETTINGS,
    { contentType: 'movie', contentId: 'solaris-drift', device: 'desktop', user: null },
    'pre-roll',
    5,
    0,
    NOW
  );
  assert.equal(capBlocked.length, 0);
});

test('parseVastXmlSummary handles InLine and Wrapper tags cleanly', () => {
  const inlineXml = `<VAST version="4.0"><Ad><InLine><AdTitle>Promo</AdTitle><Creatives><Creative><Linear><Duration>00:00:15</Duration><VideoClicks><ClickThrough><![CDATA[https://example.com]]></ClickThrough></VideoClicks><MediaFiles><MediaFile type="video/mp4"><![CDATA[https://cdn.example.com/ad.mp4]]></MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`;
  const parsed = parseVastXmlSummary(inlineXml);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.kind, 'InLine');
  assert.equal(parsed.durationSec, 15);
  assert.equal(parsed.mediaFileUrl, 'https://cdn.example.com/ad.mp4');

  const wrapperXml = `<VAST version="3.0"><Ad><Wrapper><VASTAdTagURI>https://ads.example.com/vast2.xml</VASTAdTagURI></Wrapper></Ad></VAST>`;
  const parsedWrap = parseVastXmlSummary(wrapperXml);
  assert.equal(parsedWrap.valid, true);
  assert.equal(parsedWrap.kind, 'Wrapper');
});

test('Report generators produce exact 4-row header format matching HTML attachments', () => {
  const customTbl = buildCustomAdReportTable([SAMPLE_CUSTOM_AD], () => '');
  const csv = generateAdsReportCsv(
    'Custom Ads Report',
    'Ivan Norris',
    customTbl.headers,
    customTbl.rows,
    new Date('2026-11-17T18:26:20Z')
  );
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Custom Ads Report');
  assert.equal(lines[1], 'Generated By: Ivan Norris');
  assert.ok(lines[2].startsWith('Generated On: '));
  assert.ok(lines[3].startsWith('Name,Type,Placement,Redirect Url,Target Content Type,Target Titles'));
  assert.ok(lines[4].includes('https://example.com/sale'));
  assert.ok(lines[4].includes('4.50%'));

  const vastTbl = buildVastAdReportTable([SAMPLE_VAST_AD], () => 'Solaris Drift');
  const html = generateAdsReportExcelHtml(
    'VAST Ads Report',
    'Ivan Norris',
    vastTbl.headers,
    vastTbl.rows,
    new Date('2026-11-17T18:26:38Z')
  );
  assert.ok(html.includes('VAST Ads Report'));
  assert.ok(html.includes('Generated By: Ivan Norris'));
  assert.ok(html.includes('Target Selection'));
  assert.ok(html.includes('Solaris Drift'));
  assert.equal(computeAdMetrics(SAMPLE_VAST_AD).completionRatePct, '75.0%');
});
