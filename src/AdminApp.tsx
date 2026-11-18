import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Copy,
  Crown,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Film,
  Flag,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Tv,
  Users,
  X,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAILS,
  deleteAdminUserDoc,
  deleteBannerDoc,
  deleteCommentDoc,
  deleteContactMessageDoc,
  deleteCustomPageDoc,
  deleteGenreDoc,
  deleteMovieDoc,
  deletePlanDoc,
  fetchAllAdminData,
  isUserAdmin,
  saveBannerDoc,
  saveCustomPageDoc,
  saveGenreDoc,
  saveMovieDoc,
  savePlanDoc,
  saveSiteSettingsDoc,
  seedCatalogToFirestore,
  seedHybridAccessDemoToFirestore,
  signInWithEmail,
  signInWithGooglePopup,
  signOutUser,
  syncUserProfileOnLogin,
  testFirestoreConnection,
  toggleCommentVisibility,
  updateAdminUserDoc,
  updateContactMessageStatus,
  updateReportStatus,
  uploadFileWithProgress,
} from './lib/firebase';
import {
  DEFAULT_SITE_SETTINGS,
  SEED_BANNERS,
  SEED_GENRES,
  SEED_HYBRID_BANNERS,
  SEED_HYBRID_MOVIES,
  SEED_MOVIES,
  SEED_PAGES,
  SEED_PLANS,
} from './data/seedCatalog';
import { DEFAULT_AD_SETTINGS, SEED_CUSTOM_ADS, SEED_VAST_ADS } from './data/seedAds';
import {
  deleteCustomAdDoc,
  deleteVastAdDoc,
  fetchAllAdsAdminData,
  saveAdSettings,
  saveCustomAdDoc,
  saveVastAdDoc,
  seedSampleAdsToFirestore,
} from './lib/adsFirebase';
import type {
  ActivityLogItem,
  AdEventItem,
  AdGlobalSettings,
  BannerItem,
  CommentItem,
  ContactMessage,
  CustomAdItem,
  CustomPage,
  GenreItem,
  MovieItem,
  ReportItem,
  SiteSettings,
  SubscriptionPlan,
  UserProfile,
  VastAdItem,
} from './types/streaming';
import {
  calculateDashboardStats,
  exportUsersToCsv,
  formatCompactNumber,
  formatMonthlyPrice,
  formatRelativeTime,
  slugify,
  validateSubscriptionPlanDraft,
} from './utils/catalog';
import { ConfirmDialog } from './components/ui/Modal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { AdManagementHub, type AdsSubSection } from './components/admin/AdManagementHub';
import { AccessManagerView } from './components/admin/AccessManagerView';
import { AdminCharts } from './components/admin/AdminCharts';
import { CustomizationHub } from './components/admin/CustomizationHub';
import { EpisodesManager } from './components/admin/EpisodesManager';
import { MovieFormModal } from './components/admin/MovieFormModal';

type AdminTab =
  | 'dashboard'
  | 'movies'
  | 'subscriptions'
  | 'access_manager'
  | 'episodes'
  | 'genres'
  | 'banners'
  | 'ads_overview'
  | 'ads_custom'
  | 'ads_vast'
  | 'ads_settings'
  | 'ads_reports'
  | 'users'
  | 'comments'
  | 'reports'
  | 'settings'
  | 'logs';

function AdminShell() {
  const { notify } = useToast();
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [demoPreviewMode, setDemoPreviewMode] = useState(false);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const isDemoPreview = demoPreviewMode && adminProfile?.uid === 'studio-preview-admin';

  const navigateToUserPanel = () => {
    if (window.location.pathname.includes('admin.html')) {
      window.location.href = '/index.html';
    } else {
      window.location.hash = '#/';
    }
  };

  const enterDemoPreview = () => {
    const mergedMovies = [
      ...SEED_HYBRID_MOVIES,
      ...SEED_MOVIES.filter((m) => !SEED_HYBRID_MOVIES.some((h) => h.id === m.id)),
    ];
    const mergedBanners = [
      ...SEED_HYBRID_BANNERS,
      ...SEED_BANNERS.filter((b) => !SEED_HYBRID_BANNERS.some((h) => h.id === b.id)),
    ];
    setMovies(mergedMovies);
    setGenres(SEED_GENRES);
    setBanners(mergedBanners);
    setPlans(SEED_PLANS);
    setPages(SEED_PAGES);
    setCustomAds(SEED_CUSTOM_ADS);
    setVastAds(SEED_VAST_ADS);
    setAdSettings(DEFAULT_AD_SETTINGS);
    setSettings(DEFAULT_SITE_SETTINGS);
    setBannerMovieId(mergedMovies[0]?.id ?? '');
    setBannerImageUrl(mergedMovies[0]?.bannerUrl || mergedMovies[0]?.posterUrl || '');
    setAccessDeniedMsg('');
    setDemoPreviewMode(true);
    setAdminProfile({
      uid: 'studio-preview-admin',
      displayName: 'Studio Preview Admin',
      email: 'sarikac31@gmail.com',
      photoURL: '',
      role: 'admin',
      status: 'active',
      plan: 'premium',
      subscriptionPlanId: 'plan-cinema-plus',
      subscriptionPlanName: 'Cinema Plus',
      planExpiresAt: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    });
    notify('Entered Studio Preview Mode (local demo data)', 'info');
  };

  // Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Admin datasets
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [pages, setPages] = useState<CustomPage[]>(SEED_PAGES);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [customAds, setCustomAds] = useState<CustomAdItem[]>([]);
  const [vastAds, setVastAds] = useState<VastAdItem[]>([]);
  const [adEvents, setAdEvents] = useState<AdEventItem[]>([]);
  const [adSettings, setAdSettings] = useState<AdGlobalSettings>(DEFAULT_AD_SETTINGS);

  // Movies table state
  const [movieSearch, setMovieSearch] = useState('');
  const [movieTypeFilter, setMovieTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [movieStatusFilter, setMovieStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<string>>(new Set());
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);
  const [deletingMovie, setDeletingMovie] = useState<MovieItem | null>(null);

  // Subscriptions manager state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('9.99');
  const [planCurrency, setPlanCurrency] = useState('USD');
  const [planDescription, setPlanDescription] = useState('');
  const [planFeaturesInput, setPlanFeaturesInput] = useState('');
  const [planBadgeColor, setPlanBadgeColor] = useState('#e50914');
  const [planIsActive, setPlanIsActive] = useState(true);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  // Genres form state
  const [newGenreName, setNewGenreName] = useState('');

  // Banners form state
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerMovieId, setBannerMovieId] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerAdMode, setBannerAdMode] = useState<'inherit' | 'specific_ad_ids'>('inherit');
  const [bannerUnlockAdIds, setBannerUnlockAdIds] = useState<string[]>([]);

  // Users filters
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'user' | 'admin'>('all');

  // Reports filter
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Logs filter
  const [logSearch, setLogSearch] = useState('');

  // Settings / Customization form state
  const [savingSettings, setSavingSettings] = useState(false);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('kv_theme', next);
    } catch {}
  };

  useEffect(() => {
    if (settings.primaryColor) {
      document.documentElement.style.setProperty('--kv-accent', settings.primaryColor);
    }
  }, [settings.primaryColor]);

  const loadAllAdmin = async () => {
    setLoadingData(true);
    try {
      const [data, adsData] = await Promise.all([
        fetchAllAdminData(),
        fetchAllAdsAdminData(),
      ]);
      setMovies(data.movies.length > 0 ? data.movies : SEED_MOVIES);
      setGenres(data.genres.length > 0 ? data.genres : SEED_GENRES);
      setBanners(data.banners.length > 0 ? data.banners : SEED_BANNERS);
      setPlans(data.plans.length > 0 ? data.plans : SEED_PLANS);
      setUsers(data.users);
      setComments(data.comments);
      setReports(data.reports);
      setPages(data.pages.length > 0 ? data.pages : SEED_PAGES);
      setMessages(data.messages);
      setLogs(data.logs);
      setSettings(data.settings);
      setCustomAds(adsData.customAds);
      setVastAds(adsData.vastAds);
      setAdEvents(adsData.adEvents);
      setAdSettings(adsData.adSettings);
      if (data.movies[0] && !bannerMovieId) {
        setBannerMovieId(data.movies[0].id);
        setBannerImageUrl(data.movies[0].bannerUrl || data.movies[0].posterUrl);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load admin data.', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (!u) {
        setAdminProfile(null);
        setAuthReady(true);
        return;
      }
      try {
        const prof = await syncUserProfileOnLogin(u);
        if (!isUserAdmin(prof, u)) {
          setAccessDeniedMsg(
            `Account "${u.email}" does not have admin privileges. Signed out automatically.`
          );
          await signOutUser();
          setAdminProfile(null);
          setAuthReady(true);
          return;
        }
        setAccessDeniedMsg('');
        setAdminProfile(prof);
        setAuthReady(true);
        await loadAllAdmin();
      } catch (err) {
        setAccessDeniedMsg(
          err instanceof Error ? err.message : 'Unable to verify administrator role.'
        );
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  const stats = useMemo(
    () => calculateDashboardStats(movies, users, reports),
    [movies, users, reports]
  );

  const filteredMovies = useMemo(() => {
    const q = movieSearch.trim().toLowerCase();
    return movies.filter((m) => {
      if (movieTypeFilter !== 'all' && m.type !== movieTypeFilter) return false;
      if (movieStatusFilter !== 'all' && m.status !== movieStatusFilter) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.slug.includes(q)) return false;
      return true;
    });
  }, [movies, movieSearch, movieTypeFilter, movieStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userPlanFilter !== 'all' && u.plan !== userPlanFilter) return false;
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (
        q &&
        !u.displayName.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [users, userSearch, userPlanFilter, userRoleFilter]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => reportFilter === 'all' || r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter(
      (l) => !q || l.action.toLowerCase().includes(q) || l.targetId.toLowerCase().includes(q)
    );
  }, [logs, logSearch]);

  const moviesMap = useMemo(() => {
    const map: Record<string, MovieItem> = {};
    movies.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [movies]);

  // Auth Login Gate
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-zinc-400">
        Verifying administrator session...
      </div>
    );
  }

  if (!adminProfile || (!demoPreviewMode && !authUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-[#0b0b0f]">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-[#13131c]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[var(--kv-accent,#e50914)]" />
              <span className="font-display text-lg font-bold">KinoVault Admin</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
            Administrator Sign In
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Access is restricted to accounts with <code className="font-mono">role = "admin"</code>{' '}
            or bootstrapped admins ({BOOTSTRAPPED_ADMIN_EMAILS.join(', ')}).
          </p>

          {accessDeniedMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{accessDeniedMsg}</span>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <button
              type="button"
              disabled={loginBusy}
              onClick={async () => {
                setLoginBusy(true);
                setAccessDeniedMsg('');
                try {
                  await signInWithGooglePopup();
                } catch (err) {
                  setAccessDeniedMsg(err instanceof Error ? err.message : 'Google login failed.');
                } finally {
                  setLoginBusy(false);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span>or credentials</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginBusy(true);
                setAccessDeniedMsg('');
                try {
                  await signInWithEmail(loginEmail.trim(), loginPassword);
                } catch (err) {
                  setAccessDeniedMsg(err instanceof Error ? err.message : 'Sign-in failed.');
                } finally {
                  setLoginBusy(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="adm-email" className="mb-1 block text-xs text-zinc-500">
                  Admin Email
                </label>
                <input
                  id="adm-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
              </div>
              <div>
                <label htmlFor="adm-pw" className="mb-1 block text-xs text-zinc-500">
                  Password
                </label>
                <input
                  id="adm-pw"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
              </div>
              <button
                type="submit"
                disabled={loginBusy}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {loginBusy ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="space-y-3 border-t border-zinc-200 pt-4 text-center dark:border-zinc-800">
              <button
                type="button"
                onClick={enterDemoPreview}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#6d28d9]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Open Studio Preview (Demo Data)
              </button>
              <button
                type="button"
                onClick={navigateToUserPanel}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                Return to User Streaming Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    group?: 'Advertising';
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'movies', label: 'Movies & Series', icon: <Film className="h-4 w-4" /> },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: <Crown className="h-4 w-4" />,
      badge: plans.filter((p) => p.isActive).length || undefined,
    },
    { id: 'access_manager', label: 'Access & Unlocks', icon: <KeyRound className="h-4 w-4" /> },
    { id: 'episodes', label: 'Episodes', icon: <Layers className="h-4 w-4" /> },
    { id: 'genres', label: 'Genres', icon: <Tag className="h-4 w-4" /> },
    { id: 'banners', label: 'Banners', icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'ads_overview', label: 'Ads Overview', icon: <BarChart3 className="h-4 w-4" />, group: 'Advertising' },
    {
      id: 'ads_custom',
      label: 'Custom Ads',
      icon: <ImageIcon className="h-4 w-4" />,
      badge: customAds.length || undefined,
      group: 'Advertising',
    },
    {
      id: 'ads_vast',
      label: 'VAST Ads',
      icon: <Tv className="h-4 w-4" />,
      badge: vastAds.length || undefined,
      group: 'Advertising',
    },
    { id: 'ads_settings', label: 'Ad Settings', icon: <SettingsIcon className="h-4 w-4" />, group: 'Advertising' },
    { id: 'ads_reports', label: 'Ad Reports', icon: <Download className="h-4 w-4" />, group: 'Advertising' },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'comments', label: 'Comments', icon: <MessageSquare className="h-4 w-4" /> },
    {
      id: 'reports',
      label: 'Reports',
      icon: <Flag className="h-4 w-4" />,
      badge: stats.openReports || undefined,
    },
    {
      id: 'settings',
      label: 'Customize & Settings',
      icon: <SettingsIcon className="h-4 w-4" />,
      badge: messages.filter((m) => m.status === 'unread').length || undefined,
    },
    { id: 'logs', label: 'Activity Log', icon: <Activity className="h-4 w-4" /> },
  ];

  const handleBulkAction = async (action: 'publish' | 'draft' | 'feature' | 'delete') => {
    if (selectedMovieIds.size === 0) return;
    const targets = movies.filter((m) => selectedMovieIds.has(m.id));
    for (const m of targets) {
      if (action === 'delete') {
        await deleteMovieDoc(m.id, adminProfile.uid);
      } else {
        const updated: MovieItem = {
          ...m,
          status: action === 'publish' ? 'published' : action === 'draft' ? 'draft' : m.status,
          isFeatured: action === 'feature' ? true : m.isFeatured,
          updatedAt: new Date().toISOString(),
        };
        await saveMovieDoc(updated, adminProfile.uid, false);
      }
    }
    setSelectedMovieIds(new Set());
    await loadAllAdmin();
    notify(`Bulk action "${action}" completed for ${targets.length} titles`, 'success');
  };

  const handleToggleMovieFlag = async (
    movie: MovieItem,
    field: 'isFeatured' | 'isTrending' | 'isPremium'
  ) => {
    const updated: MovieItem = {
      ...movie,
      [field]: !movie[field],
      updatedAt: new Date().toISOString(),
    };
    setMovies((prev) => prev.map((m) => (m.id === movie.id ? updated : m)));
    await saveMovieDoc(updated, adminProfile.uid, false);
    notify(`Updated ${movie.title}`, 'success');
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#0b0b0f] dark:text-zinc-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-[#111118] lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--kv-accent,#e50914)]" />
            <span>{settings.siteName} Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded p-1 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin sections">
          {navItems.map((item, idx) => {
            const showGroupHeader =
              item.group && (idx === 0 || navItems[idx - 1].group !== item.group);
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-[var(--kv-accent,#e50914)] text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono-tabular rounded bg-black/20 px-1.5 py-0.5 text-[11px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={navigateToUserPanel}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Tv className="h-3.5 w-3.5" />
            View User Panel
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-[#0b0b0f]/90 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-lg font-semibold capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-zinc-500 sm:inline">
              {adminProfile?.displayName}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDemoPreview) {
                  setDemoPreviewMode(false);
                  setAdminProfile(null);
                } else {
                  void signOutUser();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isDemoPreview ? 'Exit Preview' : 'Logout'}
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6">
          {isDemoPreview && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-500/40 bg-purple-600/10 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-200">
                <Sparkles className="h-4 w-4 shrink-0 text-purple-500" />
                <span>
                  <strong>Studio Preview Mode</strong> — Inspecting local demo catalog (including{' '}
                  <em>The Amber Signal</em> 2-season hybrid series &amp; VAST ads). Sign in with Google to persist changes to Firestore.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDemoPreviewMode(false);
                    setAdminProfile(null);
                  }}
                  className="rounded-lg bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d28d9]"
                >
                  Sign In Live
                </button>
              </div>
            </div>
          )}
          {/* 1. DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">Platform Overview</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Real-time metrics across catalog, members, and moderation queues
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={async () => {
                      setSeeding(true);
                      try {
                        if (isDemoPreview) {
                          enterDemoPreview();
                        } else {
                          await seedCatalogToFirestore(adminProfile!.uid);
                          await loadAllAdmin();
                          notify('Sample catalog seeded to Firestore', 'success');
                        }
                      } finally {
                        setSeeding(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Database className="h-3.5 w-3.5" />
                    {seeding ? 'Seeding...' : 'Seed Sample Catalog'}
                  </button>
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={async () => {
                      setSeeding(true);
                      try {
                        if (isDemoPreview) {
                          enterDemoPreview();
                        } else {
                          await seedHybridAccessDemoToFirestore(adminProfile!.uid);
                          await loadAllAdmin();
                          notify('Hybrid Access Demo (The Amber Signal + VAST Ads) seeded!', 'success');
                        }
                      } finally {
                        setSeeding(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-600/10 px-3.5 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-600/20 disabled:opacity-50 dark:text-purple-300"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Seed Hybrid Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMovie(null);
                      setMovieModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Quick Add Title
                  </button>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  { label: 'Movies', val: stats.totalMovies },
                  { label: 'Series', val: stats.totalSeries },
                  { label: 'Total Users', val: stats.totalUsers },
                  { label: 'Plus Users', val: stats.premiumUsers },
                  { label: 'Total Views', val: formatCompactNumber(stats.totalViews) },
                  { label: 'Open Reports', val: stats.openReports },
                  { label: 'New (7d)', val: stats.newUsersLast7Days },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]"
                  >
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
                    <p className="font-mono-tabular mt-1.5 text-2xl font-bold">{kpi.val}</p>
                  </div>
                ))}
              </div>

              <AdminCharts movies={movies} users={users} />

              {/* Recent Activity */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
                <h3 className="mb-3 font-display text-sm font-semibold">Recent Admin Activity</h3>
                {logs.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No activity logged yet. Seed the catalog or edit a title to record audit events.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {logs.slice(0, 6).map((log) => (
                      <div key={log.id} className="flex items-center justify-between py-2.5 text-xs">
                        <span>{log.action}</span>
                        <span className="font-mono-tabular text-zinc-500">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. MOVIES & SERIES CRUD */}
          {activeTab === 'movies' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="search"
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                      placeholder="Filter titles..."
                      className="rounded-lg border border-zinc-300 bg-white py-2 pl-8 pr-3 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                    />
                  </div>
                  <select
                    value={movieTypeFilter}
                    onChange={(e) =>
                      setMovieTypeFilter(e.target.value as 'all' | 'movie' | 'series')
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                  >
                    <option value="all">All Types</option>
                    <option value="movie">Movies</option>
                    <option value="series">Series</option>
                  </select>
                  <select
                    value={movieStatusFilter}
                    onChange={(e) =>
                      setMovieStatusFilter(e.target.value as 'all' | 'published' | 'draft')
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                  >
                    <option value="all">All Status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedMovieIds.size > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBulkAction('publish')}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                      >
                        Publish ({selectedMovieIds.size})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkAction('draft')}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                      >
                        Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkAction('feature')}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                      >
                        Feature
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkAction('delete')}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMovie(null);
                      setMovieModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Title
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#13131c]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">
                        <input
                          type="checkbox"
                          aria-label="Select all titles"
                          checked={
                            filteredMovies.length > 0 &&
                            selectedMovieIds.size === filteredMovies.length
                          }
                          onChange={(e) =>
                            setSelectedMovieIds(
                              e.target.checked
                                ? new Set(filteredMovies.map((m) => m.id))
                                : new Set()
                            )
                          }
                        />
                      </th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Year</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Views</th>
                      <th className="p-3 text-center">Featured</th>
                      <th className="p-3 text-center">Trending</th>
                      <th className="p-3">Sign-In Gate</th>
                      <th className="p-3">Subscription Plan</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredMovies.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${m.title}`}
                            checked={selectedMovieIds.has(m.id)}
                            onChange={(e) => {
                              const next = new Set(selectedMovieIds);
                              if (e.target.checked) next.add(m.id);
                              else next.delete(m.id);
                              setSelectedMovieIds(next);
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={m.posterUrl}
                              alt={m.title}
                              className="h-10 w-7 rounded object-cover"
                            />
                            <div>
                              <p className="font-semibold">{m.title}</p>
                              <p className="font-mono text-[11px] text-zinc-500">{m.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 capitalize">{m.type}</td>
                        <td className="font-mono-tabular p-3">{m.releaseYear}</td>
                        <td className="p-3 capitalize">{m.status}</td>
                        <td className="font-mono-tabular p-3 text-right">
                          {formatCompactNumber(m.views)}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={m.isFeatured}
                            aria-label={`Toggle featured for ${m.title}`}
                            onChange={() => handleToggleMovieFlag(m, 'isFeatured')}
                            className="accent-[var(--kv-accent,#e50914)]"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={m.isTrending}
                            aria-label={`Toggle trending for ${m.title}`}
                            onChange={() => handleToggleMovieFlag(m, 'isTrending')}
                            className="accent-[var(--kv-accent,#e50914)]"
                          />
                        </td>
                        <td className="p-3">
                          {m.requiredPlanId || m.isPremium ? (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              Required (Plan)
                            </span>
                          ) : (
                            <select
                              aria-label={`Sign-in requirement for ${m.title}`}
                              value={m.requiresSignIn ? 'signin' : 'free'}
                              onChange={async (e) => {
                                const nextRequiresSignIn = e.target.value === 'signin';
                                const updated: MovieItem = {
                                  ...m,
                                  requiresSignIn: nextRequiresSignIn,
                                  access: {
                                    ...(m.access || {
                                      mode: 'free',
                                      adUnlockAllowed: false,
                                      adsRequired: 1,
                                      adSource: 'any_vast',
                                      adIds: [],
                                    }),
                                    requiresSignIn: nextRequiresSignIn,
                                  },
                                  updatedAt: new Date().toISOString(),
                                };
                                setMovies((prev) =>
                                  prev.map((x) => (x.id === m.id ? updated : x))
                                );
                                await saveMovieDoc(updated, adminProfile.uid, false);
                                notify(
                                  nextRequiresSignIn
                                    ? `"${m.title}" now requires sign-in to watch`
                                    : `"${m.title}" is now public (no sign-in required)`,
                                  'success'
                                );
                              }}
                              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <option value="free">No Sign-In (Free)</option>
                              <option value="signin">Sign-In Required</option>
                            </select>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            aria-label={`Assign subscription plan for ${m.title}`}
                            value={m.requiredPlanId ?? ''}
                            onChange={async (e) => {
                              const planId = e.target.value || null;
                              const chosen = planId ? plans.find((p) => p.id === planId) : null;
                              const prevAllowAd =
                                m.access?.mode === 'subscription_or_ad' ||
                                m.access?.mode === 'ad_unlock_only' ||
                                Boolean(m.access?.adUnlockAllowed);
                              const nextMode = planId
                                ? prevAllowAd
                                  ? 'subscription_or_ad'
                                  : 'subscription_only'
                                : 'free';
                              const updated: MovieItem = {
                                ...m,
                                requiredPlanId: planId,
                                requiredPlanName: chosen ? chosen.name : null,
                                isPremium: Boolean(planId),
                                access: {
                                  ...(m.access || {
                                    adsRequired: 1,
                                    adSource: 'any_vast',
                                    adIds: [],
                                  }),
                                  mode: nextMode,
                                  planId,
                                  planName: chosen ? chosen.name : null,
                                  adUnlockAllowed: nextMode === 'subscription_or_ad',
                                },
                                updatedAt: new Date().toISOString(),
                              };
                              setMovies((prev) =>
                                prev.map((x) => (x.id === m.id ? updated : x))
                              );
                              await saveMovieDoc(updated, adminProfile.uid, false);
                              notify(
                                chosen
                                  ? `"${m.title}" now requires ${chosen.name}`
                                  : `"${m.title}" is now free to watch`,
                                'success'
                              );
                            }}
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="">Free (All Users)</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatMonthlyPrice(p.pricePerMonth, p.currency)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMovie(m);
                                setMovieModalOpen(true);
                              }}
                              aria-label={`Edit ${m.title}`}
                              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const now = new Date().toISOString();
                                const copy: MovieItem = {
                                  ...m,
                                  id: `${m.id}-copy-${Date.now().toString(36)}`,
                                  title: `${m.title} (Copy)`,
                                  slug: `${m.slug}-copy-${Date.now().toString(36)}`,
                                  status: 'draft',
                                  views: 0,
                                  createdAt: now,
                                  updatedAt: now,
                                };
                                await saveMovieDoc(copy, adminProfile.uid, true);
                                setMovies((prev) => [copy, ...prev]);
                                notify(`Duplicated "${m.title}"`, 'success');
                              }}
                              aria-label={`Duplicate ${m.title}`}
                              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingMovie(m)}
                              aria-label={`Delete ${m.title}`}
                              className="rounded p-1.5 text-zinc-500 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loadingData && (
                  <p className="p-4 text-center text-xs text-zinc-500">Refreshing catalog...</p>
                )}
              </div>
            </div>
          )}

          {/* 2B. SUBSCRIPTIONS & MONTHLY PLANS */}
          {activeTab === 'subscriptions' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold">
                      Monthly Subscription Plans ({plans.length})
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Create monthly plans here, then assign any plan to a movie or series in Movies &amp; Series so only subscribers to that plan can watch it.
                    </p>
                  </div>
                </div>

                {plans.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-[#13131c]">
                    No monthly plans created yet. Use the form on the right to create your first plan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plans.map((p) => {
                      const assignedCount = movies.filter((m) => m.requiredPlanId === p.id).length;
                      const subscriberCount = users.filter((u) => u.subscriptionPlanId === p.id).length;
                      return (
                        <div
                          key={p.id}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c] sm:flex-row sm:items-start"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                                style={{ backgroundColor: p.badgeColor || '#e50914' }}
                              >
                                <Crown className="h-3.5 w-3.5" />
                              </span>
                              <h3 className="font-display text-base font-bold">{p.name}</h3>
                              <span className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatMonthlyPrice(p.pricePerMonth, p.currency)}
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  p.isActive ? 'text-emerald-500' : 'text-zinc-400'
                                }`}
                              >
                                · {p.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            {p.description && (
                              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                {p.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 tabular-nums">
                              <span>{assignedCount} assigned videos</span>
                              <span aria-hidden="true">·</span>
                              <span>{subscriberCount} active subscribers</span>
                              {p.features.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{p.features.join(' / ')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlanId(p.id);
                                setPlanName(p.name);
                                setPlanPrice(String(p.pricePerMonth));
                                setPlanCurrency(p.currency);
                                setPlanDescription(p.description);
                                setPlanFeaturesInput(p.features.join('\n'));
                                setPlanBadgeColor(p.badgeColor || '#e50914');
                                setPlanIsActive(p.isActive);
                                setPlanErrors({});
                              }}
                              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const updated: SubscriptionPlan = {
                                  ...p,
                                  isActive: !p.isActive,
                                  updatedAt: new Date().toISOString(),
                                };
                                await savePlanDoc(updated, adminProfile.uid, false);
                                setPlans((prev) =>
                                  prev.map((x) => (x.id === p.id ? updated : x))
                                );
                                notify(
                                  `${p.name} marked ${updated.isActive ? 'active' : 'inactive'}`,
                                  'success'
                                );
                              }}
                              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              {p.isActive ? 'Disable' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deletePlanDoc(p.id, adminProfile.uid);
                                setPlans((prev) => prev.filter((x) => x.id !== p.id));
                                notify(`Deleted plan "${p.name}"`, 'success');
                              }}
                              aria-label={`Delete plan ${p.name}`}
                              className="rounded p-1.5 text-zinc-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const now = new Date().toISOString();
                  const existing = editingPlanId
                    ? plans.find((x) => x.id === editingPlanId)
                    : undefined;
                  const cleanName = planName.trim();
                  const planSlug = slugify(cleanName);
                  const parsedPrice = Number(planPrice);
                  const features = planFeaturesInput
                    .split(/\n|,/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 12);

                  const candidate: SubscriptionPlan = {
                    id: existing?.id ?? `plan-${planSlug}-${Date.now().toString(36)}`,
                    name: cleanName,
                    slug: planSlug,
                    pricePerMonth: parsedPrice,
                    currency: planCurrency.trim().toUpperCase() || 'USD',
                    billingInterval: 'monthly',
                    description: planDescription.trim().slice(0, 500),
                    features,
                    badgeColor: planBadgeColor || '#e50914',
                    isActive: planIsActive,
                    order: existing?.order ?? plans.length + 1,
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                  };

                  const validation = validateSubscriptionPlanDraft(candidate);
                  if (Object.keys(validation).length > 0) {
                    setPlanErrors(validation);
                    return;
                  }

                  setSavingPlan(true);
                  setPlanErrors({});
                  try {
                    await savePlanDoc(candidate, adminProfile.uid, !existing);
                    setPlans((prev) =>
                      existing
                        ? prev.map((x) => (x.id === candidate.id ? candidate : x))
                        : [...prev, candidate]
                    );
                    notify(
                      existing
                        ? `Updated monthly plan "${candidate.name}"`
                        : `Created monthly plan "${candidate.name}"`,
                      'success'
                    );
                    setEditingPlanId(null);
                    setPlanName('');
                    setPlanPrice('9.99');
                    setPlanCurrency('USD');
                    setPlanDescription('');
                    setPlanFeaturesInput('');
                    setPlanBadgeColor('#e50914');
                    setPlanIsActive(true);
                  } finally {
                    setSavingPlan(false);
                  }
                }}
                className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold">
                    {editingPlanId ? 'Edit Monthly Plan' : 'Create Monthly Plan'}
                  </h3>
                  {editingPlanId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlanId(null);
                        setPlanName('');
                        setPlanPrice('9.99');
                        setPlanCurrency('USD');
                        setPlanDescription('');
                        setPlanFeaturesInput('');
                        setPlanBadgeColor('#e50914');
                        setPlanIsActive(true);
                        setPlanErrors({});
                      }}
                      className="text-xs text-zinc-500 hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div>
                  <label htmlFor="plan-name" className="mb-1 block text-xs text-zinc-500">
                    Plan Name *
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    required
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Cinema Plus"
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                  {planErrors.name && <p className="mt-1 text-xs text-rose-500">{planErrors.name}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label htmlFor="plan-price" className="mb-1 block text-xs text-zinc-500">
                      Price / Month *
                    </label>
                    <input
                      id="plan-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={planPrice}
                      onChange={(e) => setPlanPrice(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums dark:border-zinc-700"
                    />
                    {planErrors.pricePerMonth && (
                      <p className="mt-1 text-xs text-rose-500">{planErrors.pricePerMonth}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="plan-currency" className="mb-1 block text-xs text-zinc-500">
                      Currency
                    </label>
                    <select
                      id="plan-currency"
                      value={planCurrency}
                      onChange={(e) => setPlanCurrency(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="plan-desc" className="mb-1 block text-xs text-zinc-500">
                    Description
                  </label>
                  <textarea
                    id="plan-desc"
                    rows={2}
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    placeholder="What videos and perks this monthly subscription unlocks..."
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
                  />
                </div>

                <div>
                  <label htmlFor="plan-features" className="mb-1 block text-xs text-zinc-500">
                    Benefits (one per line)
                  </label>
                  <textarea
                    id="plan-features"
                    rows={3}
                    value={planFeaturesInput}
                    onChange={(e) => setPlanFeaturesInput(e.target.value)}
                    placeholder={'4K HDR Playback\nAd-free series access\nOffline watchlist sync'}
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="plan-color" className="text-xs text-zinc-500">
                      Badge Color
                    </label>
                    <input
                      id="plan-color"
                      type="color"
                      value={planBadgeColor}
                      onChange={(e) => setPlanBadgeColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={planIsActive}
                      onChange={(e) => setPlanIsActive(e.target.checked)}
                      className="accent-[var(--kv-accent,#e50914)]"
                    />
                    <span>Active</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingPlan}
                  className="w-full rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingPlan
                    ? 'Saving Plan...'
                    : editingPlanId
                    ? 'Save Plan Changes'
                    : 'Create Monthly Plan'}
                </button>
              </form>
            </div>
          )}

          {/* 2B. ACCESS & AD-UNLOCK MANAGER */}
          {activeTab === 'access_manager' && (
            <AccessManagerView
              movies={movies}
              plans={plans}
              vastAds={vastAds}
              adSettings={adSettings}
              adminUid={adminProfile!.uid}
              onSaveAdSettings={async (next) => {
                if (!isDemoPreview) {
                  await saveAdSettings(next, adminProfile!.uid);
                }
                setAdSettings(next);
                notify(
                  isDemoPreview
                    ? 'Ad-Unlock & Badge Settings updated (Studio Preview)'
                    : 'Ad-Unlock & Badge Settings saved',
                  'success'
                );
              }}
              onRefreshAll={isDemoPreview ? async () => {} : loadAllAdmin}
            />
          )}

          {/* 3. EPISODES MANAGER */}
          {activeTab === 'episodes' && (
            <EpisodesManager
              movies={movies}
              plans={plans}
              vastAds={vastAds}
              adSettings={adSettings}
              adminUid={adminProfile.uid}
              onSeriesUpdated={(updated) =>
                setMovies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
            />
          )}

          {/* 4. GENRES */}
          {activeTab === 'genres' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c] lg:col-span-2">
                <h2 className="mb-4 font-display text-base font-semibold">Genres ({genres.length})</h2>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {genres.map((g, idx) => (
                    <div key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <span className="font-semibold">{g.name}</span>
                        <span className="ml-2 font-mono text-xs text-zinc-500">{g.slug}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={async () => {
                            const next = [...genres];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            const reordered = next.map((item, i) => ({ ...item, order: i + 1 }));
                            setGenres(reordered);
                            for (const item of reordered) await saveGenreDoc(item, adminProfile.uid);
                            notify('Genre order updated', 'success');
                          }}
                          className="rounded p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === genres.length - 1}
                          onClick={async () => {
                            const next = [...genres];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            const reordered = next.map((item, i) => ({ ...item, order: i + 1 }));
                            setGenres(reordered);
                            for (const item of reordered) await saveGenreDoc(item, adminProfile.uid);
                            notify('Genre order updated', 'success');
                          }}
                          className="rounded p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteGenreDoc(g.id, adminProfile.uid);
                            setGenres((prev) => prev.filter((x) => x.id !== g.id));
                            notify(`Deleted genre "${g.name}"`, 'success');
                          }}
                          className="rounded p-1 text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = newGenreName.trim();
                  if (!name) return;
                  const g: GenreItem = {
                    id: `genre-${slugify(name)}`,
                    name,
                    slug: slugify(name),
                    order: genres.length + 1,
                  };
                  await saveGenreDoc(g, adminProfile.uid);
                  setGenres((prev) => [...prev, g]);
                  setNewGenreName('');
                  notify(`Added genre "${name}"`, 'success');
                }}
                className="h-fit space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]"
              >
                <h3 className="font-display text-sm font-semibold">Add Genre</h3>
                <input
                  type="text"
                  required
                  placeholder="e.g. Animation"
                  value={newGenreName}
                  onChange={(e) => setNewGenreName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
                >
                  Create Genre
                </button>
              </form>
            </div>
          )}

          {/* 5. BANNERS */}
          {activeTab === 'banners' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                {banners.map((b) => {
                  const target = moviesMap[b.movieId];
                  const hasCustomVast =
                    b.adSelectionMode === 'specific_ad_ids' &&
                    (b.unlockAdIds?.length ?? 0) > 0;
                  return (
                    <div
                      key={b.id}
                      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c] sm:flex-row sm:items-center"
                    >
                      <img
                        src={b.imageUrl}
                        alt={target?.title ?? b.movieId}
                        className="h-20 w-36 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold">
                          {target?.title ?? b.movieId}
                        </p>
                        <p className="font-mono-tabular text-xs text-zinc-500">
                          Order #{b.order} · {b.isActive ? 'Active' : 'Inactive'}
                        </p>
                        <p className="mt-1 text-[11px] text-purple-600 dark:text-purple-400">
                          {hasCustomVast
                            ? `Poster Rewarded VAST: ${b.unlockAdIds?.length} custom ad(s)`
                            : 'Poster Rewarded VAST: Inherit from title / episode'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBannerId(b.id);
                            setBannerMovieId(b.movieId);
                            setBannerImageUrl(b.imageUrl);
                            setBannerAdMode(
                              b.adSelectionMode === 'specific_ad_ids'
                                ? 'specific_ad_ids'
                                : 'inherit'
                            );
                            setBannerUnlockAdIds(b.unlockAdIds ?? []);
                          }}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = { ...b, isActive: !b.isActive };
                            if (!isDemoPreview) {
                              await saveBannerDoc(updated, adminProfile!.uid);
                            }
                            setBanners((prev) =>
                              prev.map((x) => (x.id === b.id ? updated : x))
                            );
                          }}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                        >
                          {b.isActive ? 'Disable' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!isDemoPreview) {
                              await deleteBannerDoc(b.id, adminProfile!.uid);
                            }
                            setBanners((prev) => prev.filter((x) => x.id !== b.id));
                            if (editingBannerId === b.id) {
                              setEditingBannerId(null);
                              setBannerAdMode('inherit');
                              setBannerUnlockAdIds([]);
                            }
                            notify('Banner deleted', 'success');
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!bannerMovieId || !bannerImageUrl.trim()) return;
                  const existing = editingBannerId
                    ? banners.find((x) => x.id === editingBannerId)
                    : null;
                  const b: BannerItem = {
                    id: existing ? existing.id : `banner-${Date.now()}`,
                    movieId: bannerMovieId,
                    imageUrl: bannerImageUrl.trim(),
                    order: existing ? existing.order : banners.length + 1,
                    isActive: existing ? existing.isActive : true,
                    adSelectionMode: bannerAdMode,
                    unlockAdIds:
                      bannerAdMode === 'specific_ad_ids' ? bannerUnlockAdIds : [],
                  };
                  if (!isDemoPreview) {
                    await saveBannerDoc(b, adminProfile!.uid);
                  }
                  setBanners((prev) =>
                    existing ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b]
                  );
                  setEditingBannerId(null);
                  setBannerAdMode('inherit');
                  setBannerUnlockAdIds([]);
                  notify(existing ? 'Banner updated' : 'Banner added', 'success');
                }}
                className="h-fit space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold">
                    {editingBannerId ? 'Edit Hero Banner' : 'Add Hero Banner'}
                  </h3>
                  {editingBannerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBannerId(null);
                        setBannerAdMode('inherit');
                        setBannerUnlockAdIds([]);
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <select
                  value={bannerMovieId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBannerMovieId(id);
                    const m = moviesMap[id];
                    if (m && !editingBannerId) setBannerImageUrl(m.bannerUrl || m.posterUrl);
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={bannerImageUrl}
                  onChange={(e) => setBannerImageUrl(e.target.value)}
                  placeholder="Banner image URL"
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
                />
                <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-center text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                  Upload Banner File
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadFileWithProgress(`banners/${Date.now()}-${f.name}`, f);
                      setBannerImageUrl(url);
                    }}
                  />
                </label>

                <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <label className="block text-[11px] font-semibold text-zinc-500">
                    Rewarded VAST Ad Override (when clicked from this Banner)
                  </label>
                  <select
                    value={bannerAdMode}
                    onChange={(e) =>
                      setBannerAdMode(e.target.value as 'inherit' | 'specific_ad_ids')
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="inherit">Inherit from Title / Episode</option>
                    <option value="specific_ad_ids">Pick Specific Rewarded VAST Ads</option>
                  </select>

                  {bannerAdMode === 'specific_ad_ids' && (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto pt-1">
                      {vastAds
                        .filter((v) => v.type !== 'overlay')
                        .map((v) => {
                          const checked = bannerUnlockAdIds.includes(v.id);
                          return (
                            <label
                              key={v.id}
                              className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-800"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBannerUnlockAdIds((prev) => [...prev, v.id]);
                                  } else {
                                    setBannerUnlockAdIds((prev) =>
                                      prev.filter((id) => id !== v.id)
                                    );
                                  }
                                }}
                              />
                              <span className="truncate font-medium">{v.name}</span>
                              <span className="ml-auto text-[10px] uppercase text-zinc-400">
                                {v.type}
                              </span>
                            </label>
                          );
                        })}
                      {vastAds.filter((v) => v.type !== 'overlay').length === 0 && (
                        <p className="text-[11px] text-zinc-500">
                          No linear VAST ads configured yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
                >
                  {editingBannerId ? 'Update Banner' : 'Save Banner'}
                </button>
              </form>
            </div>
          )}

          {/* 6. USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name or email..."
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                  />
                  <select
                    value={userRoleFilter}
                    onChange={(e) =>
                      setUserRoleFilter(e.target.value as 'all' | 'user' | 'admin')
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    value={userPlanFilter}
                    onChange={(e) =>
                      setUserPlanFilter(e.target.value as 'all' | 'free' | 'premium')
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="premium">Plus</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportUsersToCsv(filteredUsers);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kinovault-users-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#13131c]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Member</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Joined</th>
                      <th className="p-3">Last Login</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid}>
                        <td className="p-3">
                          <p className="font-semibold">{u.displayName}</p>
                          <p className="text-zinc-500">{u.email}</p>
                        </td>
                        <td className="p-3 capitalize">{u.role}</td>
                        <td className="p-3">
                          {u.plan === 'premium'
                            ? u.subscriptionPlanName || 'Premium'
                            : 'Free'}
                        </td>
                        <td className="p-3 capitalize">
                          <span
                            className={
                              u.status === 'banned' ? 'text-rose-500 font-semibold' : 'text-emerald-500'
                            }
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="font-mono-tabular p-3 text-zinc-500">
                          {u.createdAt?.slice(0, 10)}
                        </td>
                        <td className="font-mono-tabular p-3 text-zinc-500">
                          {formatRelativeTime(u.lastLoginAt)}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const nextPlan = u.plan === 'premium' ? 'free' : 'premium';
                                const expiry =
                                  nextPlan === 'premium'
                                    ? new Date(Date.now() + 365 * 86400_000).toISOString()
                                    : null;
                                await updateAdminUserDoc(
                                  u.uid,
                                  { plan: nextPlan, planExpiresAt: expiry },
                                  adminProfile.uid
                                );
                                setUsers((prev) =>
                                  prev.map((x) =>
                                    x.uid === u.uid ? { ...x, plan: nextPlan, planExpiresAt: expiry } : x
                                  )
                                );
                                notify(`Set ${u.displayName} plan to ${nextPlan}`, 'success');
                              }}
                              className="rounded border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700"
                            >
                              {u.plan === 'premium' ? 'Set Free' : 'Grant Plus'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const nextRole = u.role === 'admin' ? 'user' : 'admin';
                                await updateAdminUserDoc(u.uid, { role: nextRole }, adminProfile.uid);
                                setUsers((prev) =>
                                  prev.map((x) => (x.uid === u.uid ? { ...x, role: nextRole } : x))
                                );
                                notify(`Changed role to ${nextRole}`, 'success');
                              }}
                              className="rounded border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700"
                            >
                              {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus = u.status === 'banned' ? 'active' : 'banned';
                                await updateAdminUserDoc(
                                  u.uid,
                                  { status: nextStatus },
                                  adminProfile.uid
                                );
                                setUsers((prev) =>
                                  prev.map((x) =>
                                    x.uid === u.uid ? { ...x, status: nextStatus } : x
                                  )
                                );
                                notify(`User ${nextStatus}`, 'info');
                              }}
                              className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-amber-500 dark:border-zinc-700"
                            >
                              {u.status === 'banned' ? 'Unban' : 'Ban'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteAdminUserDoc(u.uid, adminProfile.uid);
                                setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
                                notify('User deleted', 'success');
                              }}
                              aria-label={`Delete user ${u.displayName}`}
                              className="rounded p-1 text-zinc-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. COMMENTS MODERATION */}
          {activeTab === 'comments' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <h2 className="mb-4 font-display text-base font-semibold">
                Comments Moderation ({comments.length})
              </h2>
              {comments.length === 0 ? (
                <p className="text-sm text-zinc-500">No comments in queue.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                      <div>
                        <p className="text-xs text-zinc-500">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {c.userName}
                          </span>{' '}
                          on {moviesMap[c.movieId]?.title ?? c.movieId} ·{' '}
                          {formatRelativeTime(c.createdAt)}
                        </p>
                        <p className={`mt-1 ${c.isHidden ? 'line-through opacity-50' : ''}`}>
                          {c.text}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleCommentVisibility(c.id, !c.isHidden, adminProfile.uid);
                            setComments((prev) =>
                              prev.map((x) =>
                                x.id === c.id ? { ...x, isHidden: !c.isHidden } : x
                              )
                            );
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          aria-label={c.isHidden ? 'Unhide comment' : 'Hide comment'}
                        >
                          {c.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteCommentDoc(c.id);
                            setComments((prev) => prev.filter((x) => x.id !== c.id));
                            notify('Comment deleted', 'success');
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:text-rose-500"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(['all', 'open', 'resolved'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setReportFilter(status)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                      reportFilter === status
                        ? 'bg-[var(--kv-accent,#e50914)] text-white'
                        : 'border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
                {filteredReports.length === 0 ? (
                  <p className="text-sm text-zinc-500">No reports matching this filter.</p>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredReports.map((r) => {
                      const targetMovie = moviesMap[r.movieId];
                      return (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm"
                        >
                          <div>
                            <p className="text-xs text-zinc-500">
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {targetMovie?.title ?? r.movieId}
                              </span>{' '}
                              · {r.type} · {r.status} · {formatRelativeTime(r.createdAt)}
                            </p>
                            <p className="mt-1">{r.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {targetMovie && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMovie(targetMovie);
                                  setMovieModalOpen(true);
                                }}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                              >
                                Edit Source
                              </button>
                            )}
                            {r.status === 'open' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateReportStatus(r.id, 'resolved', adminProfile.uid);
                                  setReports((prev) =>
                                    prev.map((x) =>
                                      x.id === r.id ? { ...x, status: 'resolved' } : x
                                    )
                                  );
                                  notify('Report marked resolved', 'success');
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8B. ADVERTISING MODULE */}
          {activeTab.startsWith('ads_') && (
            <AdManagementHub
              section={activeTab.replace('ads_', '') as AdsSubSection}
              customAds={customAds}
              vastAds={vastAds}
              adEvents={adEvents}
              adSettings={adSettings}
              movies={movies}
              adminUid={adminProfile.uid}
              adminName={adminProfile.displayName || adminProfile.email}
              onSaveCustomAd={async (ad, isNew) => {
                await saveCustomAdDoc(ad, adminProfile.uid, isNew);
                setCustomAds((prev) =>
                  isNew ? [ad, ...prev] : prev.map((x) => (x.id === ad.id ? ad : x))
                );
                notify(isNew ? `Created ad "${ad.name}"` : `Updated ad "${ad.name}"`, 'success');
              }}
              onDeleteCustomAd={async (ad) => {
                await deleteCustomAdDoc(ad, adminProfile.uid);
                setCustomAds((prev) => prev.filter((x) => x.id !== ad.id));
                notify(`Deleted ad "${ad.name}"`, 'success');
              }}
              onSaveVastAd={async (ad, isNew) => {
                await saveVastAdDoc(ad, adminProfile.uid, isNew);
                setVastAds((prev) =>
                  isNew ? [ad, ...prev] : prev.map((x) => (x.id === ad.id ? ad : x))
                );
                notify(isNew ? `Created VAST "${ad.name}"` : `Updated VAST "${ad.name}"`, 'success');
              }}
              onDeleteVastAd={async (ad) => {
                await deleteVastAdDoc(ad, adminProfile.uid);
                setVastAds((prev) => prev.filter((x) => x.id !== ad.id));
                notify(`Deleted VAST "${ad.name}"`, 'success');
              }}
              onSaveAdSettings={async (next) => {
                await saveAdSettings(next, adminProfile.uid);
                setAdSettings(next);
                notify('Global Ad Settings saved', 'success');
              }}
              onSeedSampleAds={async () => {
                await seedSampleAdsToFirestore(adminProfile.uid);
                const fresh = await fetchAllAdsAdminData();
                setCustomAds(fresh.customAds);
                setVastAds(fresh.vastAds);
                setAdSettings(fresh.adSettings);
                notify('Sample Custom & VAST Ads seeded to Firestore', 'success');
              }}
              onNavigateSection={(sub) => setActiveTab(`ads_${sub}` as AdminTab)}
              onNotify={notify}
            />
          )}

          {/* 9. 11-TAB SITE CUSTOMIZATION & SETTINGS */}
          {activeTab === 'settings' && (
            <CustomizationHub
              settings={settings}
              movies={movies}
              pages={pages}
              messages={messages}
              saving={savingSettings}
              onChange={(updater) => setSettings(updater)}
              onSave={async (nextSettings) => {
                setSavingSettings(true);
                try {
                  await saveSiteSettingsDoc(nextSettings, adminProfile.uid);
                  setSettings(nextSettings);
                  notify('Site customization saved & published live!', 'success');
                } catch (err) {
                  notify(err instanceof Error ? err.message : 'Failed to save customization.', 'error');
                } finally {
                  setSavingSettings(false);
                }
              }}
              onSavePage={async (page, isNew) => {
                await saveCustomPageDoc(page, adminProfile.uid, isNew);
                setPages((prev) =>
                  isNew ? [...prev, page] : prev.map((p) => (p.id === page.id ? page : p))
                );
                notify(`Saved custom page "${page.title}"`, 'success');
              }}
              onDeletePage={async (pageId) => {
                await deleteCustomPageDoc(pageId, adminProfile.uid);
                setPages((prev) => prev.filter((p) => p.id !== pageId));
                notify('Deleted custom page', 'success');
              }}
              onUpdateMessageStatus={async (id, status) => {
                await updateContactMessageStatus(id, status, adminProfile.uid);
                setMessages((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, status } : m))
                );
                notify(`Message marked ${status}`, 'success');
              }}
              onDeleteMessage={async (id) => {
                await deleteContactMessageDoc(id, adminProfile.uid);
                setMessages((prev) => prev.filter((m) => m.id !== id));
                notify('Deleted message', 'success');
              }}
              onNotify={notify}
            />
          )}

          {/* 10. ACTIVITY LOG */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <input
                type="search"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter audit logs..."
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
              />
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#13131c]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Admin UID</th>
                      <th className="p-3 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="p-3 font-medium">{l.action}</td>
                        <td className="font-mono p-3 text-zinc-500">{l.targetId}</td>
                        <td className="font-mono p-3 text-zinc-500">{l.adminUid.slice(0, 10)}…</td>
                        <td className="font-mono-tabular p-3 text-right text-zinc-500">
                          {formatRelativeTime(l.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Movie Form Modal */}
      <MovieFormModal
        open={movieModalOpen}
        initialMovie={editingMovie}
        genres={genres}
        plans={plans}
        vastAds={vastAds}
        adSettings={adSettings}
        tmdbApiKey={settings.tmdbApiKey}
        onClose={() => setMovieModalOpen(false)}
        onSave={async (movie, isNew) => {
          if (!isDemoPreview) {
            await saveMovieDoc(movie, adminProfile!.uid, isNew);
          }
          setMovies((prev) =>
            isNew ? [movie, ...prev] : prev.map((x) => (x.id === movie.id ? movie : x))
          );
          notify(isNew ? `Added "${movie.title}"` : `Updated "${movie.title}"`, 'success');
        }}
      />

      {/* Delete Movie Confirm */}
      <ConfirmDialog
        open={Boolean(deletingMovie)}
        title="Delete Title"
        message={`Are you sure you want to permanently delete "${deletingMovie?.title}"?`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeletingMovie(null)}
        onConfirm={async () => {
          if (!deletingMovie) return;
          if (!isDemoPreview) {
            await deleteMovieDoc(deletingMovie.id, adminProfile!.uid);
          }
          setMovies((prev) => prev.filter((x) => x.id !== deletingMovie.id));
          notify(`Deleted "${deletingMovie.title}"`, 'success');
          setDeletingMovie(null);
        }}
      />
    </div>
  );
}

export default function AdminApp() {
  return (
    <ToastProvider>
      <AdminShell />
    </ToastProvider>
  );
}
