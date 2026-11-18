import assert from 'node:assert/strict';
import test from 'node:test';
import { READY_MADE_THEME_PRESETS } from '../data/themePresets.ts';
import type { CustomPage, MovieItem } from '../types/streaming.ts';
import {
  buildLinearGradientCss,
  checkThemeContrast,
  formatCopyrightText,
  getContrastRatio,
  isWithinSchedule,
  mergeSiteSettings,
  resolveTranslation,
  sanitizeHtml,
  validateBrandingFile,
  validateCustomCodeSyntax,
  validateImportedSiteSettings,
} from './customization.ts';
import { buildMovieJsonLd, formatMetaTitle, generateRobotsTxt, generateSitemapXml } from './seo.ts';

test('mergeSiteSettings fills missing nested sections with complete defaults', () => {
  const merged = mergeSiteSettings({
    siteName: 'CineStream',
    primaryColor: '#3b82f6',
    maintenanceMode: true,
    allowRegistration: false,
  });

  assert.equal(merged.siteName, 'CineStream');
  assert.equal(merged.theme?.colors.primaryColor, '#3b82f6');
  assert.equal(merged.featureFlags?.registration, false);
  assert.ok(merged.homeLayout && merged.homeLayout.sections.length >= 6);
  assert.ok(merged.player && merged.player.accentColor);
  assert.equal(merged.ads?.belowPlayer.enabled, false);
});

test('getContrastRatio and checkThemeContrast detect WCAG AA pass/fail accurately', () => {
  const bw = getContrastRatio('#ffffff', '#000000');
  assert.equal(bw, 21);

  const netflix = READY_MADE_THEME_PRESETS[0].colors;
  const issues = checkThemeContrast(netflix);
  assert.equal(issues.every((i) => i.passes), true);

  const brokenContrast = checkThemeContrast({
    ...netflix,
    textColor: '#1f1f24',
    backgroundColor: '#141418',
  });
  assert.equal(brokenContrast[0].passes, false);
});

test('buildLinearGradientCss builds multi-stop CSS linear-gradient', () => {
  assert.equal(
    buildLinearGradientCss({ angle: 90, stops: ['#e50914', '#f97316'] }),
    'linear-gradient(90deg, #e50914, #f97316)'
  );
});

test('sanitizeHtml strips scripts, iframes, and inline event handlers while keeping safe markup', () => {
  const clean = sanitizeHtml(
    '<h2>About Us</h2><p>Hello <strong onclick="alert(1)">world</strong>!</p><script>steal()</script><a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a>'
  );
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(clean.includes('<h2>About Us</h2>'));
  assert.ok(clean.includes('<strong>world</strong>'));
  assert.ok(clean.includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Good</a>'));
});

test('validateCustomCodeSyntax catches brace mismatches, tags, and invalid JS', () => {
  const ok = validateCustomCodeSyntax('.hero { color: red; }', 'console.log("hi");');
  assert.equal(ok.cssError, null);
  assert.equal(ok.jsError, null);

  const bad = validateCustomCodeSyntax('.hero { color: red;', 'const x = ;');
  assert.ok(bad.cssError);
  assert.ok(bad.jsError);
});

test('validateBrandingFile enforces PNG/SVG/WebP and 2MB max', () => {
  assert.equal(validateBrandingFile({ type: 'image/png', size: 120000, name: 'logo.png' }).valid, true);
  assert.equal(validateBrandingFile({ type: 'image/jpeg', size: 120000, name: 'logo.jpg' }).valid, false);
  assert.equal(validateBrandingFile({ type: 'image/webp', size: 3 * 1024 * 1024, name: 'big.webp' }).valid, false);
});

test('isWithinSchedule, formatCopyrightText, and resolveTranslation work as expected', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  assert.equal(isWithinSchedule('2026-11-10T00:00:00Z', '2026-11-20T00:00:00Z', now), true);
  assert.equal(isWithinSchedule('2026-11-16T00:00:00Z', '2026-11-20T00:00:00Z', now), false);
  assert.equal(isWithinSchedule('2026-11-10T00:00:00Z', '2026-11-14T00:00:00Z', now), false);

  assert.equal(formatCopyrightText('© {year} MyFlix', 2026), '© 2026 MyFlix');

  const label = resolveTranslation(
    {
      defaultLanguage: 'en',
      labels: { en: { home: 'Home' }, es: { home: 'Inicio' } },
    },
    'es',
    'home',
    'Home'
  );
  assert.equal(label, 'Inicio');
});

test('validateImportedSiteSettings validates schema before restoring JSON', () => {
  const invalid = validateImportedSiteSettings('{"foo":"bar"}');
  assert.equal(invalid.valid, false);

  const valid = validateImportedSiteSettings(
    JSON.stringify({
      siteName: 'ImportedFlix',
      primaryColor: '#10b981',
      maintenanceMode: false,
      allowRegistration: true,
    })
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.settings?.siteName, 'ImportedFlix');
});

test('SEO helpers generate meta title, sitemap.xml, robots.txt, and JSON-LD', () => {
  assert.equal(formatMetaTitle('{title} — {siteName}', 'Solaris Drift', 'KinoVault'), 'Solaris Drift — KinoVault');

  const movie: MovieItem = {
    id: 'solaris-drift',
    title: 'Solaris Drift',
    slug: 'solaris-drift',
    type: 'movie',
    description: 'Orbital survival.',
    releaseYear: 2025,
    duration: 128,
    rating: 8.8,
    ageRating: 'PG-13',
    language: 'English',
    country: 'USA',
    genres: ['Sci-Fi'],
    cast: ['Elena Vance'],
    director: 'Claire Moreau',
    tags: [],
    posterUrl: 'https://example.com/poster.jpg',
    bannerUrl: '',
    trailerUrl: '',
    videoSources: [],
    subtitles: [],
    isFeatured: true,
    isTrending: true,
    isPremium: false,
    status: 'published',
    views: 100,
    likesCount: 20,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };
  const page: CustomPage = {
    id: 'about',
    title: 'About',
    slug: 'about',
    contentHtml: '<p>Hi</p>',
    showContactForm: false,
    status: 'published',
    showInFooter: true,
    updatedAt: '2026-11-01T00:00:00Z',
  };

  const sitemap = generateSitemapXml('https://kinovault.app/', [movie], [page]);
  assert.ok(sitemap.includes('https://kinovault.app/#/movie/solaris-drift'));
  assert.ok(sitemap.includes('https://kinovault.app/#/page/about'));

  const robots = generateRobotsTxt('https://kinovault.app/');
  assert.ok(robots.includes('Disallow: /admin.html'));
  assert.ok(robots.includes('Sitemap: https://kinovault.app/sitemap.xml'));

  const jsonLd = JSON.parse(buildMovieJsonLd(movie, 'KinoVault', 'https://kinovault.app'));
  assert.equal(jsonLd['@type'], 'Movie');
  assert.equal(jsonLd.name, 'Solaris Drift');
});
