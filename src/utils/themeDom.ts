import { CURATED_GOOGLE_FONTS } from '../data/themePresets';
import type { MovieItem, SiteSettings } from '../types/streaming';
import { buildLinearGradientCss } from './customization';
import { buildMovieJsonLd, formatMetaTitle } from './seo';

let activeManifestBlobUrl: string | null = null;
let injectedScriptHash = '';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (!content.trim()) {
    const existing = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (existing) existing.setAttribute('content', '');
    return;
  }
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(id: string, rel: string, href: string, extra?: Record<string, string>): void {
  if (!href.trim()) return;
  let el = document.getElementById(id) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.id = id;
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
  }
}

export function applySiteCustomizationToDom(
  settings: SiteSettings,
  options?: {
    pageTitle?: string;
    activeMovie?: MovieItem | null;
  }
): void {
  if (typeof document === 'undefined') return;

  const theme = settings.theme;
  const typo = settings.typography;
  const shape = settings.shape;
  const branding = settings.branding;
  const seo = settings.seo;
  const custom = settings.customCode;

  // 1. Dynamic Google Fonts (only loads the 1-2 selected families with font-display: swap)
  if (typo) {
    const selectedFamilies = Array.from(new Set([typo.headingFont, typo.bodyFont].filter(Boolean)));
    const familyParams = selectedFamilies
      .map((fam) => {
        const meta = CURATED_GOOGLE_FONTS.find((f) => f.family === fam);
        const weights = meta?.weights || '400;500;600;700';
        return `family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@${weights}`;
      })
      .join('&');
    const fontHref = familyParams
      ? `https://fonts.googleapis.com/css2?${familyParams}&display=swap`
      : '';
    if (fontHref) {
      let fontLink = document.getElementById('kv-google-fonts') as HTMLLinkElement | null;
      if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = 'kv-google-fonts';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }
      if (fontLink.href !== fontHref) {
        fontLink.href = fontHref;
      }
    }
  }

  // 2. Apply CSS variables & shape/theme rules cleanly via style tag
  const colors = theme?.colors;
  const accent = colors?.primaryColor || settings.primaryColor || '#e50914';
  const secondary = colors?.secondaryColor || '#b20710';
  const bg = colors?.backgroundColor || '#0b0b0f';
  const surface = colors?.surfaceColor || '#14141c';
  const navBg = colors?.navbarBgColor || bg;
  const text = colors?.textColor || '#f4f4f5';
  const muted = colors?.mutedTextColor || '#a1a1aa';
  const border = colors?.borderColor || '#27272a';
  const btnBg = colors?.buttonBgColor || accent;
  const btnText = colors?.buttonTextColor || '#ffffff';

  const heroGradientCss = buildLinearGradientCss(theme?.heroGradient);
  const buttonGradientCss = buildLinearGradientCss(theme?.buttonGradient);

  const headingFont = typo?.headingFont || 'Outfit';
  const bodyFont = typo?.bodyFont || 'Plus Jakarta Sans';
  const baseFontSize = typo?.baseFontSize || 16;
  const headingWeight = typo?.headingWeight || 700;
  const letterSpacing = typo?.letterSpacing ?? -0.01;
  const lineHeight = typo?.lineHeight || 1.5;

  const cardRadius = shape?.cardRadius ?? 8;
  const buttonRadius = shape?.buttonRadius ?? 8;
  const inputRadius = shape?.inputRadius ?? 8;
  const modalRadius = shape?.modalRadius ?? 16;

  let styleEl = document.getElementById('kv-dynamic-theme') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'kv-dynamic-theme';
    document.head.appendChild(styleEl);
  }

  const reducedMotionCss = shape?.reducedMotion
    ? `* { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }`
    : '';

  styleEl.textContent = `
    :root {
      --kv-accent: ${accent};
      --kv-secondary: ${secondary};
      --kv-bg: ${bg};
      --kv-surface: ${surface};
      --kv-nav-bg: ${navBg};
      --kv-text: ${text};
      --kv-muted: ${muted};
      --kv-border: ${border};
      --kv-success: ${colors?.successColor || '#10b981'};
      --kv-warning: ${colors?.warningColor || '#f59e0b'};
      --kv-error: ${colors?.errorColor || '#ef4444'};
      --kv-btn-bg: ${btnBg};
      --kv-btn-text: ${btnText};
      --kv-hero-gradient: ${heroGradientCss};
      --kv-btn-gradient: ${buttonGradientCss};
      --kv-font-display: '${headingFont}', system-ui, sans-serif;
      --kv-font-sans: '${bodyFont}', system-ui, sans-serif;
      --kv-base-font-size: ${baseFontSize}px;
      --kv-heading-weight: ${headingWeight};
      --kv-letter-spacing: ${letterSpacing}em;
      --kv-line-height: ${lineHeight};
      --kv-radius-card: ${cardRadius}px;
      --kv-radius-btn: ${buttonRadius}px;
      --kv-radius-input: ${inputRadius}px;
      --kv-radius-modal: ${modalRadius}px;
      --kv-nav-height: ${shape?.navbarHeight ?? 64}px;
      --kv-nav-blur: ${shape?.navbarBlur ?? 12}px;
      --kv-hover-ms: ${shape?.hoverSpeedMs ?? 220}ms;
    }
    html { font-size: var(--kv-base-font-size); }
    body {
      font-family: var(--kv-font-sans);
      line-height: var(--kv-line-height);
      background-color: var(--kv-bg);
      color: var(--kv-text);
    }
    h1, h2, h3, .font-display {
      font-family: var(--kv-font-display);
      font-weight: var(--kv-heading-weight);
      letter-spacing: var(--kv-letter-spacing);
    }
    .kv-themed-surface {
      background-color: var(--kv-surface);
      border-color: var(--kv-border);
    }
    .kv-primary-btn {
      background: ${shape?.buttonStyle === 'gradient' ? 'var(--kv-btn-gradient)' : shape?.buttonStyle === 'outline' ? 'transparent' : 'var(--kv-btn-bg)'};
      color: ${shape?.buttonStyle === 'outline' ? 'var(--kv-accent)' : 'var(--kv-btn-text)'};
      border: ${shape?.buttonStyle === 'outline' ? '1.5px solid var(--kv-accent)' : '1px solid transparent'};
      border-radius: var(--kv-radius-btn);
    }
    .kv-card-radius { border-radius: var(--kv-radius-card); }
    .kv-input-radius { border-radius: var(--kv-radius-input); }
    .kv-modal-radius { border-radius: var(--kv-radius-modal); }
    ${reducedMotionCss}
  `;

  // 3. Favicon, Apple Touch Icon & PWA Manifest updates
  if (branding?.faviconUrl) {
    upsertLink('kv-dynamic-favicon', 'icon', branding.faviconUrl);
    const defaultIcon = document.querySelector('link[rel="icon"]:not(#kv-dynamic-favicon)') as HTMLLinkElement | null;
    if (defaultIcon) defaultIcon.href = branding.faviconUrl;
  }
  if (branding?.appIconUrl) {
    upsertLink('kv-dynamic-apple-icon', 'apple-touch-icon', branding.appIconUrl, { sizes: '180x180' });
    const dynamicManifest = {
      id: '/',
      name: settings.siteName || 'KinoVault',
      short_name: (settings.siteName || 'KinoVault').slice(0, 14),
      description: seo?.description || branding.tagline || '',
      theme_color: bg,
      background_color: bg,
      display: 'standalone',
      start_url: '/?source=pwa',
      icons: [
        { src: branding.appIconUrl, sizes: '192x192', type: 'image/png' },
        { src: branding.appIconUrl, sizes: '512x512', type: 'image/png' },
      ],
    };
    const nextUrl = URL.createObjectURL(new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' }));
    if (activeManifestBlobUrl) URL.revokeObjectURL(activeManifestBlobUrl);
    activeManifestBlobUrl = nextUrl;
    const existingManifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (existingManifest) {
      existingManifest.href = nextUrl;
    } else {
      upsertLink('kv-dynamic-manifest', 'manifest', nextUrl);
    }
  }
  upsertMeta('name', 'theme-color', bg);

  // 4. Dynamic SEO & OpenGraph / Twitter Meta & JSON-LD
  const movie = options?.activeMovie ?? null;
  const pageTitle = movie ? movie.title : (options?.pageTitle || settings.siteName);
  const fullTitle = formatMetaTitle(seo?.metaTitleTemplate || '{title} | {siteName}', pageTitle, settings.siteName);
  document.title = fullTitle;

  const desc = movie?.description || seo?.description || branding?.tagline || '';
  const ogImg =
    (movie && seo?.useTitlePosterForOg ? movie.bannerUrl || movie.posterUrl : '') ||
    seo?.ogImageUrl ||
    '';

  upsertMeta('name', 'description', desc);
  upsertMeta('name', 'keywords', seo?.keywords || '');
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:site_name', settings.siteName);
  upsertMeta('property', 'og:image', ogImg);
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', desc);
  upsertMeta('name', 'twitter:image', ogImg);

  if (seo?.searchConsoleVerification) {
    upsertMeta('name', 'google-site-verification', seo.searchConsoleVerification.trim());
  }
  if (seo?.canonicalBaseUrl) {
    const cleanBase = seo.canonicalBaseUrl.replace(/\/+$/, '');
    const href = movie ? `${cleanBase}/#/movie/${movie.slug}` : cleanBase;
    upsertLink('kv-canonical-link', 'canonical', href);
  }

  // JSON-LD Structured Data for Movie/TVSeries or WebSite
  const existingLd = document.getElementById('kv-json-ld');
  if (seo?.enableJsonLd) {
    const script = existingLd || document.createElement('script');
    script.id = 'kv-json-ld';
    script.setAttribute('type', 'application/ld+json');
    script.textContent = movie
      ? buildMovieJsonLd(movie, settings.siteName, seo.canonicalBaseUrl || window.location.origin)
      : JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: settings.siteName,
          description: desc,
          url: seo.canonicalBaseUrl || window.location.origin,
        });
    if (!existingLd) document.head.appendChild(script);
  } else if (existingLd) {
    existingLd.remove();
  }

  // Google Analytics (strict ID format guard to block arbitrary injection)
  const gaId = seo?.googleAnalyticsId?.trim() || '';
  if (/^(G|UA|AW)-[A-Z0-9-]+$/i.test(gaId) && !document.getElementById('kv-ga-script')) {
    const gtagSrc = document.createElement('script');
    gtagSrc.id = 'kv-ga-script';
    gtagSrc.async = true;
    gtagSrc.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(gtagSrc);

    const inlineGa = document.createElement('script');
    inlineGa.id = 'kv-ga-init';
    inlineGa.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(inlineGa);
  }

  // 5. Custom CSS / JS Injection (Gated by !safeMode)
  let customCssEl = document.getElementById('kv-custom-css') as HTMLStyleElement | null;
  if (!custom?.safeMode && custom?.customCss?.trim()) {
    if (!customCssEl) {
      customCssEl = document.createElement('style');
      customCssEl.id = 'kv-custom-css';
      document.head.appendChild(customCssEl);
    }
    customCssEl.textContent = custom.customCss;
  } else if (customCssEl) {
    customCssEl.remove();
  }

  const jsCode = !custom?.safeMode ? custom?.customJs?.trim() || '' : '';
  if (jsCode && jsCode !== injectedScriptHash) {
    injectedScriptHash = jsCode;
    try {
      const fn = new Function(jsCode);
      fn();
    } catch (err) {
      console.warn('Custom JS skipped due to runtime error:', err);
    }
  } else if (!jsCode) {
    injectedScriptHash = '';
  }
}
