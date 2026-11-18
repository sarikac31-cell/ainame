import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardStats,
  canCommentRateLimit,
  canUserWatchMovie,
  exportUsersToCsv,
  filterMovies,
  formatDuration,
  formatMonthlyPrice,
  formatRelativeTime,
  formatTimecode,
  getSimilarMovies,
  getWatchRecommendations,
  sanitizeText,
  searchMovies,
  slugify,
  sortMovies,
  validateMovieDraft,
  validateSubscriptionPlanDraft,
} from './catalog';
import type { MovieItem, ReportItem, SubscriptionPlan, UserProfile } from '../types/streaming';

const baseMovie = (overrides: Partial<MovieItem>): MovieItem => ({
  id: 'm1',
  title: 'Solaris Drift',
  slug: 'solaris-drift',
  type: 'movie',
  description: 'A deep-orbit survival drama.',
  releaseYear: 2025,
  duration: 124,
  rating: 8.6,
  ageRating: 'PG-13',
  language: 'English',
  country: 'USA',
  genres: ['Sci-Fi', 'Drama'],
  cast: ['Elena Vance', 'Marcus Thorne'],
  director: 'A. Moreau',
  tags: ['space', 'orbit'],
  posterUrl: '/p.jpg',
  bannerUrl: '/b.jpg',
  trailerUrl: '',
  videoSources: [{ label: '1080p', url: 'https://example.com/v.mp4', type: 'mp4' }],
  subtitles: [],
  isFeatured: true,
  isTrending: true,
  isPremium: false,
  status: 'published',
  views: 1200,
  likesCount: 90,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

test('slugify creates clean URL-safe slugs', () => {
  assert.equal(slugify('The Midnight Meridian! (2025)'), 'the-midnight-meridian-2025');
  assert.equal(slugify('   '), 'untitled');
});

test('sanitizeText strips angle brackets and collapses whitespace', () => {
  assert.equal(sanitizeText('  <script>alert(1)</script> Great   film! '), 'scriptalert(1)/script Great film!');
});

test('formatDuration and formatTimecode format durations cleanly', () => {
  assert.equal(formatDuration(124), '2h 4m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatTimecode(65), '1:05');
  assert.equal(formatTimecode(3665), '1:01:05');
});

test('formatRelativeTime calculates human-readable offsets', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  assert.equal(formatRelativeTime('2026-11-16T11:59:40Z', now), 'just now');
  assert.equal(formatRelativeTime('2026-11-16T11:45:00Z', now), '15m ago');
  assert.equal(formatRelativeTime('2026-11-16T09:00:00Z', now), '3h ago');
  assert.equal(formatRelativeTime('2026-11-14T12:00:00Z', now), '2d ago');
});

test('filterMovies, sortMovies, and searchMovies work deterministically', () => {
  const catalog: MovieItem[] = [
    baseMovie({ id: '1', title: 'Solaris Drift', type: 'movie', genres: ['Sci-Fi'], rating: 8.6, views: 500, isPremium: false }),
    baseMovie({ id: '2', title: 'Midnight Meridian', type: 'series', genres: ['Thriller', 'Mystery'], rating: 9.1, views: 1500, isPremium: true, cast: ['Nadia Lindqvist'] }),
    baseMovie({ id: '3', title: 'Hidden Draft', status: 'draft', rating: 9.9 }),
  ];

  const publishedOnly = filterMovies(catalog, {});
  assert.equal(publishedOnly.length, 2);

  const premiumSeries = filterMovies(catalog, { type: 'series', access: 'premium' });
  assert.equal(premiumSeries.length, 1);
  assert.equal(premiumSeries[0].id, '2');

  const sortedByViews = sortMovies(publishedOnly, 'views');
  assert.equal(sortedByViews[0].id, '2');

  const castSearch = searchMovies(catalog, 'nadia');
  assert.equal(castSearch.length, 1);
  assert.equal(castSearch[0].id, '2');
});

test('getSimilarMovies ranks shared-genre titles first', () => {
  const target = baseMovie({ id: '1', genres: ['Sci-Fi', 'Drama'] });
  const related = baseMovie({ id: '2', title: 'Orbital', genres: ['Sci-Fi'] });
  const unrelated = baseMovie({ id: '3', title: 'Comedy Hour', genres: ['Comedy'] });
  const results = getSimilarMovies(target, [target, related, unrelated]);
  assert.equal(results[0].id, '2');
});

test('getWatchRecommendations prioritizes matching-genre movies and series and tracks matchedGenres', () => {
  const watching = baseMovie({ id: 'm1', type: 'movie', genres: ['Sci-Fi', 'Thriller'] });
  const sameSeries = baseMovie({
    id: 's1',
    type: 'series',
    title: 'Orbital Watch',
    genres: ['Sci-Fi', 'Thriller'],
    rating: 8.1,
  });
  const partialMovie = baseMovie({
    id: 'm2',
    type: 'movie',
    title: 'Silent Echo',
    genres: ['Thriller'],
    rating: 9.0,
  });
  const otherGenre = baseMovie({
    id: 'm3',
    type: 'movie',
    title: 'Sunny Bakeoff',
    genres: ['Comedy'],
    rating: 9.5,
  });
  const draftHidden = baseMovie({
    id: 'm4',
    type: 'series',
    genres: ['Sci-Fi', 'Thriller'],
    status: 'draft',
  });

  const rec = getWatchRecommendations(watching, [watching, otherGenre, partialMovie, sameSeries, draftHidden], 6);
  assert.deepEqual(rec.sameGenre.map((m) => m.id), ['s1', 'm2']);
  assert.deepEqual(rec.fallback.map((m) => m.id), ['m3']);
  assert.deepEqual(rec.items.map((m) => m.id), ['s1', 'm2', 'm3']);
  assert.deepEqual(rec.matchedGenres, ['Sci-Fi', 'Thriller']);
});

test('canCommentRateLimit enforces 10-second cooldown', () => {
  const now = 100_000;
  assert.deepEqual(canCommentRateLimit(0, now), { allowed: true, waitSeconds: 0 });
  assert.deepEqual(canCommentRateLimit(94_000, now), { allowed: false, waitSeconds: 4 });
  assert.deepEqual(canCommentRateLimit(89_000, now), { allowed: true, waitSeconds: 0 });
});

test('validateMovieDraft catches missing required fields', () => {
  const errors = validateMovieDraft({ title: '', slug: 'Bad Slug', releaseYear: 1700, duration: 0, rating: 12, description: 'short', genres: [] });
  assert.ok(errors.title);
  assert.ok(errors.slug);
  assert.ok(errors.releaseYear);
  assert.ok(errors.duration);
  assert.ok(errors.rating);
  assert.ok(errors.description);
  assert.ok(errors.genres);
});

test('exportUsersToCsv and calculateDashboardStats summarize platform data', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const users: UserProfile[] = [
    {
      uid: 'u1',
      displayName: 'Alex "Kino" Vance',
      email: 'alex@example.com',
      photoURL: '',
      role: 'admin',
      status: 'active',
      plan: 'premium',
      planExpiresAt: '2027-01-01',
      createdAt: '2026-11-14T00:00:00Z',
      lastLoginAt: '2026-11-16T10:00:00Z',
    },
    {
      uid: 'u2',
      displayName: 'Sam',
      email: 'sam@example.com',
      photoURL: '',
      role: 'user',
      status: 'active',
      plan: 'free',
      planExpiresAt: null,
      createdAt: '2026-09-01T00:00:00Z',
      lastLoginAt: '2026-11-10T10:00:00Z',
    },
  ];
  const reports: ReportItem[] = [
    { id: 'r1', movieId: '1', uid: 'u2', type: 'broken link', message: '404', status: 'open', createdAt: '2026-11-15T00:00:00Z' },
  ];
  const movies = [
    baseMovie({ id: '1', type: 'movie', views: 300 }),
    baseMovie({ id: '2', type: 'series', views: 700 }),
  ];

  const csv = exportUsersToCsv(users);
  assert.ok(csv.includes('"Alex ""Kino"" Vance"'));
  const stats = calculateDashboardStats(movies, users, reports, now);
  assert.equal(stats.totalMovies, 1);
  assert.equal(stats.totalSeries, 1);
  assert.equal(stats.premiumUsers, 1);
  assert.equal(stats.totalViews, 1000);
  assert.equal(stats.openReports, 1);
  assert.equal(stats.newUsersLast7Days, 1);
});

test('canUserWatchMovie enforces per-video subscription plan assignment and expiry', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const plans: SubscriptionPlan[] = [
    {
      id: 'plan-cinema-plus',
      name: 'Cinema Plus',
      slug: 'cinema-plus',
      pricePerMonth: 9.99,
      currency: 'USD',
      billingInterval: 'monthly',
      description: 'HD catalog',
      features: ['HD'],
      badgeColor: '#e50914',
      isActive: true,
      order: 1,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'plan-directors-vault',
      name: "Director's Vault",
      slug: 'directors-vault',
      pricePerMonth: 14.99,
      currency: 'USD',
      billingInterval: 'monthly',
      description: '4K exclusives',
      features: ['4K'],
      badgeColor: '#d97706',
      isActive: true,
      order: 2,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  const freeMovie = baseMovie({ id: 'free-1', isPremium: false, requiredPlanId: null });
  const cinemaMovie = baseMovie({
    id: 'sub-1',
    isPremium: true,
    requiredPlanId: 'plan-cinema-plus',
    requiredPlanName: 'Cinema Plus',
  });
  const vaultMovie = baseMovie({
    id: 'sub-2',
    isPremium: true,
    requiredPlanId: 'plan-directors-vault',
    requiredPlanName: "Director's Vault",
  });

  const makeUser = (overrides: Partial<UserProfile>): UserProfile => ({
    uid: 'u-sub',
    displayName: 'Viewer',
    email: 'viewer@example.com',
    photoURL: '',
    role: 'user',
    status: 'active',
    plan: 'free',
    subscriptionPlanId: null,
    subscriptionPlanName: null,
    planExpiresAt: null,
    createdAt: '2026-11-01T00:00:00Z',
    lastLoginAt: '2026-11-16T00:00:00Z',
    ...overrides,
  });

  // Guest can watch free movies, blocked on plan-gated movies
  assert.equal(canUserWatchMovie(freeMovie, null, plans, now).allowed, true);
  const guestBlocked = canUserWatchMovie(cinemaMovie, null, plans, now);
  assert.equal(guestBlocked.allowed, false);
  assert.equal(guestBlocked.reason, 'auth_required');
  assert.equal(guestBlocked.requiredPlanName, 'Cinema Plus');

  // Matching active plan unlocks Cinema Plus movie, blocks Director's Vault movie
  const cinemaSubscriber = makeUser({
    plan: 'premium',
    subscriptionPlanId: 'plan-cinema-plus',
    subscriptionPlanName: 'Cinema Plus',
    planExpiresAt: '2026-12-16T12:00:00Z',
  });
  assert.equal(canUserWatchMovie(cinemaMovie, cinemaSubscriber, plans, now).allowed, true);
  const mismatch = canUserWatchMovie(vaultMovie, cinemaSubscriber, plans, now);
  assert.equal(mismatch.allowed, false);
  assert.equal(mismatch.reason, 'plan_required');
  assert.equal(mismatch.requiredPlan?.pricePerMonth, 14.99);

  // Expired subscription is blocked
  const expiredSubscriber = makeUser({
    plan: 'premium',
    subscriptionPlanId: 'plan-cinema-plus',
    subscriptionPlanName: 'Cinema Plus',
    planExpiresAt: '2026-11-10T00:00:00Z',
  });
  const expiredCheck = canUserWatchMovie(cinemaMovie, expiredSubscriber, plans, now);
  assert.equal(expiredCheck.allowed, false);
  assert.equal(expiredCheck.reason, 'expired');

  // Admin bypasses plan lock
  const adminUser = makeUser({ role: 'admin', plan: 'free' });
  assert.equal(canUserWatchMovie(vaultMovie, adminUser, plans, now).allowed, true);

  // Free movie marked requiresSignIn: blocked for guest, unlocked for free signed-in user
  const signInFreeMovie = baseMovie({ id: 'signin-1', isPremium: false, requiresSignIn: true });
  const guestSignInBlocked = canUserWatchMovie(signInFreeMovie, null, plans, now);
  assert.equal(guestSignInBlocked.allowed, false);
  assert.equal(guestSignInBlocked.reason, 'sign_in_required');

  const freeSignedInUser = makeUser({ plan: 'free' });
  assert.equal(canUserWatchMovie(signInFreeMovie, freeSignedInUser, plans, now).allowed, true);

  // filterMovies distinguishes open free vs sign-in required vs subscription plans
  assert.equal(filterMovies([freeMovie, signInFreeMovie, cinemaMovie], { access: 'free' }).length, 1);
  assert.equal(filterMovies([freeMovie, signInFreeMovie, cinemaMovie], { access: 'signin' })[0].id, 'signin-1');
});

test('formatMonthlyPrice and validateSubscriptionPlanDraft format and validate plans', () => {
  assert.equal(formatMonthlyPrice(9.99, 'USD'), '$9.99/mo');
  assert.equal(formatMonthlyPrice(15, 'USD'), '$15/mo');
  const errs = validateSubscriptionPlanDraft({ name: '', slug: 'Bad Slug', pricePerMonth: -5, currency: '' });
  assert.ok(errs.name);
  assert.ok(errs.slug);
  assert.ok(errs.pricePerMonth);
  assert.ok(errs.currency);
});
