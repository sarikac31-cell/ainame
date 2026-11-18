import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CURATED_GOOGLE_FONTS,
  READY_MADE_THEME_PRESETS,
} from '../../data/themePresets';
import type {
  CustomCollection,
  CustomThemePreset,
  HomeSectionConfig,
  MobileTabConfig,
  MovieItem,
  NavIconName,
  NavMenuItem,
  SiteSettings,
  SocialPlatform,
  ThemeColorPalette,
} from '../../types/streaming';
import { buildLinearGradientCss, checkThemeContrast } from '../../utils/customization';
import { ImageCropUploadField } from './ImageCropUploadField';

export interface CustomizationTabProps {
  settings: SiteSettings;
  onChange: (updater: (prev: SiteSettings) => SiteSettings) => void;
  movies: MovieItem[];
}

const COLOR_FIELDS: { key: keyof ThemeColorPalette; label: string }[] = [
  { key: 'primaryColor', label: 'Primary / Accent' },
  { key: 'secondaryColor', label: 'Secondary Accent' },
  { key: 'backgroundColor', label: 'Page Background' },
  { key: 'surfaceColor', label: 'Surface / Card' },
  { key: 'navbarBgColor', label: 'Navbar Background' },
  { key: 'textColor', label: 'Primary Text' },
  { key: 'mutedTextColor', label: 'Muted Text' },
  { key: 'borderColor', label: 'Border Divider' },
  { key: 'successColor', label: 'Success' },
  { key: 'warningColor', label: 'Warning' },
  { key: 'errorColor', label: 'Error' },
  { key: 'buttonBgColor', label: 'Button Fill' },
  { key: 'buttonTextColor', label: 'Button Text' },
];

const NAV_ICONS: NavIconName[] = [
  'home', 'film', 'tv', 'bookmark', 'crown', 'search', 'user', 'compass', 'star', 'info', 'mail',
];

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  'instagram', 'youtube', 'telegram', 'x', 'facebook', 'whatsapp',
];

export const TabBranding: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const b = settings.branding!;

  const updateBranding = (patch: Partial<typeof b>) =>
    onChange((s) => ({ ...s, branding: { ...s.branding!, ...patch } }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Site Name (Text-Logo Fallback)</label>
          <input
            type="text"
            required
            value={settings.siteName}
            onChange={(e) => onChange((s) => ({ ...s, siteName: e.target.value }))}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Site Tagline</label>
          <input
            type="text"
            value={b.tagline}
            onChange={(e) => updateBranding({ tagline: e.target.value })}
            placeholder="Curated films, series, and theatrical stories."
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ImageCropUploadField
          label="Primary Logo (Dark Mode)"
          hint="Displayed in navbar on dark backgrounds. Empty falls back to Site Name text."
          value={settings.logoUrl}
          onChange={(url) => onChange((s) => ({ ...s, logoUrl: url }))}
          storageKeyPrefix="logo-dark"
        />
        <ImageCropUploadField
          label="Light Mode Logo"
          hint="Used when viewer switches to light theme."
          value={b.logoLightUrl}
          onChange={(url) => updateBranding({ logoLightUrl: url })}
          storageKeyPrefix="logo-light"
        />
        <ImageCropUploadField
          label="Favicon (Square)"
          hint="Browser tab icon (recommended 1:1 crop)."
          value={b.faviconUrl}
          onChange={(url) => updateBranding({ faviconUrl: url })}
          aspectRatio={1}
          maxOutputWidth={256}
          maxOutputHeight={256}
          storageKeyPrefix="favicon"
        />
        <ImageCropUploadField
          label="PWA App Icon (Square)"
          hint="Home-screen install icon & iOS apple-touch-icon."
          value={b.appIconUrl}
          onChange={(url) => updateBranding({ appIconUrl: url })}
          aspectRatio={1}
          maxOutputWidth={512}
          maxOutputHeight={512}
          storageKeyPrefix="pwa-icon"
        />
        <ImageCropUploadField
          label="Footer Logo"
          hint="Optional footer brand mark."
          value={b.footerLogoUrl}
          onChange={(url) => updateBranding({ footerLogoUrl: url })}
          storageKeyPrefix="footer-logo"
        />
        <ImageCropUploadField
          label="Loading / Splash Screen Logo"
          hint="Shown on the anime/brand entrance splash overlay."
          value={b.splashLogoUrl}
          onChange={(url) => updateBranding({ splashLogoUrl: url })}
          storageKeyPrefix="splash-logo"
        />
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Navbar Logo Height</span>
            <span className="font-mono">{b.logoHeight}px</span>
          </label>
          <input
            type="range"
            min="18"
            max="56"
            step="1"
            value={b.logoHeight}
            onChange={(e) => updateBranding({ logoHeight: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Navbar Logo Alignment</label>
          <select
            value={b.logoPosition}
            onChange={(e) => updateBranding({ logoPosition: e.target.value as 'left' | 'center' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="left">Left aligned</option>
            <option value="center">Center aligned</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Loading / Entrance Splash Screen</p>
            <p className="text-xs text-zinc-500">Custom logo animation and backdrop shown when opening the site.</p>
          </div>
          <input
            type="checkbox"
            checked={b.splashEnabled}
            onChange={(e) => updateBranding({ splashEnabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Animation Style</label>
            <select
              value={b.splashAnimation}
              onChange={(e) => updateBranding({ splashAnimation: e.target.value as 'fade' | 'pulse' | 'spinner' })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="fade">Cinematic Fade</option>
              <option value="pulse">Pulse Glow</option>
              <option value="spinner">Orbital Spinner</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Splash Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={b.splashBgColor}
                onChange={(e) => updateBranding({ splashBgColor: e.target.value })}
                className="h-9 w-11 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
              />
              <input
                type="text"
                value={b.splashBgColor}
                onChange={(e) => updateBranding({ splashBgColor: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-700"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">TMDB API Key (Optional metadata auto-fill)</label>
        <input
          type="password"
          value={settings.tmdbApiKey ?? ''}
          onChange={(e) => onChange((s) => ({ ...s, tmdbApiKey: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
        />
      </div>
    </div>
  );
};

export const TabColorsTheme: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const theme = settings.theme!;
  const [customPresetName, setCustomPresetName] = useState('');

  const updateTheme = (patch: Partial<typeof theme>) =>
    onChange((s) => {
      const nextTheme = { ...s.theme!, ...patch };
      return {
        ...s,
        primaryColor: nextTheme.colors.primaryColor,
        theme: nextTheme,
      };
    });

  const applyPreset = (preset: CustomThemePreset) => {
    updateTheme({
      activePresetId: preset.id,
      defaultMode: preset.mode,
      colors: { ...preset.colors },
      buttonGradient: {
        angle: 135,
        stops: [preset.colors.primaryColor, preset.colors.secondaryColor],
      },
    });
  };

  const contrastIssues = checkThemeContrast(theme.colors);
  const heroGradientPreview = buildLinearGradientCss(theme.heroGradient);
  const btnGradientPreview = buildLinearGradientCss(theme.buttonGradient);

  const updateStop = (kind: 'heroGradient' | 'buttonGradient', idx: number, color: string) => {
    const grad = theme[kind];
    const nextStops = grad.stops.map((st, i) => (i === idx ? color : st));
    updateTheme({ [kind]: { ...grad, stops: nextStops } });
  };

  return (
    <div className="space-y-6">
      {/* 8 Presets + Custom Presets */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Theme Presets</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Custom preset name..."
              value={customPresetName}
              onChange={(e) => setCustomPresetName(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1 text-xs dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => {
                if (!customPresetName.trim()) return;
                const newPreset: CustomThemePreset = {
                  id: `custom-${Date.now().toString(36)}`,
                  name: customPresetName.trim(),
                  mode: theme.defaultMode === 'light' ? 'light' : 'dark',
                  colors: { ...theme.colors },
                };
                updateTheme({
                  activePresetId: newPreset.id,
                  customPresets: [...theme.customPresets, newPreset],
                });
                setCustomPresetName('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Save Preset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[...READY_MADE_THEME_PRESETS, ...theme.customPresets].map((preset) => {
            const active = theme.activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`relative rounded-xl border p-2.5 transition ${
                  active
                    ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)]/10'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15"
                    style={{ backgroundColor: preset.colors.backgroundColor }}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: preset.colors.primaryColor }}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{preset.name}</p>
                    <p className="text-[10px] uppercase text-zinc-500">{preset.mode}</p>
                  </div>
                </button>
                {preset.id.startsWith('custom-') && (
                  <button
                    type="button"
                    onClick={() =>
                      updateTheme({
                        customPresets: theme.customPresets.filter((p) => p.id !== preset.id),
                      })
                    }
                    className="absolute right-1.5 top-1.5 text-zinc-400 hover:text-rose-500"
                    title="Delete custom preset"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode & Toggle Policy */}
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Default Color Mode</label>
          <select
            value={theme.defaultMode}
            onChange={(e) => updateTheme({ defaultMode: e.target.value as 'dark' | 'light' | 'system' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="dark">Dark Mode</option>
            <option value="light">Light Mode</option>
            <option value="system">Follow User System Preference</option>
          </select>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs font-medium sm:pt-4">
          <span>Allow Visitors to Toggle Dark / Light Mode</span>
          <input
            type="checkbox"
            checked={theme.allowUserThemeToggle}
            onChange={(e) => updateTheme({ allowUserThemeToggle: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </label>
      </div>

      {/* 13 Color Pickers */}
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Palette Colors</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <span className="text-xs font-medium">{label}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={theme.colors[key]}
                  onChange={(e) =>
                    updateTheme({
                      colors: { ...theme.colors, [key]: e.target.value },
                    })
                  }
                  className="h-7 w-9 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
                />
                <input
                  type="text"
                  value={theme.colors[key]}
                  onChange={(e) =>
                    updateTheme({
                      colors: { ...theme.colors, [key]: e.target.value },
                    })
                  }
                  className="w-20 rounded border border-zinc-300 bg-transparent px-1.5 py-1 font-mono text-[11px] dark:border-zinc-700"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WCAG AA Contrast Checker */}
      <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Automatic WCAG AA Contrast Checker (4.5:1 min)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {contrastIssues.map((c) => (
            <div
              key={c.pair}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                c.passes
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                {c.passes ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {c.pair}
              </span>
              <span className="font-mono font-semibold">{c.ratio}:1</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gradient Builders */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['heroGradient', 'buttonGradient'] as const).map((kind) => {
          const grad = theme[kind];
          const preview = kind === 'heroGradient' ? heroGradientPreview : btnGradientPreview;
          return (
            <div key={kind} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {kind === 'heroGradient' ? 'Hero Overlay Gradient' : 'Button Gradient'}
                </p>
                <span className="font-mono text-[11px] text-zinc-500">{grad.angle}°</span>
              </div>
              <div className="h-9 w-full rounded-lg border border-white/10" style={{ background: preview }} />
              <label className="block text-[11px] text-zinc-500">
                Angle
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={grad.angle}
                  onChange={(e) =>
                    updateTheme({ [kind]: { ...grad, angle: Number(e.target.value) } })
                  }
                  className="mt-1 w-full accent-[var(--kv-accent,#e50914)]"
                />
              </label>
              <div className="space-y-1.5">
                {grad.stops.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-14 text-[11px] text-zinc-500">Stop {idx + 1}</span>
                    <input
                      type="text"
                      value={st}
                      onChange={(e) => updateStop(kind, idx, e.target.value)}
                      className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono text-[11px] dark:border-zinc-700"
                    />
                    {grad.stops.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateTheme({
                            [kind]: {
                              ...grad,
                              stops: grad.stops.filter((_, i) => i !== idx),
                            },
                          })
                        }
                        className="text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {grad.stops.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateTheme({ [kind]: { ...grad, stops: [...grad.stops, '#0b0b0f'] } })
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--kv-accent,#e50914)]"
                  >
                    <Plus className="h-3 w-3" /> Add 3rd Color Stop
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TabTypography: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const typo = settings.typography!;
  const updateTypo = (patch: Partial<typeof typo>) =>
    onChange((s) => ({ ...s, typography: { ...s.typography!, ...patch } }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Heading Google Font</label>
          <select
            value={typo.headingFont}
            onChange={(e) => updateTypo({ headingFont: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CURATED_GOOGLE_FONTS.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family} ({f.category})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Body Google Font</label>
          <select
            value={typo.bodyFont}
            onChange={(e) => updateTypo({ bodyFont: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CURATED_GOOGLE_FONTS.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family} ({f.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <div className="mb-1 flex justify-between font-medium text-zinc-500">
            <span>Base Size</span>
            <span className="font-mono">{typo.baseFontSize}px</span>
          </div>
          <input
            type="range"
            min="14"
            max="18"
            step="1"
            value={typo.baseFontSize}
            onChange={(e) => updateTypo({ baseFontSize: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </label>

        <label className="block rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <span className="mb-1 block font-medium text-zinc-500">Heading Weight</span>
          <select
            value={typo.headingWeight}
            onChange={(e) => updateTypo({ headingWeight: Number(e.target.value) as 500 | 600 | 700 | 800 })}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value={500}>500 Medium</option>
            <option value={600}>600 SemiBold</option>
            <option value={700}>700 Bold</option>
            <option value={800}>800 ExtraBold</option>
          </select>
        </label>

        <label className="block rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <div className="mb-1 flex justify-between font-medium text-zinc-500">
            <span>Letter Spacing</span>
            <span className="font-mono">{typo.letterSpacing.toFixed(2)}em</span>
          </div>
          <input
            type="range"
            min="-0.04"
            max="0.1"
            step="0.01"
            value={typo.letterSpacing}
            onChange={(e) => updateTypo({ letterSpacing: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </label>

        <label className="block rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <div className="mb-1 flex justify-between font-medium text-zinc-500">
            <span>Line Height</span>
            <span className="font-mono">{typo.lineHeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="1.2"
            max="1.9"
            step="0.05"
            value={typo.lineHeight}
            onChange={(e) => updateTypo({ lineHeight: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </label>
      </div>

      {/* Live Preview */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-6 text-zinc-100 dark:border-zinc-800">
        <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Live Typography Preview (loads only {Array.from(new Set([typo.headingFont, typo.bodyFont])).join(' & ')} with display=swap)
        </p>
        <h3
          style={{
            fontFamily: `'${typo.headingFont}', sans-serif`,
            fontWeight: typo.headingWeight,
            letterSpacing: `${typo.letterSpacing}em`,
          }}
          className="text-2xl"
        >
          Solaris Drift — Director&apos;s Archival Cut
        </h3>
        <p
          style={{
            fontFamily: `'${typo.bodyFont}', sans-serif`,
            fontSize: `${typo.baseFontSize}px`,
            lineHeight: typo.lineHeight,
          }}
          className="mt-2 max-w-2xl text-zinc-300"
        >
          When an orbital telemetry station loses contact during a solar eclipse, flight engineer Elena Vance races against orbital decay in 4K restoration.
        </p>
      </div>
    </div>
  );
};

export const TabShapeStyle: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const sh = settings.shape!;
  const updateShape = (patch: Partial<typeof sh>) =>
    onChange((s) => ({ ...s, shape: { ...s.shape!, ...patch } }));

  const applyRadiusPreset = (preset: 'sharp' | 'rounded' | 'pill') => {
    if (preset === 'sharp') {
      updateShape({ radiusPreset: 'sharp', cardRadius: 0, buttonRadius: 0, inputRadius: 0, modalRadius: 2 });
    } else if (preset === 'rounded') {
      updateShape({ radiusPreset: 'rounded', cardRadius: 8, buttonRadius: 8, inputRadius: 8, modalRadius: 16 });
    } else {
      updateShape({ radiusPreset: 'pill', cardRadius: 18, buttonRadius: 24, inputRadius: 24, modalRadius: 24 });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Corner Radius &amp; Presets</p>
          <div className="flex gap-1.5">
            {(['sharp', 'rounded', 'pill'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyRadiusPreset(p)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize ${
                  sh.radiusPreset === p
                    ? 'bg-[var(--kv-accent,#e50914)] text-white'
                    : 'border border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['cardRadius', 'Card Radius'],
            ['buttonRadius', 'Button Radius'],
            ['inputRadius', 'Input Radius'],
            ['modalRadius', 'Modal Radius'],
          ] as const).map(([key, label]) => (
            <label key={key} className="block text-xs">
              <div className="mb-1 flex justify-between text-zinc-500">
                <span>{label}</span>
                <span className="font-mono">{sh[key]}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                value={sh[key]}
                onChange={(e) => updateShape({ [key]: Number(e.target.value) })}
                className="w-full accent-[var(--kv-accent,#e50914)]"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Card Style */}
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Poster Aspect Ratio</label>
          <select
            value={sh.posterRatio}
            onChange={(e) => updateShape({ posterRatio: e.target.value as '2:3' | '16:9' | '1:1' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="2:3">2:3 Cinema Poster</option>
            <option value="16:9">16:9 Widescreen Card</option>
            <option value="1:1">1:1 Square Tile</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Card Shadow Intensity</label>
          <select
            value={sh.shadowIntensity}
            onChange={(e) => updateShape({ shadowIntensity: e.target.value as 'none' | 'subtle' | 'medium' | 'strong' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="none">None</option>
            <option value="subtle">Subtle</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Card Hover Effect</label>
          <select
            value={sh.hoverEffect}
            onChange={(e) => updateShape({ hoverEffect: e.target.value as 'scale' | 'glow' | 'lift' | 'none' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="scale">Poster Scale</option>
            <option value="glow">Accent Glow</option>
            <option value="lift">Card Lift</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Hover Animation Speed</span>
            <span className="font-mono">{sh.hoverSpeedMs}ms</span>
          </label>
          <input
            type="range"
            min="100"
            max="600"
            step="20"
            value={sh.hoverSpeedMs}
            onChange={(e) => updateShape({ hoverSpeedMs: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <label className="flex items-center justify-between text-xs font-medium sm:pt-4">
          <span>Show Card Border</span>
          <input
            type="checkbox"
            checked={sh.cardBorder}
            onChange={(e) => updateShape({ cardBorder: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </label>
        <label className="flex items-center justify-between text-xs font-medium sm:pt-4">
          <span>Reduced Motion (Disable Animations)</span>
          <input
            type="checkbox"
            checked={sh.reducedMotion}
            onChange={(e) => updateShape({ reducedMotion: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </label>
      </div>

      {/* Button & Navbar Style */}
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Primary Button Style</label>
          <select
            value={sh.buttonStyle}
            onChange={(e) => updateShape({ buttonStyle: e.target.value as 'filled' | 'outline' | 'gradient' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="filled">Solid Filled</option>
            <option value="outline">Outline</option>
            <option value="gradient">Custom Gradient</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Button Size</label>
          <select
            value={sh.buttonSize}
            onChange={(e) => updateShape({ buttonSize: e.target.value as 'sm' | 'md' | 'lg' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Navbar Surface Style</label>
          <select
            value={sh.navbarStyle}
            onChange={(e) => updateShape({ navbarStyle: e.target.value as 'solid' | 'transparent-to-solid' | 'glass' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="glass">Glassmorphism</option>
            <option value="solid">Solid Color</option>
            <option value="transparent-to-solid">Transparent → Solid on Scroll</option>
          </select>
        </div>
        <div>
          <label className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Navbar Glass Blur</span>
            <span className="font-mono">{sh.navbarBlur}px</span>
          </label>
          <input
            type="range"
            min="0"
            max="24"
            value={sh.navbarBlur}
            onChange={(e) => updateShape({ navbarBlur: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div>
          <label className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Navbar Height</span>
            <span className="font-mono">{sh.navbarHeight}px</span>
          </label>
          <input
            type="range"
            min="52"
            max="88"
            value={sh.navbarHeight}
            onChange={(e) => updateShape({ navbarHeight: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <label className="flex items-center justify-between text-xs font-medium sm:pt-4">
          <span>Sticky Header Navbar</span>
          <input
            type="checkbox"
            checked={sh.navbarSticky}
            onChange={(e) => updateShape({ navbarSticky: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </label>
      </div>
    </div>
  );
};

export const TabHomeLayout: React.FC<CustomizationTabProps> = ({ settings, onChange, movies }) => {
  const layout = settings.homeLayout!;
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // New Custom Collection form
  const [colTitle, setColTitle] = useState('');
  const [colSort, setColSort] = useState<'manual' | 'newest' | 'rating' | 'views'>('manual');
  const [colStartAt, setColStartAt] = useState('');
  const [colEndAt, setColEndAt] = useState('');
  const [colMovieIds, setColMovieIds] = useState<string[]>([]);

  const updateLayout = (patch: Partial<typeof layout>) =>
    onChange((s) => ({ ...s, homeLayout: { ...s.homeLayout!, ...patch } }));

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= layout.sections.length) return;
    const copy = [...layout.sections];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    updateLayout({ sections: copy });
  };

  const handleAddCollection = () => {
    if (!colTitle.trim() || colMovieIds.length === 0) return;
    const id = `col-${Date.now().toString(36)}`;
    const nextCol: CustomCollection = {
      id,
      title: colTitle.trim(),
      movieIds: colMovieIds,
      sortOrder: colSort,
      startAt: colStartAt,
      endAt: colEndAt,
    };
    const nextSection: HomeSectionConfig = {
      id: `sec-${id}`,
      kind: 'collection',
      title: nextCol.title,
      visible: true,
      collectionId: id,
    };
    updateLayout({
      customCollections: [...layout.customCollections, nextCol],
      sections: [...layout.sections, nextSection],
    });
    setColTitle('');
    setColMovieIds([]);
    setColStartAt('');
    setColEndAt('');
  };

  return (
    <div className="space-y-6">
      {/* Drag-and-Drop Section List */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Home Page Sections (Drag to Reorder, Edit Title &amp; Visibility)
        </p>
        <div className="space-y-2">
          {layout.sections.map((sec, idx) => (
            <div
              key={sec.id}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== idx) {
                  moveSection(dragIndex, idx);
                }
                setDragIndex(null);
              }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <GripVertical className="h-4 w-4 cursor-grab text-zinc-400" />
              <span className="w-24 shrink-0 rounded bg-zinc-200 px-2 py-0.5 text-center font-mono text-[10px] uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {sec.kind}
              </span>
              <input
                type="text"
                value={sec.title}
                onChange={(e) => {
                  const next = layout.sections.map((x, i) =>
                    i === idx ? { ...x, title: e.target.value } : x
                  );
                  updateLayout({ sections: next });
                }}
                className="min-w-[160px] flex-1 rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1 text-xs font-medium dark:border-zinc-700"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={sec.visible}
                  onChange={(e) => {
                    const next = layout.sections.map((x, i) =>
                      i === idx ? { ...x, visible: e.target.checked } : x
                    );
                    updateLayout({ sections: next });
                  }}
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                <span>Visible</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(idx, idx - 1)}
                  disabled={idx === 0}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, idx + 1)}
                  disabled={idx === layout.sections.length - 1}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                {sec.kind === 'collection' && (
                  <button
                    type="button"
                    onClick={() =>
                      updateLayout({
                        sections: layout.sections.filter((x) => x.id !== sec.id),
                        customCollections: layout.customCollections.filter(
                          (c) => c.id !== sec.collectionId
                        ),
                      })
                    }
                    className="rounded p-1 text-rose-500"
                    title="Remove collection"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Slider Controls */}
      <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hero Slider Options</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Slide Interval</span>
              <span className="font-mono">{layout.heroIntervalSec}s</span>
            </div>
            <input
              type="range"
              min="3"
              max="10"
              value={layout.heroIntervalSec}
              onChange={(e) => updateLayout({ heroIntervalSec: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Hero Height</span>
              <span className="font-mono">{layout.heroHeightPx}px</span>
            </div>
            <input
              type="range"
              min="360"
              max="720"
              step="20"
              value={layout.heroHeightPx}
              onChange={(e) => updateLayout({ heroHeightPx: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Overlay Opacity</span>
              <span className="font-mono">{Math.round(layout.heroOverlayOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={layout.heroOverlayOpacity}
              onChange={(e) => updateLayout({ heroOverlayOpacity: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Max Slides</span>
              <span className="font-mono">{layout.heroMaxSlides}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={layout.heroMaxSlides}
              onChange={(e) => updateLayout({ heroMaxSlides: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div>
            <label className="mb-1 block text-zinc-500">Transition Effect</label>
            <select
              value={layout.heroTransition}
              onChange={(e) => updateLayout({ heroTransition: e.target.value as 'fade' | 'slide' })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="fade">Crossfade</option>
              <option value="slide">Horizontal Slide</option>
            </select>
          </div>
          <label className="flex items-center justify-between sm:pt-4">
            <span>Autoplay Slides</span>
            <input
              type="checkbox"
              checked={layout.heroAutoplay}
              onChange={(e) => updateLayout({ heroAutoplay: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="flex items-center justify-between sm:pt-4">
            <span>Show Navigation Dots</span>
            <input
              type="checkbox"
              checked={layout.heroShowDots}
              onChange={(e) => updateLayout({ heroShowDots: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show Prev/Next Arrows</span>
            <input
              type="checkbox"
              checked={layout.heroShowArrows}
              onChange={(e) => updateLayout({ heroShowArrows: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show Play Button</span>
            <input
              type="checkbox"
              checked={layout.heroShowPlayButton}
              onChange={(e) => updateLayout({ heroShowPlayButton: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show More Info Button</span>
            <input
              type="checkbox"
              checked={layout.heroShowMoreInfoButton}
              onChange={(e) => updateLayout({ heroShowMoreInfoButton: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
          </label>
        </div>
      </div>

      {/* Row & Browse Page Grid Options */}
      <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Rows &amp; Browse Page Layout</p>
        <div className="grid gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label className="mb-1 flex justify-between text-zinc-500">
              <span>Desktop Row Items</span>
              <span className="font-mono">{layout.itemsPerRowDesktop}</span>
            </label>
            <input
              type="range"
              min="3"
              max="8"
              value={layout.itemsPerRowDesktop}
              onChange={(e) => updateLayout({ itemsPerRowDesktop: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-zinc-500">
              <span>Tablet Row Items</span>
              <span className="font-mono">{layout.itemsPerRowTablet}</span>
            </label>
            <input
              type="range"
              min="2"
              max="6"
              value={layout.itemsPerRowTablet}
              onChange={(e) => updateLayout({ itemsPerRowTablet: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-zinc-500">
              <span>Mobile Row Items</span>
              <span className="font-mono">{layout.itemsPerRowMobile}</span>
            </label>
            <input
              type="range"
              min="1"
              max="3"
              value={layout.itemsPerRowMobile}
              onChange={(e) => updateLayout({ itemsPerRowMobile: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-zinc-500">Browse Page Display Mode</label>
            <select
              value={layout.browseMode}
              onChange={(e) => updateLayout({ browseMode: e.target.value as 'grid' | 'carousel' })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="grid">Responsive Grid</option>
              <option value="carousel">Horizontal Carousel</option>
            </select>
          </div>
          <div>
            <label className="mb-1 flex justify-between text-zinc-500">
              <span>Browse Cards Per Row</span>
              <span className="font-mono">{layout.browseCardsPerRow}</span>
            </label>
            <input
              type="range"
              min="3"
              max="8"
              value={layout.browseCardsPerRow}
              onChange={(e) => updateLayout({ browseCardsPerRow: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-zinc-500">Card Size Scale</label>
            <select
              value={layout.cardSize}
              onChange={(e) => updateShapeAndCard(onChange, e.target.value as 'compact' | 'standard' | 'large')}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showCardRating}
              onChange={(e) => updateLayout({ showCardRating: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Show Rating</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showCardYear}
              onChange={(e) => updateLayout({ showCardYear: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Show Release Year</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showCardBadges}
              onChange={(e) => updateLayout({ showCardBadges: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Show Access Badges</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showSeeAllLink}
              onChange={(e) => updateLayout({ showSeeAllLink: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Show &quot;View All&quot; Link</span>
          </label>
        </div>
      </div>

      {/* Custom Collections Builder */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Create Scheduled Custom Collection Row (e.g., Weekend Picks, Diwali Specials)
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Collection title..."
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-xs dark:border-zinc-700"
          />
          <select
            value={colSort}
            onChange={(e) => setColSort(e.target.value as 'manual' | 'newest' | 'rating' | 'views')}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="manual">Manual Order</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest Year</option>
            <option value="views">Most Viewed</option>
          </select>
          <input
            type="datetime-local"
            value={colStartAt}
            onChange={(e) => setColStartAt(e.target.value)}
            title="Optional start date"
            className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
          />
          <input
            type="datetime-local"
            value={colEndAt}
            onChange={(e) => setColEndAt(e.target.value)}
            title="Optional end date"
            className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
          />
        </div>

        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
          {movies.map((m) => {
            const checked = colMovieIds.includes(m.id);
            return (
              <label
                key={m.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                  checked
                    ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)]/15 font-semibold'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setColMovieIds((prev) =>
                      e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                    )
                  }
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                {m.title}
              </label>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddCollection}
          disabled={!colTitle.trim() || colMovieIds.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Collection to Home Page
        </button>

        {layout.customCollections.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {layout.customCollections.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-900"
              >
                <div>
                  <span className="font-semibold">{c.title}</span> · {c.movieIds.length} titles · sort: {c.sortOrder}
                  {(c.startAt || c.endAt) && (
                    <span className="ml-2 text-[11px] text-zinc-500">
                      ({c.startAt || 'now'} → {c.endAt || 'open'})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateLayout({
                      customCollections: layout.customCollections.filter((x) => x.id !== c.id),
                      sections: layout.sections.filter((s) => s.collectionId !== c.id),
                    })
                  }
                  className="text-rose-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function updateShapeAndCard(
  onChange: (updater: (prev: SiteSettings) => SiteSettings) => void,
  cardSize: 'compact' | 'standard' | 'large'
) {
  onChange((s) => ({ ...s, homeLayout: { ...s.homeLayout!, cardSize } }));
}

export const TabNavigationFooter: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const nav = settings.navigation!;
  const footer = settings.footer!;
  const [newColTitle, setNewColTitle] = useState('');

  const updateNav = (patch: Partial<typeof nav>) =>
    onChange((s) => ({ ...s, navigation: { ...s.navigation!, ...patch } }));
  const updateFooter = (patch: Partial<typeof footer>) =>
    onChange((s) => ({ ...s, footer: { ...s.footer!, ...patch } }));

  const addMenuItem = () => {
    const next: NavMenuItem = {
      id: `nav-${Date.now().toString(36)}`,
      label: 'Custom Link',
      href: '#/movies',
      icon: 'compass',
      showOnMobile: true,
    };
    updateNav({ menuItems: [...nav.menuItems, next] });
  };

  return (
    <div className="space-y-6">
      {/* Header Navigation Builder */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Header Menu Builder</p>
          <button
            type="button"
            onClick={addMenuItem}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold dark:border-zinc-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add Menu Item
          </button>
        </div>

        <div className="space-y-2">
          {nav.menuItems.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800 sm:grid-cols-12 sm:items-center">
              <input
                type="text"
                value={item.label}
                onChange={(e) =>
                  updateNav({
                    menuItems: nav.menuItems.map((m, i) => (i === idx ? { ...m, label: e.target.value } : m)),
                  })
                }
                placeholder="Label"
                className="sm:col-span-3 rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
              />
              <input
                type="text"
                value={item.href}
                onChange={(e) =>
                  updateNav({
                    menuItems: nav.menuItems.map((m, i) => (i === idx ? { ...m, href: e.target.value } : m)),
                  })
                }
                placeholder="#/route or https://"
                className="sm:col-span-3 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-zinc-700"
              />
              <select
                value={item.icon}
                onChange={(e) =>
                  updateNav({
                    menuItems: nav.menuItems.map((m, i) =>
                      i === idx ? { ...m, icon: e.target.value as NavIconName } : m
                    ),
                  })
                }
                className="sm:col-span-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {NAV_ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
              <label className="sm:col-span-2 flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={item.showOnMobile}
                  onChange={(e) =>
                    updateNav({
                      menuItems: nav.menuItems.map((m, i) =>
                        i === idx ? { ...m, showOnMobile: e.target.checked } : m
                      ),
                    })
                  }
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                <span>Mobile</span>
              </label>
              <div className="sm:col-span-2 flex justify-end gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => {
                    const copy = [...nav.menuItems];
                    const [el] = copy.splice(idx, 1);
                    copy.splice(idx - 1, 0, el);
                    updateNav({ menuItems: copy });
                  }}
                  className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === nav.menuItems.length - 1}
                  onClick={() => {
                    const copy = [...nav.menuItems];
                    const [el] = copy.splice(idx, 1);
                    copy.splice(idx + 1, 0, el);
                    updateNav({ menuItems: copy });
                  }}
                  className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateNav({ menuItems: nav.menuItems.filter((_, i) => i !== idx) })}
                  className="rounded p-1 text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 pt-2 sm:grid-cols-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nav.showSearchBar}
              onChange={(e) => updateNav({ showSearchBar: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Search Bar</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nav.showThemeToggle}
              onChange={(e) => updateNav({ showThemeToggle: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Theme Switcher</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nav.showLanguageSelector}
              onChange={(e) => updateNav({ showLanguageSelector: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Language Selector</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nav.showProfileMenu}
              onChange={(e) => updateNav({ showProfileMenu: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Profile / Auth Menu</span>
          </label>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Mobile Bottom Tab Bar</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {nav.mobileTabs.map((t: MobileTabConfig, idx: number) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800 text-xs">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={(e) =>
                  updateNav({
                    mobileTabs: nav.mobileTabs.map((mt, i) =>
                      i === idx ? { ...mt, enabled: e.target.checked } : mt
                    ),
                  })
                }
                className="accent-[var(--kv-accent,#e50914)]"
              />
              <input
                type="text"
                value={t.label}
                onChange={(e) =>
                  updateNav({
                    mobileTabs: nav.mobileTabs.map((mt, i) =>
                      i === idx ? { ...mt, label: e.target.value } : mt
                    ),
                  })
                }
                className="w-24 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
              />
              <input
                type="text"
                value={t.href}
                onChange={(e) =>
                  updateNav({
                    mobileTabs: nav.mobileTabs.map((mt, i) =>
                      i === idx ? { ...mt, href: e.target.value } : mt
                    ),
                  })
                }
                className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono text-[11px] dark:border-zinc-700"
              />
              <select
                value={t.icon}
                onChange={(e) =>
                  updateNav({
                    mobileTabs: nav.mobileTabs.map((mt, i) =>
                      i === idx ? { ...mt, icon: e.target.value as NavIconName } : mt
                    ),
                  })
                }
                className="rounded border border-zinc-300 bg-white px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {NAV_ICONS.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Columns, Socials, Copyright & Disclaimer */}
      <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Footer Columns</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New column title..."
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1 text-xs dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => {
                if (!newColTitle.trim()) return;
                updateFooter({
                  columns: [
                    ...footer.columns,
                    { id: `col-${Date.now().toString(36)}`, title: newColTitle.trim(), links: [] },
                  ],
                });
                setNewColTitle('');
              }}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold dark:border-zinc-700"
            >
              Add Column
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {footer.columns.map((col, cIdx) => (
            <div key={col.id} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 text-xs">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={col.title}
                  onChange={(e) =>
                    updateFooter({
                      columns: footer.columns.map((c, i) =>
                        i === cIdx ? { ...c, title: e.target.value } : c
                      ),
                    })
                  }
                  className="font-bold bg-transparent border-b border-transparent focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateFooter({ columns: footer.columns.filter((_, i) => i !== cIdx) })
                  }
                  className="text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {col.links.map((lnk, lIdx) => (
                <div key={lIdx} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={lnk.label}
                    onChange={(e) =>
                      updateFooter({
                        columns: footer.columns.map((c, i) =>
                          i === cIdx
                            ? {
                                ...c,
                                links: c.links.map((x, j) =>
                                  j === lIdx ? { ...x, label: e.target.value } : x
                                ),
                              }
                            : c
                        ),
                      })
                    }
                    className="w-24 rounded border border-zinc-300 bg-transparent px-1.5 py-0.5 text-[11px] dark:border-zinc-700"
                  />
                  <input
                    type="text"
                    value={lnk.href}
                    onChange={(e) =>
                      updateFooter({
                        columns: footer.columns.map((c, i) =>
                          i === cIdx
                            ? {
                                ...c,
                                links: c.links.map((x, j) =>
                                  j === lIdx ? { ...x, href: e.target.value } : x
                                ),
                              }
                            : c
                        ),
                      })
                    }
                    className="flex-1 rounded border border-zinc-300 bg-transparent px-1.5 py-0.5 font-mono text-[10px] dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateFooter({
                        columns: footer.columns.map((c, i) =>
                          i === cIdx ? { ...c, links: c.links.filter((_, j) => j !== lIdx) } : c
                        ),
                      })
                    }
                    className="text-rose-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateFooter({
                    columns: footer.columns.map((c, i) =>
                      i === cIdx
                        ? { ...c, links: [...c.links, { label: 'Page', href: '#/page/about' }] }
                        : c
                    ),
                  })
                }
                className="text-[11px] font-semibold text-[var(--kv-accent,#e50914)]"
              >
                + Add Link
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Copyright Text (supports {'{year}'})</label>
            <input
              type="text"
              value={footer.copyrightText}
              onChange={(e) => updateFooter({ copyrightText: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Social Icon Style</label>
            <select
              value={footer.socialIconStyle}
              onChange={(e) =>
                updateFooter({ socialIconStyle: e.target.value as 'outline' | 'filled' | 'minimal' })
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="outline">Outline Circles</option>
              <option value="filled">Filled Accent Badges</option>
              <option value="minimal">Minimal Icons</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">Footer Disclaimer Text</label>
          <textarea
            rows={2}
            value={footer.disclaimerText}
            onChange={(e) => updateFooter({ disclaimerText: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500">Social Channels</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => {
              const entry = footer.socialLinks.find((s) => s.platform === platform) ?? {
                platform,
                url: '',
                enabled: false,
              };
              const updateSocial = (patch: Partial<typeof entry>) => {
                const exists = footer.socialLinks.some((s) => s.platform === platform);
                const next = exists
                  ? footer.socialLinks.map((s) => (s.platform === platform ? { ...s, ...patch } : s))
                  : [...footer.socialLinks, { ...entry, ...patch }];
                updateFooter({ socialLinks: next });
              };
              return (
                <div key={platform} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => updateSocial({ enabled: e.target.checked })}
                    className="accent-[var(--kv-accent,#e50914)]"
                  />
                  <span className="w-20 font-semibold capitalize">{platform}</span>
                  <input
                    type="url"
                    placeholder={`https://${platform}.com/...`}
                    value={entry.url}
                    onChange={(e) => updateSocial({ url: e.target.value })}
                    className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 text-[11px] dark:border-zinc-700"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
