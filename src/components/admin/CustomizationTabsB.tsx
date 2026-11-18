import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { DEFAULT_LANGUAGE_OPTIONS } from '../../data/themePresets';
import type {
  ContactMessage,
  CustomPage,
  MovieItem,
  SiteSettings,
  TargetPageKey,
} from '../../types/streaming';
import {
  validateCustomCodeSyntax,
  validateImportedSiteSettings,
} from '../../utils/customization';
import { generateRobotsTxt, generateSitemapXml } from '../../utils/seo';
import type { CustomizationTabProps } from './CustomizationTabsA';
import { ImageCropUploadField } from './ImageCropUploadField';
import { RichPageEditor } from './RichPageEditor';

const PAGE_TARGETS: { id: TargetPageKey; label: string }[] = [
  { id: 'all', label: 'All Pages' },
  { id: 'home', label: 'Home' },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'plans', label: 'Plans' },
  { id: 'watch', label: 'Watch / Details' },
  { id: 'page', label: 'Custom Pages' },
];

export const TabBannersPopups: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const ann = settings.announcement;
  const popup = settings.popup!;
  const maint = settings.maintenance!;
  const cookie = settings.cookieConsent!;

  const updateAnn = (patch: Partial<typeof ann>) =>
    onChange((s) => ({ ...s, announcement: { ...s.announcement, ...patch } }));
  const updatePopup = (patch: Partial<typeof popup>) =>
    onChange((s) => ({ ...s, popup: { ...s.popup!, ...patch } }));
  const updateMaint = (patch: Partial<typeof maint>) =>
    onChange((s) => ({ ...s, maintenance: { ...s.maintenance!, ...patch } }));
  const updateCookie = (patch: Partial<typeof cookie>) =>
    onChange((s) => ({ ...s, cookieConsent: { ...s.cookieConsent!, ...patch } }));

  const targets = ann.targetPages ?? ['all'];

  return (
    <div className="space-y-6">
      {/* Announcement Bar */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Announcement Bar</p>
          <input
            type="checkbox"
            checked={ann.isActive}
            onChange={(e) => updateAnn({ isActive: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={ann.text}
            onChange={(e) => updateAnn({ text: e.target.value })}
            placeholder="Announcement message..."
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
          <input
            type="text"
            value={ann.link ?? ''}
            onChange={(e) => updateAnn({ link: e.target.value })}
            placeholder="Optional link (#/plans or https://...)"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 text-zinc-500">Background</span>
            <input
              type="color"
              value={ann.bgColor || '#e50914'}
              onChange={(e) => updateAnn({ bgColor: e.target.value })}
              className="h-8 w-10 rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
            />
            <input
              type="text"
              value={ann.bgColor || '#e50914'}
              onChange={(e) => updateAnn({ bgColor: e.target.value })}
              className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono dark:border-zinc-700"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 text-zinc-500">Text Color</span>
            <input
              type="color"
              value={ann.textColor || '#ffffff'}
              onChange={(e) => updateAnn({ textColor: e.target.value })}
              className="h-8 w-10 rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
            />
            <input
              type="text"
              value={ann.textColor || '#ffffff'}
              onChange={(e) => updateAnn({ textColor: e.target.value })}
              className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono dark:border-zinc-700"
            />
          </div>
          <label className="text-xs">
            <span className="mb-1 block text-zinc-500">Schedule Start</span>
            <input
              type="datetime-local"
              value={ann.startAt ?? ''}
              onChange={(e) => updateAnn({ startAt: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 dark:border-zinc-700"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-zinc-500">Schedule End</span>
            <input
              type="datetime-local"
              value={ann.endAt ?? ''}
              onChange={(e) => updateAnn({ endAt: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 dark:border-zinc-700"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500">Show on:</span>
            {PAGE_TARGETS.map((pt) => {
              const checked = targets.includes(pt.id);
              return (
                <label key={pt.id} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...targets, pt.id]
                        : targets.filter((t) => t !== pt.id);
                      updateAnn({ targetPages: next.length ? next : ['all'] });
                    }}
                    className="accent-[var(--kv-accent,#e50914)]"
                  />
                  <span>{pt.label}</span>
                </label>
              );
            })}
          </div>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={ann.dismissible ?? true}
              onChange={(e) => updateAnn({ dismissible: e.target.checked })}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            <span>Allow visitor to dismiss</span>
          </label>
        </div>
      </div>

      {/* Popup Manager */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Popup Manager (Welcome / Promo / App Install)</p>
          <input
            type="checkbox"
            checked={popup.enabled}
            onChange={(e) => updatePopup({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div>
            <label className="mb-1 block text-zinc-500">Popup Type</label>
            <select
              value={popup.type}
              onChange={(e) => updatePopup({ type: e.target.value as 'welcome' | 'promo' | 'app-install' })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="welcome">Welcome Popup</option>
              <option value="promo">Promo Offer Popup</option>
              <option value="app-install">PWA App Install Prompt</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-zinc-500">Display Frequency</label>
            <select
              value={popup.frequency}
              onChange={(e) => updatePopup({ frequency: e.target.value as 'once' | 'session' | 'daily' })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="once">Once per device</option>
              <option value="session">Once per browser session</option>
              <option value="daily">Once per day</option>
            </select>
          </div>
          <input
            type="text"
            value={popup.title}
            onChange={(e) => updatePopup({ title: e.target.value })}
            placeholder="Popup title"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <input
            type="text"
            value={popup.buttonLabel}
            onChange={(e) => updatePopup({ buttonLabel: e.target.value })}
            placeholder="CTA Button Label"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <input
            type="text"
            value={popup.buttonHref}
            onChange={(e) => updatePopup({ buttonHref: e.target.value })}
            placeholder="CTA Target (#/plans or #/movies)"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={popup.startAt ?? ''}
              onChange={(e) => updatePopup({ startAt: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
            />
            <input
              type="datetime-local"
              value={popup.endAt ?? ''}
              onChange={(e) => updatePopup({ endAt: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
            />
          </div>
        </div>
        <textarea
          rows={2}
          value={popup.text}
          onChange={(e) => updatePopup({ text: e.target.value })}
          placeholder="Popup description..."
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
        />
        <ImageCropUploadField
          label="Popup Feature Image (Optional)"
          value={popup.imageUrl}
          onChange={(url) => updatePopup({ imageUrl: url })}
          aspectRatio={16 / 9}
          storageKeyPrefix="popup-cover"
        />
      </div>

      {/* Maintenance Mode */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Maintenance Mode (Admin Bypass Enabled)</p>
            <p className="text-xs text-zinc-500">Non-admin visitors see this screen while admins still access `/admin.html` &amp; preview.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => onChange((s) => ({ ...s, maintenanceMode: e.target.checked }))}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <input
            type="text"
            value={maint.message}
            onChange={(e) => updateMaint({ message: e.target.value })}
            placeholder="Maintenance notice message..."
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <input
            type="text"
            value={maint.expectedReturnTime}
            onChange={(e) => updateMaint({ expectedReturnTime: e.target.value })}
            placeholder="Expected return time (e.g., Today 11:00 PM UTC)"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <ImageCropUploadField
          label="Maintenance Illustration (Optional)"
          value={maint.imageUrl}
          onChange={(url) => updateMaint({ imageUrl: url })}
          aspectRatio={16 / 9}
          storageKeyPrefix="maintenance-img"
        />
      </div>

      {/* Cookie Consent */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Cookie Consent Banner</p>
          <input
            type="checkbox"
            checked={cookie.enabled}
            onChange={(e) => updateCookie({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <input
          type="text"
          value={cookie.text}
          onChange={(e) => updateCookie({ text: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
        />
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <input
            type="text"
            value={cookie.linkLabel}
            onChange={(e) => updateCookie({ linkLabel: e.target.value })}
            placeholder="Link text (e.g., Privacy Policy)"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <input
            type="text"
            value={cookie.linkHref}
            onChange={(e) => updateCookie({ linkHref: e.target.value })}
            placeholder="Link target (#/page/privacy)"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
          />
        </div>
      </div>
    </div>
  );
};

export const TabPlayerCustom: React.FC<CustomizationTabProps> = ({ settings, onChange }) => {
  const pl = settings.player!;
  const updatePlayer = (patch: Partial<typeof pl>) =>
    onChange((s) => ({ ...s, player: { ...s.player!, ...patch } }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3 text-xs">
        <div>
          <label className="mb-1 block text-zinc-500">Player Accent Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={pl.accentColor}
              onChange={(e) => updatePlayer({ accentColor: e.target.value })}
              className="h-8 w-10 rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
            />
            <input
              type="text"
              value={pl.accentColor}
              onChange={(e) => updatePlayer({ accentColor: e.target.value })}
              className="flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono dark:border-zinc-700"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Control Bar Layout</label>
          <select
            value={pl.controlBarStyle}
            onChange={(e) => updatePlayer({ controlBarStyle: e.target.value as 'compact' | 'full' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="full">Full Cinema Controls</option>
            <option value="compact">Compact Minimal Controls</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Default Quality</label>
          <select
            value={pl.defaultQuality}
            onChange={(e) => updatePlayer({ defaultQuality: e.target.value as '1080p' | '720p' | 'auto' })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="1080p">1080p HD</option>
            <option value="720p">720p</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Default Playback Speed</label>
          <select
            value={pl.defaultSpeed}
            onChange={(e) => updatePlayer({ defaultSpeed: Number(e.target.value) })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((sp) => (
              <option key={sp} value={sp}>{sp}x</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Default Subtitle Language</label>
          <select
            value={pl.defaultSubtitleLang}
            onChange={(e) => updatePlayer({ defaultSubtitleLang: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="off">Off</option>
            <option value="en">English (en)</option>
            <option value="es">Español (es)</option>
            <option value="de">Deutsch (de)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 flex justify-between text-zinc-500">
            <span>Up-Next Countdown</span>
            <span className="font-mono">{pl.countdownSeconds}s</span>
          </label>
          <input
            type="range"
            min="3"
            max="15"
            value={pl.countdownSeconds}
            onChange={(e) => updatePlayer({ countdownSeconds: Number(e.target.value) })}
            className="w-full accent-[var(--kv-accent,#e50914)]"
          />
        </div>
      </div>

      {/* Player Toggles */}
      <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3 text-xs">
        <label className="flex items-center justify-between">
          <span>Autoplay Next Episode</span>
          <input type="checkbox" checked={pl.autoplayNext} onChange={(e) => updatePlayer({ autoplayNext: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
        <label className="flex items-center justify-between">
          <span>Show &quot;Skip Intro&quot; Button</span>
          <input type="checkbox" checked={pl.showSkipIntro} onChange={(e) => updatePlayer({ showSkipIntro: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
        <label className="flex items-center justify-between">
          <span>Picture-in-Picture (PiP)</span>
          <input type="checkbox" checked={pl.enablePiP} onChange={(e) => updatePlayer({ enablePiP: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
        <label className="flex items-center justify-between">
          <span>Show Download Button (MP4)</span>
          <input type="checkbox" checked={pl.showDownloadButton} onChange={(e) => updatePlayer({ showDownloadButton: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
        <label className="flex items-center justify-between">
          <span>Speed Selector Control</span>
          <input type="checkbox" checked={pl.enableSpeedControl} onChange={(e) => updatePlayer({ enableSpeedControl: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
        <label className="flex items-center justify-between">
          <span>Keyboard Shortcuts (Space, K, F, M)</span>
          <input type="checkbox" checked={pl.enableKeyboardShortcuts} onChange={(e) => updatePlayer({ enableKeyboardShortcuts: e.target.checked })} className="accent-[var(--kv-accent,#e50914)]" />
        </label>
      </div>

      {/* Watermark Overlay */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 text-xs">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Watermark Overlay</p>
          <input
            type="checkbox"
            checked={pl.watermarkEnabled}
            onChange={(e) => updatePlayer({ watermarkEnabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--kv-accent,#e50914)]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={pl.watermarkMode}
            onChange={(e) => updatePlayer({ watermarkMode: e.target.value as 'text' | 'image' })}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="text">Text Watermark</option>
            <option value="image">Image Logo Watermark</option>
          </select>
          <input
            type="text"
            value={pl.watermarkText}
            onChange={(e) => updatePlayer({ watermarkText: e.target.value })}
            placeholder="Watermark text..."
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <select
            value={pl.watermarkPosition}
            onChange={(e) =>
              updatePlayer({
                watermarkPosition: e.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
              })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
          <div>
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Opacity</span>
              <span className="font-mono">{Math.round(pl.watermarkOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={pl.watermarkOpacity}
              onChange={(e) => updatePlayer({ watermarkOpacity: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </div>
        </div>
        {pl.watermarkMode === 'image' && (
          <ImageCropUploadField
            label="Watermark Logo Image"
            value={pl.watermarkImageUrl}
            onChange={(url) => updatePlayer({ watermarkImageUrl: url })}
            storageKeyPrefix="player-watermark"
          />
        )}
      </div>

      {/* Subtitles & Custom Loading Screen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 text-xs">
          <p className="text-sm font-semibold">Subtitle Typography &amp; Position</p>
          <label className="block">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Font Size</span>
              <span className="font-mono">{pl.subtitleFontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="28"
              value={pl.subtitleFontSize}
              onChange={(e) => updatePlayer({ subtitleFontSize: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between text-zinc-500">
              <span>Backdrop Opacity</span>
              <span className="font-mono">{Math.round(pl.subtitleBgOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={pl.subtitleBgOpacity}
              onChange={(e) => updatePlayer({ subtitleBgOpacity: Number(e.target.value) })}
              className="w-full accent-[var(--kv-accent,#e50914)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-zinc-500">Subtitle Color</span>
              <input
                type="color"
                value={pl.subtitleColor}
                onChange={(e) => updatePlayer({ subtitleColor: e.target.value })}
                className="h-8 w-full rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
              />
            </div>
            <div>
              <span className="mb-1 block text-zinc-500">Position</span>
              <select
                value={pl.subtitlePosition}
                onChange={(e) => updatePlayer({ subtitlePosition: e.target.value as 'bottom' | 'top' })}
                className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="bottom">Bottom</option>
                <option value="top">Top</option>
              </select>
            </div>
          </div>
        </div>

        <ImageCropUploadField
          label="Custom Player Loading Poster"
          hint="Shown briefly as player cover before playback begins."
          value={pl.loadingImageUrl}
          onChange={(url) => updatePlayer({ loadingImageUrl: url })}
          aspectRatio={16 / 9}
          storageKeyPrefix="player-loading"
        />
      </div>
    </div>
  );
};

interface TabSeoProps extends CustomizationTabProps {
  pages: CustomPage[];
}

export const TabSeoSocial: React.FC<TabSeoProps> = ({ settings, onChange, movies, pages }) => {
  const seo = settings.seo!;
  const [previewDoc, setPreviewDoc] = useState<'sitemap' | 'robots' | null>(null);

  const updateSeo = (patch: Partial<typeof seo>) =>
    onChange((s) => ({ ...s, seo: { ...s.seo!, ...patch } }));

  const baseUrl = seo.canonicalBaseUrl.trim() || window.location.origin;
  const sitemapContent = generateSitemapXml(baseUrl, movies, pages);
  const robotsContent = generateRobotsTxt(baseUrl);

  const downloadText = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 text-xs">
        <div>
          <label className="mb-1 block text-zinc-500">Meta Title Template</label>
          <input
            type="text"
            value={seo.metaTitleTemplate}
            onChange={(e) => updateSeo({ metaTitleTemplate: e.target.value })}
            placeholder="{title} | {siteName}"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Canonical Base URL</label>
          <input
            type="url"
            value={seo.canonicalBaseUrl}
            onChange={(e) => updateSeo({ canonicalBaseUrl: e.target.value })}
            placeholder="https://yourdomain.com"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-zinc-500">Default Meta Description</label>
          <textarea
            rows={2}
            value={seo.description}
            onChange={(e) => updateSeo({ description: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-zinc-500">Meta Keywords (comma-separated)</label>
          <input
            type="text"
            value={seo.keywords}
            onChange={(e) => updateSeo({ keywords: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Google Analytics ID (G-XXXXXXXXXX)</label>
          <input
            type="text"
            value={seo.googleAnalyticsId}
            onChange={(e) => updateSeo({ googleAnalyticsId: e.target.value })}
            placeholder="G-..."
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-zinc-500">Google Search Console Verification Code</label>
          <input
            type="text"
            value={seo.searchConsoleVerification}
            onChange={(e) => updateSeo({ searchConsoleVerification: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
          />
        </div>
      </div>

      <ImageCropUploadField
        label="Default Social Share OG / Twitter Image (16:9)"
        hint="Used when sharing links on social platforms."
        value={seo.ogImageUrl}
        onChange={(url) => updateSeo({ ogImageUrl: url })}
        aspectRatio={16 / 9}
        maxOutputWidth={1200}
        maxOutputHeight={630}
        storageKeyPrefix="seo-og"
      />

      <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 text-xs">
        <label className="flex items-center justify-between">
          <span>Use Title Poster / Banner as OG Image on Movie Pages</span>
          <input
            type="checkbox"
            checked={seo.useTitlePosterForOg}
            onChange={(e) => updateSeo({ useTitlePosterForOg: e.target.checked })}
            className="accent-[var(--kv-accent,#e50914)]"
          />
        </label>
        <label className="flex items-center justify-between">
          <span>Inject Schema.org JSON-LD (Movie / TVSeries / WebSite)</span>
          <input
            type="checkbox"
            checked={seo.enableJsonLd}
            onChange={(e) => updateSeo({ enableJsonLd: e.target.checked })}
            className="accent-[var(--kv-accent,#e50914)]"
          />
        </label>
      </div>

      {/* Auto-generated Sitemap & Robots */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">Auto-Generated Sitemap &amp; Robots.txt</p>
            <p className="text-[11px] text-zinc-500">Includes {movies.filter((m) => m.status === 'published').length} published titles and {pages.filter((p) => p.status === 'published').length} published pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreviewDoc((d) => (d === 'sitemap' ? null : 'sitemap'))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700"
            >
              Preview sitemap.xml
            </button>
            <button
              type="button"
              onClick={() => downloadText('sitemap.xml', sitemapContent, 'application/xml')}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--kv-accent,#e50914)] px-3 py-1 text-xs font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" /> sitemap.xml
            </button>
            <button
              type="button"
              onClick={() => setPreviewDoc((d) => (d === 'robots' ? null : 'robots'))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700"
            >
              Preview robots.txt
            </button>
            <button
              type="button"
              onClick={() => downloadText('robots.txt', robotsContent, 'text/plain')}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700"
            >
              <Download className="h-3.5 w-3.5" /> robots.txt
            </button>
          </div>
        </div>

        {previewDoc && (
          <pre className="max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200">
            {previewDoc === 'sitemap' ? sitemapContent : robotsContent}
          </pre>
        )}
      </div>
    </div>
  );
};

interface TabCustomPagesProps {
  pages: CustomPage[];
  messages: ContactMessage[];
  onSavePage: (page: CustomPage, isNew: boolean) => Promise<void>;
  onDeletePage: (pageId: string) => Promise<void>;
  onUpdateMessageStatus: (id: string, status: 'unread' | 'read' | 'archived') => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
}

export const TabCustomPages: React.FC<TabCustomPagesProps> = (props) => {
  return <RichPageEditor {...props} />;
};

interface TabAdvancedProps extends CustomizationTabProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TabAdvanced: React.FC<TabAdvancedProps> = ({ settings, onChange, onNotify }) => {
  const custom = settings.customCode!;
  const ads = settings.ads!;
  const i18n = settings.i18n!;
  const flags = settings.featureFlags!;
  const importRef = useRef<HTMLInputElement | null>(null);
  const [editLang, setEditLang] = useState(i18n.defaultLanguage || 'en');

  const syntax = validateCustomCodeSyntax(custom.customCss, custom.customJs);
  const labelKeys = Object.keys(i18n.labels.en || {});

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(settings.siteName || 'kinovault').toLowerCase().replace(/\s+/g, '-')}-customization.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const res = validateImportedSiteSettings(text);
    if (!res.valid || !res.settings) {
      onNotify(res.error || 'Invalid customization JSON.', 'error');
      return;
    }
    onChange(() => res.settings!);
    onNotify('Imported customization JSON — click Save Changes to publish live.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Custom CSS & JS with Safe Mode */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">Custom CSS &amp; JavaScript Injection</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            <input
              type="checkbox"
              checked={custom.safeMode}
              onChange={(e) =>
                onChange((s) => ({
                  ...s,
                  customCode: { ...s.customCode!, safeMode: e.target.checked },
                }))
              }
              className="accent-amber-500"
            />
            Safe Mode (Disable All Custom Code)
          </label>
        </div>

        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Security Warning: Custom JS executes directly in visitors&apos; browsers. Only paste trusted scripts and disable Safe Mode when ready.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-zinc-500">
              <span>Custom CSS</span>
              {syntax.cssError ? (
                <span className="text-rose-500">{syntax.cssError}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> Valid
                </span>
              )}
            </label>
            <textarea
              rows={5}
              value={custom.customCss}
              onChange={(e) =>
                onChange((s) => ({
                  ...s,
                  customCode: { ...s.customCode!, customCss: e.target.value },
                }))
              }
              placeholder=".hero-title { letter-spacing: -0.02em; }"
              className="w-full rounded-lg border border-zinc-300 bg-transparent p-2.5 font-mono text-xs dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-zinc-500">
              <span>Custom JavaScript</span>
              {syntax.jsError ? (
                <span className="text-rose-500">{syntax.jsError}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> Syntax OK
                </span>
              )}
            </label>
            <textarea
              rows={5}
              value={custom.customJs}
              onChange={(e) =>
                onChange((s) => ({
                  ...s,
                  customCode: { ...s.customCode!, customJs: e.target.value },
                }))
              }
              placeholder="console.log('Analytics ready');"
              className="w-full rounded-lg border border-zinc-300 bg-transparent p-2.5 font-mono text-xs dark:border-zinc-700"
            />
          </div>
        </div>
      </div>

      {/* Ad Placements */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold">Ad Placement Controls</p>
        <p className="text-xs text-zinc-500">
          Every placement is disabled by default. The Below Video Player slot strictly never renders on user pages unless explicitly turned ON.
        </p>
        <div className="grid gap-3 md:grid-cols-2 text-xs">
          {([
            ['header', 'Header Banner Slot'],
            ['betweenRows', 'Between Home Rows Slot'],
            ['sidebar', 'Sidebar / Detail Column Slot'],
            ['belowPlayer', 'Below Video Player Slot (Strict Opt-In)'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <label className="flex items-center justify-between font-semibold">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={ads[key].enabled}
                  onChange={(e) =>
                    onChange((s) => ({
                      ...s,
                      ads: {
                        ...s.ads!,
                        [key]: { ...s.ads![key], enabled: e.target.checked },
                      },
                    }))
                  }
                  className="accent-[var(--kv-accent,#e50914)]"
                />
              </label>
              <textarea
                rows={2}
                value={ads[key].snippet}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    ads: {
                      ...s.ads!,
                      [key]: { ...s.ads![key], snippet: e.target.value },
                    },
                  }))
                }
                placeholder="Safe HTML banner / promo markup..."
                className="w-full rounded border border-zinc-300 bg-transparent p-2 font-mono text-[11px] dark:border-zinc-700"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Language / i18n Labels */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Multi-Language UI Labels</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Default Site Language</span>
              <select
                value={i18n.defaultLanguage}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    i18n: { ...s.i18n!, defaultLanguage: e.target.value },
                  }))
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {DEFAULT_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Editing Labels For</span>
              <select
                value={editLang}
                onChange={(e) => setEditLang(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {DEFAULT_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {labelKeys.map((k) => {
            const val = i18n.labels[editLang]?.[k] ?? i18n.labels.en?.[k] ?? '';
            return (
              <label key={k} className="flex flex-col gap-1 rounded border border-zinc-200 p-2 dark:border-zinc-800">
                <span className="font-mono text-[10px] text-zinc-500">{k}</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) =>
                    onChange((s) => ({
                      ...s,
                      i18n: {
                        ...s.i18n!,
                        labels: {
                          ...s.i18n!.labels,
                          [editLang]: {
                            ...(s.i18n!.labels[editLang] ?? {}),
                            [k]: e.target.value,
                          },
                        },
                      },
                    }))
                  }
                  className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 text-xs">
        <p className="text-sm font-semibold">Platform Feature Toggles</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['comments', 'User Comments & Reviews'],
            ['ratings', 'Star Ratings'],
            ['watchlist', 'Personal Watchlist (My List)'],
            ['registration', 'Allow New Registrations'],
            ['socialLogin', 'Google Sign-In Button'],
            ['premiumSection', 'Monthly Subscription Plans Page'],
            ['reports', 'Issue / Broken Link Reporting'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={flags[key]}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    allowRegistration: key === 'registration' ? e.target.checked : s.allowRegistration,
                    featureFlags: { ...s.featureFlags!, [key]: e.target.checked },
                  }))
                }
                className="accent-[var(--kv-accent,#e50914)]"
              />
            </label>
          ))}
        </div>
      </div>

      {/* JSON Backup Import / Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">Import / Export Full Customization JSON</p>
          <p className="text-xs text-zinc-500">Download a portable backup or restore a validated JSON preset.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
        </div>
      </div>

      {syntax.cssError || syntax.jsError ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="h-4 w-4" /> Fix syntax issues before disabling Safe Mode.
        </p>
      ) : null}
    </div>
  );
};
