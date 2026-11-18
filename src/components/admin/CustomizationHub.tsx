import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Menu,
  Monitor,
  Palette,
  PlaySquare,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Shapes,
  Smartphone,
  Tablet,
  Type,
  Undo2,
} from 'lucide-react';
import { FULL_DEFAULT_SITE_SETTINGS } from '../../data/themePresets';
import type {
  ContactMessage,
  CustomPage,
  MovieItem,
  SiteSettings,
} from '../../types/streaming';
import { buildLinearGradientCss, mergeSiteSettings } from '../../utils/customization';
import {
  TabBranding,
  TabColorsTheme,
  TabHomeLayout,
  TabNavigationFooter,
  TabShapeStyle,
  TabTypography,
} from './CustomizationTabsA';
import {
  TabAdvanced,
  TabBannersPopups,
  TabCustomPages,
  TabPlayerCustom,
  TabSeoSocial,
} from './CustomizationTabsB';

type CustomizationTabId =
  | 'branding'
  | 'theme'
  | 'typography'
  | 'shape'
  | 'home'
  | 'navigation'
  | 'banners'
  | 'player'
  | 'seo'
  | 'pages'
  | 'advanced';

interface CustomizationHubProps {
  settings: SiteSettings;
  movies: MovieItem[];
  pages: CustomPage[];
  messages: ContactMessage[];
  saving: boolean;
  onChange: (updater: (prev: SiteSettings) => SiteSettings) => void;
  onSave: (nextSettings: SiteSettings) => Promise<void>;
  onSavePage: (page: CustomPage, isNew: boolean) => Promise<void>;
  onDeletePage: (pageId: string) => Promise<void>;
  onUpdateMessageStatus: (id: string, status: 'unread' | 'read' | 'archived') => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const TABS: {
  id: CustomizationTabId;
  label: string;
  keywords: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'branding',
    label: '1. Branding',
    keywords: 'logo tagline favicon pwa splash dark light brand site name',
    icon: <ImageIcon className="h-3.5 w-3.5" />,
  },
  {
    id: 'theme',
    label: '2. Colors & Theme',
    keywords: 'palette hex preset dark light gradient contrast wcag accent button',
    icon: <Palette className="h-3.5 w-3.5" />,
  },
  {
    id: 'typography',
    label: '3. Typography',
    keywords: 'font family google fonts inter poppins outfit heading weight spacing line height',
    icon: <Type className="h-3.5 w-3.5" />,
  },
  {
    id: 'shape',
    label: '4. Shape & Style',
    keywords: 'border radius sharp pill card poster ratio hover glow navbar sticky motion',
    icon: <Shapes className="h-3.5 w-3.5" />,
  },
  {
    id: 'home',
    label: '5. Home Layout',
    keywords: 'sections hero slider rows trending collections schedule carousel grid',
    icon: <LayoutTemplate className="h-3.5 w-3.5" />,
  },
  {
    id: 'navigation',
    label: '6. Nav & Footer',
    keywords: 'menu header search bar mobile tabs columns social copyright links',
    icon: <Menu className="h-3.5 w-3.5" />,
  },
  {
    id: 'banners',
    label: '7. Banners & Popups',
    keywords: 'announcement popup modal welcome maintenance countdown cookie gdpr consent',
    icon: <Megaphone className="h-3.5 w-3.5" />,
  },
  {
    id: 'player',
    label: '8. Video Player',
    keywords: 'watermark skip intro speed quality subtitles captions autoplay pip',
    icon: <PlaySquare className="h-3.5 w-3.5" />,
  },
  {
    id: 'seo',
    label: '9. SEO & Social',
    keywords: 'meta title description og image canonical analytics verification json-ld',
    icon: <Globe className="h-3.5 w-3.5" />,
  },
  {
    id: 'pages',
    label: '10. Custom Pages',
    keywords: 'about privacy terms contact form inbox messages html',
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  {
    id: 'advanced',
    label: '11. Advanced',
    keywords: 'custom css js safe mode export import backup feature flags i18n language',
    icon: <Code2 className="h-3.5 w-3.5" />,
  },
];

export const CustomizationHub: React.FC<CustomizationHubProps> = ({
  settings,
  movies,
  pages,
  messages,
  saving,
  onChange,
  onSave,
  onSavePage,
  onDeletePage,
  onUpdateMessageStatus,
  onDeleteMessage,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<CustomizationTabId>('branding');
  const [settingSearch, setSettingSearch] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const safeSettings = useMemo(() => mergeSiteSettings(settings), [settings]);

  // Undo / Redo stacks & Unsaved Changes tracking
  const [undoStack, setUndoStack] = useState<SiteSettings[]>([]);
  const [redoStack, setRedoStack] = useState<SiteSettings[]>([]);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState<string>(() =>
    JSON.stringify(mergeSiteSettings(settings))
  );

  const isDirty = useMemo(
    () => JSON.stringify(safeSettings) !== savedSnapshotJson,
    [safeSettings, savedSnapshotJson]
  );

  const lastTrackedJsonRef = useRef<string>(JSON.stringify(safeSettings));

  const trackedOnChange = (updater: (prev: SiteSettings) => SiteSettings) => {
    onChange((prev) => {
      const mergedPrev = mergeSiteSettings(prev);
      const next = mergeSiteSettings(updater(mergedPrev));
      const nextJson = JSON.stringify(next);
      if (nextJson !== lastTrackedJsonRef.current) {
        lastTrackedJsonRef.current = nextJson;
        setUndoStack((s) => [...s.slice(-19), mergedPrev]);
        setRedoStack([]);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevState = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, safeSettings]);
    lastTrackedJsonRef.current = JSON.stringify(prevState);
    onChange(() => prevState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u.slice(-19), safeSettings]);
    lastTrackedJsonRef.current = JSON.stringify(nextState);
    onChange(() => nextState);
  };

  const matchingTabs = useMemo(() => {
    const q = settingSearch.trim().toLowerCase();
    if (!q) return [];
    return TABS.filter(
      (t) => t.label.toLowerCase().includes(q) || t.keywords.toLowerCase().includes(q)
    );
  }, [settingSearch]);

  const previewHeroMovie = movies[0];
  const previewColors = safeSettings.theme?.colors;
  const previewRadius = safeSettings.shape?.cardRadius ?? 10;

  return (
    <div className="space-y-4">
      {/* Top Action & Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold">Site Customization Studio</h2>
              {isDirty && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved Draft
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Branding, palette, typography, home rows, player chrome, SEO, pages, and flags.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Tab Jump Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={settingSearch}
              onChange={(e) => setSettingSearch(e.target.value)}
              placeholder="Jump to setting..."
              className="w-44 rounded-lg border border-zinc-300 bg-transparent py-1.5 pl-8 pr-2.5 text-xs dark:border-zinc-700"
            />
            {matchingTabs.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-[#14141c]">
                {matchingTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(t.id);
                      setSettingSearch('');
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title="Undo last change"
            aria-label="Undo last customization change"
            className="rounded-lg border border-zinc-300 p-2 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            title="Redo change"
            aria-label="Redo customization change"
            className="rounded-lg border border-zinc-300 p-2 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Hide Preview' : 'Live Preview'}
          </button>

          <a
            href="/index.html?autostart=1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Site
          </a>

          <button
            type="button"
            onClick={() => {
              trackedOnChange(() => mergeSiteSettings(FULL_DEFAULT_SITE_SETTINGS));
              onNotify('Reset customization draft to defaults. Click Save Changes to publish.', 'info');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              await onSave(safeSettings);
              setSavedSnapshotJson(JSON.stringify(safeSettings));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Changes Live'}
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable 11-Tab Strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              activeTab === t.id
                ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)] text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:bg-[#13131c] dark:text-zinc-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor + Live Device Preview Split */}
      <div className={`grid gap-5 ${showPreview ? 'xl:grid-cols-12' : 'grid-cols-1'}`}>
        <div
          className={`rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c] ${
            showPreview ? 'xl:col-span-8' : ''
          }`}
        >
          {activeTab === 'branding' && (
            <TabBranding settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'theme' && (
            <TabColorsTheme settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'typography' && (
            <TabTypography settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'shape' && (
            <TabShapeStyle settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'home' && (
            <TabHomeLayout settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'navigation' && (
            <TabNavigationFooter settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'banners' && (
            <TabBannersPopups settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'player' && (
            <TabPlayerCustom settings={safeSettings} onChange={trackedOnChange} movies={movies} />
          )}
          {activeTab === 'seo' && (
            <TabSeoSocial
              settings={safeSettings}
              onChange={trackedOnChange}
              movies={movies}
              pages={pages}
            />
          )}
          {activeTab === 'pages' && (
            <TabCustomPages
              pages={pages}
              messages={messages}
              onSavePage={onSavePage}
              onDeletePage={onDeletePage}
              onUpdateMessageStatus={onUpdateMessageStatus}
              onDeleteMessage={onDeleteMessage}
            />
          )}
          {activeTab === 'advanced' && (
            <TabAdvanced
              settings={safeSettings}
              onChange={trackedOnChange}
              movies={movies}
              onNotify={onNotify}
            />
          )}
        </div>

        {/* Right Live Device Preview Panel */}
        {showPreview && (
          <aside className="xl:col-span-4">
            <div className="sticky top-20 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold">Live Portal Preview</span>
                <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
                  {(
                    [
                      { id: 'desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
                      { id: 'tablet', icon: <Tablet className="h-3.5 w-3.5" /> },
                      { id: 'mobile', icon: <Smartphone className="h-3.5 w-3.5" /> },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-label={`Preview ${d.id}`}
                      onClick={() => setPreviewDevice(d.id)}
                      className={`rounded-md p-1.5 ${
                        previewDevice === d.id
                          ? 'bg-[var(--kv-accent,#e50914)] text-white'
                          : 'text-zinc-500'
                      }`}
                    >
                      {d.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 p-2 dark:border-zinc-800">
                <div
                  style={{
                    width:
                      previewDevice === 'mobile'
                        ? '240px'
                        : previewDevice === 'tablet'
                        ? '340px'
                        : '100%',
                    backgroundColor: previewColors?.backgroundColor || '#0b0b0f',
                    color: previewColors?.textColor || '#f4f4f5',
                    fontFamily: safeSettings.typography?.bodyFont || 'Inter, sans-serif',
                  }}
                  className="overflow-hidden rounded-md border border-white/10 transition-all duration-200"
                >
                  {/* Simulated Navbar */}
                  <div
                    style={{
                      backgroundColor: previewColors?.navbarBgColor || '#111118',
                      borderColor: previewColors?.borderColor || 'rgba(255,255,255,0.1)',
                    }}
                    className={`flex items-center border-b px-3 py-2 text-[10px] ${
                      safeSettings.branding?.logoPosition === 'center'
                        ? 'justify-center'
                        : 'justify-between'
                    }`}
                  >
                    <span
                      style={{ fontFamily: safeSettings.typography?.headingFont || 'Outfit, sans-serif' }}
                      className="font-bold tracking-tight"
                    >
                      {safeSettings.logoUrl || safeSettings.branding?.logoLightUrl ? (
                        <img
                          src={safeSettings.logoUrl || safeSettings.branding?.logoLightUrl}
                          alt={safeSettings.siteName}
                          style={{ height: `${Math.min(24, (safeSettings.branding?.logoHeight ?? 28) * 0.65)}px` }}
                          className="w-auto object-contain"
                        />
                      ) : (
                        safeSettings.siteName
                      )}
                    </span>
                    {safeSettings.branding?.logoPosition !== 'center' && (
                      <span
                        style={{
                          backgroundColor: previewColors?.buttonBgColor || previewColors?.primaryColor || safeSettings.primaryColor,
                          color: previewColors?.buttonTextColor || '#fff',
                          borderRadius: `${Math.min(14, previewRadius)}px`,
                        }}
                        className="px-2 py-0.5 text-[9px] font-semibold"
                      >
                        Sign In
                      </span>
                    )}
                  </div>

                  {/* Simulated Hero */}
                  <div className="relative h-32 overflow-hidden bg-zinc-900 p-3 flex flex-col justify-end">
                    {previewHeroMovie && (
                      <img
                        src={previewHeroMovie.bannerUrl || previewHeroMovie.posterUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-55"
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: buildLinearGradientCss(safeSettings.theme?.heroGradient),
                        opacity: 0.78,
                      }}
                    />
                    <div className="relative z-10">
                      <p
                        style={{
                          fontFamily: safeSettings.typography?.headingFont || 'Outfit, sans-serif',
                        }}
                        className="text-xs font-bold leading-tight text-white"
                      >
                        {previewHeroMovie?.title || safeSettings.siteName}
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        <span
                          style={{
                            backgroundColor: previewColors?.buttonBgColor || previewColors?.primaryColor || safeSettings.primaryColor,
                            color: previewColors?.buttonTextColor || '#fff',
                            borderRadius: `${safeSettings.shape?.buttonRadius ?? 8}px`,
                          }}
                          className="px-2 py-0.5 text-[9px] font-semibold"
                        >
                          Play Now
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Cards Row */}
                  <div className="p-3 space-y-2">
                    <p className="text-[10px] font-semibold opacity-80">Trending Now</p>
                    <div className={`grid gap-2 ${previewDevice === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {movies.slice(0, previewDevice === 'mobile' ? 2 : 3).map((m) => (
                        <div
                          key={m.id}
                          style={{
                            backgroundColor: previewColors?.surfaceColor || '#13131c',
                            borderRadius: `${previewRadius}px`,
                            borderColor: previewColors?.borderColor || 'rgba(255,255,255,0.1)',
                          }}
                          className="overflow-hidden border"
                        >
                          <img
                            src={m.posterUrl}
                            alt=""
                            className={`w-full object-cover ${
                              safeSettings.shape?.posterRatio === '16:9'
                                ? 'aspect-video'
                                : safeSettings.shape?.posterRatio === '1:1'
                                ? 'aspect-square'
                                : 'aspect-[2/3]'
                            }`}
                          />
                          <p className="truncate p-1 text-[9px] font-medium">{m.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-zinc-400">
                Updates instantly as you edit branding, palette, radius, and typography.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
