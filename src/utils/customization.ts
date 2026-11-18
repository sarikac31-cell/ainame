import { FULL_DEFAULT_SITE_SETTINGS } from '../data/themePresets';
import type {
  GradientConfig,
  I18nSettings,
  SiteSettings,
  ThemeColorPalette,
} from '../types/streaming';

/**
 * Deeply merges any stored partial SiteSettings from Firestore or JSON import
 * with FULL_DEFAULT_SITE_SETTINGS so missing nested keys never crash callers.
 */
export function mergeSiteSettings(partial?: Partial<SiteSettings> | null): SiteSettings {
  const base = FULL_DEFAULT_SITE_SETTINGS;
  if (!partial) return structuredCloneSafe(base);

  const merged: SiteSettings = {
    ...base,
    ...partial,
    announcement: {
      ...base.announcement,
      ...(partial.announcement ?? {}),
    },
    branding: {
      ...base.branding!,
      ...(partial.branding ?? {}),
    },
    theme: {
      ...base.theme!,
      ...(partial.theme ?? {}),
      colors: {
        ...base.theme!.colors,
        ...(partial.theme?.colors ?? {}),
        primaryColor:
          partial.theme?.colors?.primaryColor ??
          partial.primaryColor ??
          base.primaryColor,
      },
      heroGradient: {
        ...base.theme!.heroGradient,
        ...(partial.theme?.heroGradient ?? {}),
      },
      buttonGradient: {
        ...base.theme!.buttonGradient,
        ...(partial.theme?.buttonGradient ?? {}),
      },
      customPresets: partial.theme?.customPresets ?? base.theme!.customPresets,
    },
    typography: {
      ...base.typography!,
      ...(partial.typography ?? {}),
    },
    shape: {
      ...base.shape!,
      ...(partial.shape ?? {}),
    },
    homeLayout: {
      ...base.homeLayout!,
      ...(partial.homeLayout ?? {}),
      sections:
        Array.isArray(partial.homeLayout?.sections) && partial.homeLayout!.sections.length > 0
          ? partial.homeLayout!.sections
          : base.homeLayout!.sections,
      customCollections:
        partial.homeLayout?.customCollections ?? base.homeLayout!.customCollections,
    },
    navigation: {
      ...base.navigation!,
      ...(partial.navigation ?? {}),
      menuItems:
        Array.isArray(partial.navigation?.menuItems)
          ? partial.navigation!.menuItems
          : base.navigation!.menuItems,
      mobileTabs:
        Array.isArray(partial.navigation?.mobileTabs)
          ? partial.navigation!.mobileTabs
          : base.navigation!.mobileTabs,
    },
    footer: {
      ...base.footer!,
      ...(partial.footer ?? {}),
      columns:
        Array.isArray(partial.footer?.columns)
          ? partial.footer!.columns
          : base.footer!.columns,
      socialLinks:
        Array.isArray(partial.footer?.socialLinks)
          ? partial.footer!.socialLinks
          : base.footer!.socialLinks,
    },
    popup: {
      ...base.popup!,
      ...(partial.popup ?? {}),
    },
    maintenance: {
      ...base.maintenance!,
      ...(partial.maintenance ?? {}),
    },
    cookieConsent: {
      ...base.cookieConsent!,
      ...(partial.cookieConsent ?? {}),
    },
    player: {
      ...base.player!,
      ...(partial.player ?? {}),
    },
    seo: {
      ...base.seo!,
      ...(partial.seo ?? {}),
    },
    customCode: {
      ...base.customCode!,
      ...(partial.customCode ?? {}),
    },
    ads: {
      header: { ...base.ads!.header, ...(partial.ads?.header ?? {}) },
      betweenRows: { ...base.ads!.betweenRows, ...(partial.ads?.betweenRows ?? {}) },
      belowPlayer: { ...base.ads!.belowPlayer, ...(partial.ads?.belowPlayer ?? {}) },
      sidebar: { ...base.ads!.sidebar, ...(partial.ads?.sidebar ?? {}) },
    },
    i18n: {
      defaultLanguage: partial.i18n?.defaultLanguage ?? base.i18n!.defaultLanguage,
      labels: {
        ...base.i18n!.labels,
        ...(partial.i18n?.labels ?? {}),
      },
    },
    featureFlags: {
      ...base.featureFlags!,
      ...(partial.featureFlags ?? {}),
      registration: partial.allowRegistration ?? partial.featureFlags?.registration ?? base.allowRegistration,
    },
  };

  // Sync mirrored fields cleanly
  merged.primaryColor = merged.theme!.colors.primaryColor;
  merged.allowRegistration = merged.featureFlags!.registration;
  return merged;
}

function structuredCloneSafe<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// --- WCAG 2.1 Color Contrast Math ---

export function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

export function getRelativeLuminance(rgb: [number, number, number]): number {
  const linearize = (v: number) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = parseHexRgb(hex1);
  const rgb2 = parseHexRgb(hex2);
  if (!rgb1 || !rgb2) return 0;
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export interface ContrastCheckIssue {
  pair: string;
  ratio: number;
  required: number;
  passes: boolean;
}

export function checkThemeContrast(colors: ThemeColorPalette): ContrastCheckIssue[] {
  const pairs: { pair: string; fg: string; bg: string; required: number }[] = [
    { pair: 'Text on Background', fg: colors.textColor, bg: colors.backgroundColor, required: 4.5 },
    { pair: 'Text on Surface Card', fg: colors.textColor, bg: colors.surfaceColor, required: 4.5 },
    { pair: 'Muted Text on Background', fg: colors.mutedTextColor, bg: colors.backgroundColor, required: 4.5 },
    { pair: 'Button Text on Button Background', fg: colors.buttonTextColor, bg: colors.buttonBgColor, required: 4.5 },
  ];

  return pairs.map((p) => {
    const ratio = getContrastRatio(p.fg, p.bg);
    return {
      pair: p.pair,
      ratio,
      required: p.required,
      passes: ratio >= p.required,
    };
  });
}

export function buildLinearGradientCss(gradient?: GradientConfig | null): string {
  if (!gradient || !Array.isArray(gradient.stops) || gradient.stops.length === 0) {
    return 'linear-gradient(135deg, #e50914, #b20710)';
  }
  const stops = gradient.stops.filter((s) => s.trim().length > 0);
  if (stops.length === 1) return stops[0];
  const angle = Number.isFinite(gradient.angle) ? gradient.angle : 135;
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

// --- HTML Sanitizer for Rich Custom Pages & Footer Text ---

const ALLOWED_HTML_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
  'ul', 'ol', 'li', 'a', 'code', 'pre',
]);

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  let out = rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|button|textarea|select|meta|link|svg)[^>]*>/gi, '')
    .replace(/<\/(object|embed|form|button|textarea|select|svg)>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  out = out.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagRaw: string, attrsRaw: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;
    if (tag === 'a') {
      const hrefMatch = attrsRaw.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      const rawHref = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? '').trim();
      const safeHref =
        rawHref.startsWith('#') ||
        rawHref.startsWith('/') ||
        /^https?:\/\//i.test(rawHref) ||
        /^mailto:/i.test(rawHref)
          ? rawHref.replace(/"/g, '&quot;')
          : '#';
      const external = /^https?:\/\//i.test(safeHref)
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      return `<a href="${safeHref}"${external}>`;
    }
    return `<${tag}>`;
  });

  return out;
}

// --- Custom Code Syntax Validation ---

export function validateCustomCodeSyntax(
  customCss: string,
  customJs: string
): { cssError: string | null; jsError: string | null } {
  let cssError: string | null = null;
  let jsError: string | null = null;

  if (customCss.trim()) {
    let depth = 0;
    for (const ch of customCss) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth < 0) {
        cssError = 'Unexpected closing "}" in Custom CSS.';
        break;
      }
    }
    if (!cssError && depth !== 0) {
      cssError = 'Unclosed "{" brace in Custom CSS.';
    }
    if (!cssError && /<\/?style|<\/?script/i.test(customCss)) {
      cssError = 'Remove <style> or <script> HTML tags from Custom CSS.';
    }
  }

  if (customJs.trim()) {
    if (/<\/?script/i.test(customJs)) {
      jsError = 'Remove <script> HTML tags; enter raw JavaScript only.';
    } else {
      try {
        // Parse-only check without invoking the constructed function
        new Function(customJs);
      } catch (err) {
        jsError = err instanceof Error ? err.message : 'Invalid JavaScript syntax.';
      }
    }
  }

  return { cssError, jsError };
}

// --- Branding File Validation ---

const ALLOWED_BRANDING_MIME = new Set([
  'image/png',
  'image/svg+xml',
  'image/webp',
]);

export function validateBrandingFile(file: { type: string; size: number; name?: string }): {
  valid: boolean;
  error?: string;
} {
  const maxBytes = 2 * 1024 * 1024;
  const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
  const hasAllowedExt = ext === 'png' || ext === 'svg' || ext === 'webp';
  if (!ALLOWED_BRANDING_MIME.has(file.type) && !hasAllowedExt) {
    return { valid: false, error: 'Only PNG, SVG, or WebP images are allowed.' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }
  if (file.size > maxBytes) {
    return { valid: false, error: 'File exceeds the 2 MB maximum size limit.' };
  }
  return { valid: true };
}

// --- Schedule & Translation Utilities ---

export function isWithinSchedule(
  startAt?: string,
  endAt?: string,
  nowMs = Date.now()
): boolean {
  if (startAt && startAt.trim()) {
    const startMs = Date.parse(startAt);
    if (Number.isFinite(startMs) && nowMs < startMs) return false;
  }
  if (endAt && endAt.trim()) {
    const endMs = Date.parse(endAt);
    if (Number.isFinite(endMs) && nowMs > endMs) return false;
  }
  return true;
}

export function resolveTranslation(
  i18n: I18nSettings | undefined,
  language: string,
  key: string,
  fallback: string
): string {
  const dict = i18n?.labels;
  if (!dict) return fallback;
  return dict[language]?.[key] || dict[i18n.defaultLanguage]?.[key] || dict.en?.[key] || fallback;
}

export function formatCopyrightText(template: string, year = new Date().getFullYear()): string {
  return (template || '© {year}').replace(/\{year\}/gi, String(year));
}

// --- JSON Settings Import Validator ---

export function validateImportedSiteSettings(rawText: string): {
  valid: boolean;
  settings?: SiteSettings;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'JSON root must be an object.' };
    }
    const obj = parsed as Partial<SiteSettings>;
    if (typeof obj.siteName !== 'string' || obj.siteName.trim().length === 0) {
      return { valid: false, error: 'Missing required string field "siteName".' };
    }
    if (typeof obj.primaryColor !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(obj.primaryColor.trim())) {
      return { valid: false, error: 'Invalid or missing hex field "primaryColor".' };
    }
    if (typeof obj.maintenanceMode !== 'boolean' || typeof obj.allowRegistration !== 'boolean') {
      return {
        valid: false,
        error: 'Boolean fields "maintenanceMode" and "allowRegistration" are required.',
      };
    }
    return { valid: true, settings: mergeSiteSettings(obj) };
  } catch {
    return { valid: false, error: 'Malformed JSON file.' };
  }
}
