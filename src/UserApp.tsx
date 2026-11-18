import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Film,
  Globe,
  Home,
  Info,
  LogOut,
  Mail,
  Menu,
  Moon,
  Play,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Tv,
  User as UserIcon,
  WifiOff,
  X,
} from 'lucide-react';
import {
  auth,
  cancelUserSubscription,
  clearUserHistory,
  createComment,
  createReportDoc,
  deleteCommentDoc,
  deleteCurrentUserAccount,
  fetchMovieComments,
  fetchPublishedCatalog,
  fetchPublishedPages,
  fetchSeriesEpisodes,
  fetchSiteSettings,
  fetchUserAdUnlocks,
  fetchUserPersonalData,
  incrementMovieViews,
  isUserAdmin,
  registerWithEmail,
  removeUserHistoryItem,
  saveUserAdUnlock,
  saveUserRating,
  saveUserWatchHistory,
  sendResetPassword,
  signInWithEmail,
  signInWithGooglePopup,
  signOutUser,
  subscribeUserToPlan,
  syncUserProfileOnLogin,
  testFirestoreConnection,
  toggleUserLike,
  toggleUserWatchlist,
  updateCurrentUserPassword,
  updateOwnUserProfile,
  uploadFileWithProgress,
} from './lib/firebase';
import { DEFAULT_SITE_SETTINGS, SEED_COMMENTS, SEED_PAGES } from './data/seedCatalog';
import { DEFAULT_AD_SETTINGS } from './data/seedAds';
import { loadAds } from './lib/adsFirebase';
import type {
  AdGlobalSettings,
  AdUnlockRecord,
  BannerItem,
  CommentItem,
  CustomAdItem,
  CustomCollection,
  CustomPage,
  EpisodeItem,
  GenreItem,
  MovieItem,
  NavIconName,
  ReportType,
  SiteSettings,
  SocialPlatform,
  SubscriptionPlan,
  TargetPageKey,
  UserProfile,
  VastAdItem,
  WatchHistoryItem,
  WatchlistItem,
} from './types/streaming';
import { formatDuration, sanitizeText, searchMovies, slugify, sortMovies } from './utils/catalog';
import {
  loadGuestAdUnlocks,
  pruneExpiredUnlockMap,
  saveGuestAdUnlock,
} from './utils/accessControl';
import {
  buildLinearGradientCss,
  formatCopyrightText,
  isWithinSchedule,
  resolveTranslation,
} from './utils/customization';
import { applySiteCustomizationToDom } from './utils/themeDom';
import { ToastProvider, useToast } from './components/ui/Toast';
import { AccessBadge } from './components/user/AccessBadge';
import { AuthModal } from './components/user/AuthModal';
import { BrowseView } from './components/user/BrowseView';
import { CustomAdSlot } from './components/user/CustomAdSlot';
import { CustomPageView } from './components/user/CustomPageView';
import { DetailsView } from './components/user/DetailsView';
import { MovieCard, MovieCardSkeleton } from './components/user/MovieCard';
import { ProfileView } from './components/user/ProfileView';
import { AdSlot, CookieConsentBar, SitePopupOverlay } from './components/user/SiteOverlays';
import { SubscriptionsView } from './components/user/SubscriptionsView';
import { VideoPlayer } from './components/user/VideoPlayer';
import { WatchRecommendations } from './components/user/WatchRecommendations';
import { AnimeEntrance } from './components/user/AnimeEntrance';

interface RouteState {
  page:
    | 'home'
    | 'movies'
    | 'series'
    | 'genre'
    | 'search'
    | 'movie'
    | 'watch'
    | 'mylist'
    | 'plans'
    | 'profile'
    | 'page'
    | 'notfound';
  param?: string;
  seasonNum?: number;
  episodeId?: string;
  bannerId?: string;
  query?: string;
}

function parseHashRoute(hash: string): RouteState {
  const raw = (hash || '#/home').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const searchParams = new URLSearchParams(queryPart || '');

  if (parts.length === 0 || parts[0] === 'home') return { page: 'home' };
  if (parts[0] === 'signin' || parts[0] === 'login') return { page: 'home' };
  if (parts[0] === 'movies') return { page: 'movies' };
  if (parts[0] === 'series') return { page: 'series' };
  if (parts[0] === 'mylist') return { page: 'mylist' };
  if (parts[0] === 'plans' || parts[0] === 'subscriptions') {
    return { page: 'plans', param: searchParams.get('plan') ?? undefined };
  }
  if (parts[0] === 'profile') return { page: 'profile' };
  if (parts[0] === 'search') return { page: 'search', query: searchParams.get('q') ?? '' };
  if (parts[0] === 'genre') return { page: 'genre', param: parts[1] ?? 'all' };
  if (parts[0] === 'movie' && parts[1]) return { page: 'movie', param: parts[1] };
  if (parts[0] === 'page' && parts[1]) return { page: 'page', param: parts[1] };
  if (parts[0] === 'watch' && parts[1]) {
    return {
      page: 'watch',
      param: parts[1],
      seasonNum: parts[2] ? Number(parts[2]) : undefined,
      episodeId: parts[3],
      bannerId: searchParams.get('banner') ?? undefined,
    };
  }
  return { page: 'notfound' };
}

function renderNavIcon(icon: NavIconName, className = 'h-4 w-4') {
  switch (icon) {
    case 'home':
      return <Home className={className} />;
    case 'film':
      return <Film className={className} />;
    case 'tv':
      return <Tv className={className} />;
    case 'bookmark':
      return <Bookmark className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'search':
      return <Search className={className} />;
    case 'user':
      return <UserIcon className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'info':
      return <Info className={className} />;
    case 'mail':
      return <Mail className={className} />;
    default:
      return <Home className={className} />;
  }
}

function renderSocialBadge(platform: SocialPlatform): string {
  switch (platform) {
    case 'instagram':
      return 'IG';
    case 'youtube':
      return 'YT';
    case 'telegram':
      return 'TG';
    case 'x':
      return 'X';
    case 'facebook':
      return 'FB';
    case 'whatsapp':
      return 'WA';
  }
}

function HorizontalRow({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.78), behavior: 'smooth' });
  };

  return (
    <section className="relative">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        <div className="flex items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="text-xs font-semibold text-zinc-500 transition-colors hover:text-[var(--kv-accent,#e50914)] dark:text-zinc-400"
            >
              {actionLabel}
            </button>
          )}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} left`}
              className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#14141c] dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} right`}
              className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#14141c] dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="kv-row-scroll flex gap-4 overflow-x-auto pb-2"
      >
        {children}
      </div>
    </section>
  );
}

function UserPanelShell() {
  const { notify } = useToast();
  const [route, setRoute] = useState<RouteState>(() => parseHashRoute(window.location.hash));
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [publishedPages, setPublishedPages] = useState<CustomPage[]>(SEED_PAGES);
  const [customAds, setCustomAds] = useState<CustomAdItem[]>([]);
  const [vastAds, setVastAds] = useState<VastAdItem[]>([]);
  const [adSettings, setAdSettings] = useState<AdGlobalSettings>(DEFAULT_AD_SETTINGS);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [language, setLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem('kv_lang') || DEFAULT_SITE_SETTINGS.i18n?.defaultLanguage || 'en';
    } catch {
      return 'en';
    }
  });
  const [scrolled, setScrolled] = useState(false);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(() => {
    const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    return h === 'signin' || h === 'login';
  });
  const [showEntrance, setShowEntrance] = useState(() => {
    try {
      const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (h === 'signin' || h === 'login' || h === 'admin') return false;
      return sessionStorage.getItem('kv_intro_seen') !== '1';
    } catch {
      return true;
    }
  });

  // Personal state (synced with Firestore when signed in, mirrored in localStorage)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kv_guest_watchlist') || '[]');
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kv_guest_history') || '[]');
    } catch {
      return [];
    }
  });
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('kv_guest_ratings') || '{}');
    } catch {
      return {};
    }
  });
  const [likes, setLikes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kv_guest_likes') || '[]');
    } catch {
      return [];
    }
  });
  const [unlocksMap, setUnlocksMap] = useState<Record<string, AdUnlockRecord>>(() =>
    loadGuestAdUnlocks()
  );

  // Active details/watch state
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const viewedSessionRef = useRef<Set<string>>(new Set());

  // UI chrome state
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [genresMenuOpen, setGenresMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  const t = useCallback(
    (key: string, fallback: string) => resolveTranslation(settings.i18n, language, key, fallback),
    [settings.i18n, language]
  );

  // Sync theme to DOM & localStorage
  const toggleTheme = () => {
    if (settings.theme?.allowUserThemeToggle === false) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('kv_theme', next);
    } catch {
      // Ignore storage failures
    }
  };

  // Honor theme defaultMode when settings load or toggle is disabled
  useEffect(() => {
    const mode = settings.theme?.defaultMode;
    if (!mode) return;
    let userStored: string | null = null;
    try {
      userStored = localStorage.getItem('kv_theme');
    } catch {}
    if (settings.theme?.allowUserThemeToggle === false || !userStored) {
      const resolved: 'dark' | 'light' =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : mode;
      setTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    }
  }, [settings.theme?.defaultMode, settings.theme?.allowUserThemeToggle]);

  // Track window scroll for transparent-to-solid navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Listen to hash routing & online status
  useEffect(() => {
    const checkHashActions = () => {
      const firstSegment = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (firstSegment === 'admin') {
        window.location.href = '/admin.html';
        return;
      }
      if (firstSegment === 'signin' || firstSegment === 'login') {
        setAuthModalOpen(true);
      }
    };
    checkHashActions();

    const onHash = () => {
      checkHashActions();
      setRoute(parseHashRoute(window.location.hash));
      setMobileMenuOpen(false);
      setGenresMenuOpen(false);
      setProfileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('hashchange', onHash);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Debounce live search (300ms)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Initial catalog, custom pages & settings load
  useEffect(() => {
    let active = true;
    (async () => {
      setCatalogLoading(true);
      try {
        await testFirestoreConnection();
        const [siteCfg, catalog, pagesList, adsBundle] = await Promise.all([
          fetchSiteSettings(),
          fetchPublishedCatalog(60),
          fetchPublishedPages(),
          loadAds(),
        ]);
        if (!active) return;
        setSettings(siteCfg);
        setMovies(catalog.movies);
        setGenres(catalog.genres);
        setBanners(catalog.banners);
        setPlans(catalog.plans);
        setPublishedPages(pagesList);
        setCustomAds(adsBundle.customAds);
        setVastAds(adsBundle.vastAds);
        setAdSettings(adsBundle.adSettings);
        try {
          if (!localStorage.getItem('kv_lang') && siteCfg.i18n?.defaultLanguage) {
            setLanguage(siteCfg.i18n.defaultLanguage);
          }
        } catch {}
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth subscription + Ad-Unlock synchronization
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (!u) {
        setProfile(null);
        setUnlocksMap(loadGuestAdUnlocks());
        return;
      }
      try {
        const prof = await syncUserProfileOnLogin(u);
        setProfile(prof);
        if (prof.status !== 'banned') {
          const [personal, userUnlocks] = await Promise.all([
            fetchUserPersonalData(u.uid),
            fetchUserAdUnlocks(u.uid),
          ]);
          setWatchlist(personal.watchlist);
          setHistory(personal.history);
          setRatings(personal.ratings);
          setLikes(personal.likes);
          const guestValid = loadGuestAdUnlocks();
          const merged = pruneExpiredUnlockMap({ ...guestValid, ...userUnlocks });
          setUnlocksMap(merged);
        }
      } catch {
        setProfile({
          uid: u.uid,
          displayName: u.displayName || u.email?.split('@')[0] || 'Member',
          email: u.email || '',
          photoURL: u.photoURL || '',
          role: 'user',
          status: 'active',
          plan: 'free',
          subscriptionPlanId: null,
          subscriptionPlanName: null,
          planExpiresAt: null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });
      }
    });
    return () => unsub();
  }, []);

  // Navigate helper
  const navigate = useCallback((hash: string) => {
    window.location.hash = hash.startsWith('#') ? hash : `#${hash}`;
  }, []);

  const navigateHref = useCallback(
    (href: string) => {
      const target = (href || '').trim();
      if (!target) return;
      if (target.startsWith('#')) {
        window.location.hash = target;
      } else if (target.startsWith('/')) {
        window.location.href = target;
      } else if (/^https?:\/\//i.test(target) || /^mailto:/i.test(target)) {
        window.location.assign(target);
      } else {
        navigate(`/${target.replace(/^\/+/, '')}`);
      }
    },
    [navigate]
  );

  const moviesMap = useMemo(() => {
    const map: Record<string, MovieItem> = {};
    movies.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [movies]);

  const watchlistIds = useMemo(() => new Set(watchlist.map((w) => w.movieId)), [watchlist]);
  const historyMap = useMemo(() => {
    const map: Record<string, WatchHistoryItem> = {};
    history.forEach((h) => {
      map[h.movieId] = h;
    });
    return map;
  }, [history]);

  // Resolve current movie for details or watch route
  const activeMovie = useMemo(() => {
    if (!route.param) return undefined;
    return movies.find((m) => m.slug === route.param || m.id === route.param);
  }, [movies, route.param]);

  // Resolve current custom page
  const activeCustomPage = useMemo(() => {
    if (route.page !== 'page' || !route.param) return null;
    return publishedPages.find((p) => p.slug === route.param || p.id === route.param) ?? null;
  }, [publishedPages, route.page, route.param]);

  // Apply 11-tab theme CSS vars, fonts, SEO meta tags, favicon, manifest & custom code
  useEffect(() => {
    const routeTitleMap: Record<RouteState['page'], string> = {
      home: settings.siteName,
      movies: t('movies', 'Movies'),
      series: t('series', 'Series'),
      genre: genres.find((g) => g.slug === route.param)?.name || 'Genre',
      search: route.query ? `Search: ${route.query}` : t('search', 'Search'),
      movie: activeMovie?.title || 'Title',
      watch: activeMovie ? `Watch ${activeMovie.title}` : 'Watch',
      mylist: t('mylist', 'My List'),
      plans: t('plans', 'Plans'),
      profile: 'Profile',
      page: activeCustomPage?.title || 'Page',
      notfound: 'Not Found',
    };
    applySiteCustomizationToDom(settings, {
      pageTitle: routeTitleMap[route.page],
      activeMovie: route.page === 'movie' || route.page === 'watch' ? activeMovie ?? null : null,
    });
  }, [settings, route, activeMovie, activeCustomPage, genres, t]);

  // Fetch episodes and comments when viewing movie or watch page
  useEffect(() => {
    if (!activeMovie || (route.page !== 'movie' && route.page !== 'watch')) return;
    let mounted = true;
    (async () => {
      const [eps, cmts] = await Promise.all([
        activeMovie.type === 'series' ? fetchSeriesEpisodes(activeMovie.id) : Promise.resolve([]),
        route.page === 'movie' ? fetchMovieComments(activeMovie.id) : Promise.resolve([]),
      ]);
      if (!mounted) return;
      setEpisodes(eps);
      if (route.page === 'movie') {
        setComments(cmts.length > 0 ? cmts : SEED_COMMENTS.filter((c) => c.movieId === activeMovie.id));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeMovie?.id, activeMovie?.type, route.page]);

  // Increment view count once per session when entering watch page
  useEffect(() => {
    if (route.page === 'watch' && activeMovie && !viewedSessionRef.current.has(activeMovie.id)) {
      viewedSessionRef.current.add(activeMovie.id);
      setMovies((prev) =>
        prev.map((m) => (m.id === activeMovie.id ? { ...m, views: m.views + 1 } : m))
      );
      incrementMovieViews(activeMovie.id);
    }
  }, [route.page, activeMovie?.id]);

  // Hero slides
  const heroSlides = useMemo(() => {
    const maxSlides = Math.max(1, settings.homeLayout?.heroMaxSlides ?? 5);
    const activeBanners = banners
      .filter((b) => b.isActive)
      .map((b) => ({ banner: b, movie: moviesMap[b.movieId] }))
      .filter((x): x is { banner: BannerItem; movie: MovieItem } => Boolean(x.movie));
    if (activeBanners.length > 0) return activeBanners.slice(0, maxSlides);
    return movies.slice(0, maxSlides).map((m, idx) => ({
      banner: { id: `auto-${m.id}`, movieId: m.id, imageUrl: m.bannerUrl || m.posterUrl, order: idx, isActive: true },
      movie: m,
    }));
  }, [banners, moviesMap, movies, settings.homeLayout?.heroMaxSlides]);

  // Hero auto-advance
  useEffect(() => {
    if (route.page !== 'home' || heroSlides.length <= 1) return;
    if (settings.homeLayout?.heroAutoplay === false) return;
    const ms = Math.max(3, settings.homeLayout?.heroIntervalSec ?? 6) * 1000;
    const tmr = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, ms);
    return () => window.clearInterval(tmr);
  }, [route.page, heroSlides.length, settings.homeLayout?.heroAutoplay, settings.homeLayout?.heroIntervalSec]);

  // Live search suggestions
  const suggestions = useMemo(() => {
    if (!debouncedQuery) return [];
    return searchMovies(movies, debouncedQuery).slice(0, 6);
  }, [movies, debouncedQuery]);

  // Action Handlers
  const handleSelectMovie = (movie: MovieItem) => {
    navigate(`/movie/${movie.slug}`);
  };

  const handlePlayMovie = (movie: MovieItem, ep?: EpisodeItem, bannerId?: string) => {
    const query = bannerId ? `?banner=${encodeURIComponent(bannerId)}` : '';
    if (ep) {
      navigate(`/watch/${movie.id}/${ep.seasonNumber}/${ep.id}${query}`);
    } else {
      navigate(`/watch/${movie.id}${query}`);
    }
  };

  const handleUnlockGranted = useCallback(
    (record: AdUnlockRecord) => {
      setUnlocksMap((prev) => pruneExpiredUnlockMap({ ...prev, [record.contentId]: record }));
      if (authUser) {
        void saveUserAdUnlock(authUser.uid, record).catch(() => undefined);
      } else {
        saveGuestAdUnlock(record, record.expiresAt === null);
      }
      notify('Unlocked! Starting ad-free playback.', 'success');
    },
    [authUser, notify]
  );

  const handleToggleWatchlist = async (movie: MovieItem) => {
    const exists = watchlistIds.has(movie.id);
    const nextList = exists
      ? watchlist.filter((w) => w.movieId !== movie.id)
      : [{ movieId: movie.id, addedAt: new Date().toISOString() }, ...watchlist];
    setWatchlist(nextList);
    try {
      localStorage.setItem('kv_guest_watchlist', JSON.stringify(nextList));
    } catch {}

    if (authUser) {
      try {
        await toggleUserWatchlist(authUser.uid, movie.id, !exists);
      } catch {
        // Already updated locally
      }
    }
    notify(exists ? `Removed "${movie.title}" from My List` : `Added "${movie.title}" to My List`, 'success');
  };

  const handleSaveProgress = useCallback(
    async (progressSeconds: number, durationSeconds: number, episode?: EpisodeItem | null) => {
      if (!activeMovie) return;
      const entry: WatchHistoryItem = {
        movieId: activeMovie.id,
        progressSeconds: Math.round(progressSeconds),
        durationSeconds: Math.max(1, Math.round(durationSeconds)),
        seasonId: episode?.seasonId,
        episodeId: episode?.id,
        updatedAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.movieId !== activeMovie.id);
        const next = [entry, ...filtered];
        try {
          localStorage.setItem('kv_guest_history', JSON.stringify(next));
        } catch {}
        return next;
      });
      if (authUser) {
        await saveUserWatchHistory(authUser.uid, entry).catch(() => undefined);
      }
    },
    [activeMovie, authUser]
  );

  const handleToggleLike = async (movie: MovieItem) => {
    const liked = likes.includes(movie.id);
    const nextLikes = liked ? likes.filter((id) => id !== movie.id) : [...likes, movie.id];
    setLikes(nextLikes);
    try {
      localStorage.setItem('kv_guest_likes', JSON.stringify(nextLikes));
    } catch {}
    setMovies((prev) =>
      prev.map((m) =>
        m.id === movie.id ? { ...m, likesCount: Math.max(0, m.likesCount + (liked ? -1 : 1)) } : m
      )
    );
    if (authUser) {
      await toggleUserLike(authUser.uid, movie.id, !liked).catch(() => undefined);
    }
    notify(liked ? 'Removed like' : `Liked "${movie.title}"`, 'success');
  };

  const handleRate = async (movie: MovieItem, value: number) => {
    const nextRatings = { ...ratings, [movie.id]: value };
    setRatings(nextRatings);
    try {
      localStorage.setItem('kv_guest_ratings', JSON.stringify(nextRatings));
    } catch {}
    if (authUser) {
      await saveUserRating(authUser.uid, movie.id, value).catch(() => undefined);
    }
    notify(`Rated "${movie.title}" ${value}/5 stars`, 'success');
  };

  const handleAddComment = async (movieId: string, text: string) => {
    if (!profile) {
      setAuthModalOpen(true);
      return;
    }
    const clean = sanitizeText(text, 1000);
    const payload: Omit<CommentItem, 'id'> = {
      movieId,
      uid: profile.uid,
      userName: profile.displayName,
      userPhoto: profile.photoURL,
      text: clean,
      createdAt: new Date().toISOString(),
      isHidden: false,
    };
    const created = await createComment(payload);
    setComments((prev) => [created, ...prev]);
    notify('Comment posted', 'success');
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteCommentDoc(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    notify('Comment deleted', 'success');
  };

  const handleSubmitReport = async (movieId: string, type: ReportType, message: string) => {
    if (!profile) {
      setAuthModalOpen(true);
      return;
    }
    await createReportDoc({ movieId, uid: profile.uid, type, message });
    notify('Report submitted. Thank you for helping keep links healthy.', 'success');
  };

  const handleShare = async (movie: MovieItem) => {
    const url = `${window.location.origin}/#/movie/${movie.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, text: movie.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        notify('Link copied to clipboard', 'success');
      }
    } catch {
      notify('Link ready to share', 'info');
    }
  };

  const handleSubscribePlan = async (plan: SubscriptionPlan) => {
    if (!authUser || !profile) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const updated = await subscribeUserToPlan(authUser.uid, plan);
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      notify(`Subscribed to ${plan.name}. Assigned videos are now unlocked!`, 'success');
    } catch {
      notify(
        'Unable to activate plan in Firestore. Ensure an admin has saved this plan to the database.',
        'error'
      );
    }
  };

  const handleCancelSubscription = async () => {
    if (!authUser || !profile) return;
    try {
      await cancelUserSubscription(authUser.uid);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              plan: 'free',
              subscriptionPlanId: null,
              subscriptionPlanName: null,
              planExpiresAt: null,
            }
          : prev
      );
      notify('Subscription canceled. Switched back to Free tier.', 'info');
    } catch {
      notify('Could not update subscription status.', 'error');
    }
  };

  // Banned screen
  if (profile?.status === 'banned') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-[#14141c] p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-4 font-display text-2xl font-bold">Your account is suspended</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Access to {settings.siteName} has been restricted by an administrator.
          </p>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="mt-6 rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Maintenance screen (bypassed for admins)
  if (settings.maintenanceMode && !isUserAdmin(profile, authUser)) {
    const maint = settings.maintenance;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-[#14141c] p-8 text-center">
          {maint?.imageUrl ? (
            <img
              src={maint.imageUrl}
              alt="Maintenance"
              className="mx-auto mb-4 h-36 w-full rounded-xl object-cover"
            />
          ) : (
            <Film className="mx-auto h-10 w-10 text-[var(--kv-accent,#e50914)]" />
          )}
          <h1 className="mt-4 font-display text-2xl font-bold">Scheduled Maintenance</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {maint?.message ||
              `${settings.siteName} is undergoing a brief catalog upgrade. We will be back shortly.`}
          </p>
          {maint?.expectedReturnTime && (
            <p className="mt-3 text-xs font-semibold text-amber-400">
              Expected return: {maint.expectedReturnTime}
            </p>
          )}
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-6 text-xs text-zinc-400 underline hover:text-white"
          >
            Administrator Sign In
          </button>
          <AuthModal
            open={authModalOpen}
            allowRegistration={false}
            allowSocialLogin={settings.featureFlags?.socialLogin !== false}
            onClose={() => setAuthModalOpen(false)}
            onGoogleLogin={async () => {
              await signInWithGooglePopup();
            }}
            onEmailLogin={async (e, p) => {
              await signInWithEmail(e, p);
            }}
            onEmailRegister={async () => undefined}
            onForgotPassword={sendResetPassword}
          />
        </div>
      </div>
    );
  }

  // Derived Home rows
  const continueWatchingMovies = history
    .map((h) => moviesMap[h.movieId])
    .filter((m): m is MovieItem => Boolean(m));
  const trendingMovies = movies.filter((m) => m.isTrending);
  const featuredMovies = movies.filter((m) => m.isFeatured);
  const topRatedMovies = sortMovies(movies, 'rating');
  const recentMovies = sortMovies(movies, 'newest');
  const seriesMovies = movies.filter((m) => m.type === 'series');
  const upcomingMovies = movies.filter(
    (m) =>
      m.tags.some((tag) => tag.toLowerCase().includes('upcoming')) ||
      m.releaseYear >= new Date().getFullYear()
  );

  // Announcement visibility (schedule + page targeting)
  const ann = settings.announcement;
  const currentTargetPage: TargetPageKey =
    route.page === 'home' ||
    route.page === 'movies' ||
    route.page === 'series' ||
    route.page === 'plans' ||
    route.page === 'watch' ||
    route.page === 'page'
      ? route.page
      : 'all';
  const announcementMatchesPage =
    !ann?.targetPages ||
    ann.targetPages.length === 0 ||
    ann.targetPages.includes('all') ||
    ann.targetPages.includes(currentTargetPage);
  const showAnnouncement =
    Boolean(ann?.isActive && ann.text) &&
    !announcementDismissed &&
    isWithinSchedule(ann?.startAt, ann?.endAt) &&
    announcementMatchesPage;

  // Navigation & branding customization
  const navCfg = settings.navigation;
  const shapeCfg = settings.shape;
  const brandingCfg = settings.branding;
  const featureFlags = settings.featureFlags;
  const homeCfg = settings.homeLayout;
  const activeLogoUrl =
    theme === 'light' && brandingCfg?.logoLightUrl ? brandingCfg.logoLightUrl : settings.logoUrl;
  const logoCentered = brandingCfg?.logoPosition === 'center';

  const visibleMenuItems = (navCfg?.menuItems ?? []).filter((item) => {
    if (featureFlags?.premiumSection === false && item.href.includes('plans')) return false;
    if (featureFlags?.watchlist === false && item.href.includes('mylist')) return false;
    return true;
  });

  const navPositionClass = shapeCfg?.navbarSticky === false ? 'relative' : 'sticky top-0';
  const navStyleType = shapeCfg?.navbarStyle || 'glass';
  const navBgClass =
    navStyleType === 'solid'
      ? 'border-b border-zinc-200/80 bg-white dark:border-white/10 dark:bg-[#0b0b0f]'
      : navStyleType === 'transparent-to-solid'
      ? scrolled
        ? 'border-b border-zinc-200/80 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0b0f]/95'
        : 'border-b border-transparent bg-gradient-to-b from-black/70 to-transparent text-white'
      : 'border-b border-zinc-200/80 bg-white/80 dark:border-white/10 dark:bg-[#0b0b0f]/80';

  const availableLanguages = Object.keys(settings.i18n?.labels || { en: {} });

  // Watch page episode resolution
  const activeEpisode =
    route.page === 'watch' && activeMovie?.type === 'series'
      ? episodes.find((e) => e.id === route.episodeId) ||
        episodes.find((e) => e.seasonNumber === (route.seasonNum ?? 1)) ||
        episodes[0] ||
        null
      : null;

  const nextEpisode =
    activeEpisode && episodes.length > 0
      ? (() => {
          const idx = episodes.findIndex((e) => e.id === activeEpisode.id);
          return idx >= 0 && idx + 1 < episodes.length ? episodes[idx + 1] : null;
        })()
      : null;

  const myListMovies = movies.filter((m) => watchlistIds.has(m.id));

  const handleFinishEntrance = useCallback(() => {
    setShowEntrance(false);
    try {
      sessionStorage.setItem('kv_intro_seen', '1');
    } catch {}
  }, []);

  const cardWidthClass =
    homeCfg?.cardSize === 'compact'
      ? 'w-32 sm:w-36'
      : homeCfg?.cardSize === 'large'
      ? 'w-48 sm:w-56'
      : 'w-40 sm:w-44';

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <AnimeEntrance
        open={showEntrance}
        siteName={settings.siteName}
        branding={brandingCfg}
        reducedMotion={Boolean(shapeCfg?.reducedMotion)}
        onComplete={handleFinishEntrance}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white">
          <WifiOff className="h-3.5 w-3.5" />
          You are offline. Showing cached catalog data.
        </div>
      )}

      {/* Announcement Bar */}
      {showAnnouncement && ann && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-1.5 text-[11px] font-medium sm:px-6"
          style={{
            backgroundColor: ann.bgColor || 'var(--kv-accent,#e50914)',
            color: ann.textColor || '#ffffff',
          }}
        >
          <div className="w-4 shrink-0" />
          {ann.link ? (
            <a
              href={ann.link}
              onClick={(e) => {
                if (ann.link && !ann.link.startsWith('http')) {
                  e.preventDefault();
                  navigateHref(ann.link);
                }
              }}
              className="truncate text-center underline-offset-2 hover:underline"
            >
              {ann.text}
            </a>
          ) : (
            <p className="truncate text-center">{ann.text}</p>
          )}
          {ann.dismissible !== false ? (
            <button
              type="button"
              onClick={() => setAnnouncementDismissed(true)}
              aria-label="Dismiss announcement"
              className="shrink-0 rounded p-0.5 hover:bg-black/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}
        </div>
      )}

      {/* Customizable Top Navbar */}
      <header
        className={`${navPositionClass} z-50 transition-colors duration-200 ${navBgClass}`}
        style={{
          backdropFilter:
            navStyleType === 'glass' ? `blur(${shapeCfg?.navbarBlur ?? 12}px)` : undefined,
        }}
      >
        <div
          className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6"
          style={{ minHeight: `${shapeCfg?.navbarHeight ?? 64}px` }}
        >
          {/* Zone 1: Brand Wordmark (+ Nav Links on left if centered logo) */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="rounded-lg p-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <a
              href="#/home"
              className={`flex items-center gap-2 font-display text-xl font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0 ${
                logoCentered
                  ? 'md:absolute md:left-1/2 md:-translate-x-1/2'
                  : ''
              }`}
            >
              {activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={settings.siteName}
                  style={{ height: `${brandingCfg?.logoHeight ?? 28}px` }}
                  className="w-auto object-contain"
                />
              ) : (
                <span>{settings.siteName}</span>
              )}
            </a>
          </div>

          {/* Zone 2: Clean Text Nav Links */}
          <nav
            aria-label="Main navigation"
            className={`hidden items-center gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-300 md:flex ${
              logoCentered ? 'mr-auto' : ''
            }`}
          >
            {visibleMenuItems.map((item) => {
              const translated =
                item.href === '#/home'
                  ? t('home', item.label)
                  : item.href === '#/movies'
                  ? t('movies', item.label)
                  : item.href === '#/series'
                  ? t('series', item.label)
                  : item.href === '#/mylist'
                  ? t('mylist', item.label)
                  : item.href === '#/plans'
                  ? t('plans', item.label)
                  : item.label;
              const isActive =
                (item.href === '#/home' && route.page === 'home') ||
                (item.href === '#/movies' && route.page === 'movies') ||
                (item.href === '#/series' && route.page === 'series') ||
                (item.href === '#/mylist' && route.page === 'mylist') ||
                (item.href === '#/plans' && route.page === 'plans') ||
                (item.href.startsWith('#/page/') &&
                  route.page === 'page' &&
                  item.href.endsWith(`/${route.param}`));

              return (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className={`transition-colors hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0 ${
                    isActive ? 'font-semibold text-zinc-950 dark:text-white' : ''
                  }`}
                >
                  {translated}
                </a>
              );
            })}

            <div className="relative">
              <button
                type="button"
                onClick={() => setGenresMenuOpen((v) => !v)}
                aria-expanded={genresMenuOpen}
                className="inline-flex items-center gap-1 transition-colors hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0"
              >
                {t('genres', 'Genres')}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {genresMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-[#14141c]">
                  {genres.map((g) => (
                    <a
                      key={g.id}
                      href={`#/genre/${g.slug}`}
                      className="block rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {g.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Search, Language, Plans, Theme & Account */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {navCfg?.showSearchBar !== false && (
              <div className="relative hidden sm:block">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearchOpen(false);
                    navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
                  }}
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => window.setTimeout(() => setSearchOpen(false), 180)}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setSearchOpen(true);
                    }}
                    placeholder={t('search', 'Search titles, cast...')}
                    aria-label="Search catalog"
                    className="kv-input-radius w-40 border border-zinc-200 bg-zinc-100/80 py-1.5 pl-8 pr-3 text-xs text-zinc-900 outline-none transition-all focus:w-52 focus:border-[var(--kv-accent,#e50914)] dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100"
                  />
                </form>

                {searchOpen && suggestions.length > 0 && (
                  <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#14141c]">
                    {suggestions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => handleSelectMovie(m)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          className="h-10 w-7 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{m.title}</p>
                          <p className="text-[11px] text-zinc-500 tabular-nums">
                            {m.releaseYear} · {m.type}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {featureFlags?.premiumSection !== false && (
              <a
                href="#/plans"
                aria-label="Subscription Plans"
                title="Monthly Subscription Plans"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  route.page === 'plans'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
                }`}
              >
                <Crown className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[110px] truncate">
                  {profile?.plan === 'premium' && profile.subscriptionPlanName
                    ? profile.subscriptionPlanName
                    : t('plans', 'Plans')}
                </span>
              </a>
            )}

            {navCfg?.showLanguageSelector && availableLanguages.length > 0 && (
              <div className="relative hidden sm:flex items-center">
                <Globe className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-zinc-400" />
                <select
                  aria-label="Select language"
                  value={language}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLanguage(next);
                    try {
                      localStorage.setItem('kv_lang', next);
                    } catch {}
                  }}
                  className="kv-input-radius border border-zinc-200 bg-transparent py-1 pl-7 pr-2 text-xs font-medium uppercase dark:border-zinc-800"
                >
                  {availableLanguages.map((code) => (
                    <option key={code} value={code} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white">
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {navCfg?.showThemeToggle !== false && settings.theme?.allowUserThemeToggle !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            {navCfg?.showProfileMenu !== false && (
              profile ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    aria-label="Account menu"
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--kv-accent,#e50914)] text-[10px] font-bold text-white">
                      {profile.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[90px] truncate sm:inline">
                      {profile.displayName}
                    </span>
                  </button>
                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-[#14141c]">
                      <a
                        href="#/profile"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <UserIcon className="h-3.5 w-3.5" />
                        Profile &amp; History
                      </a>
                      {featureFlags?.watchlist !== false && (
                        <a
                          href="#/mylist"
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          {t('mylist', 'My List')}
                        </a>
                      )}
                      {isUserAdmin(profile, authUser) && (
                        <a
                          href="/admin.html"
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--kv-accent,#e50914)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Admin Console
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => signOutUser()}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="kv-primary-btn px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  {t('signIn', 'Sign In')}
                </button>
              )
            )}
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-[#0b0b0f] md:hidden">
            {navCfg?.showSearchBar !== false && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
                }}
                className="mb-3"
              >
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('search', 'Search titles, cast...')}
                  aria-label="Mobile search"
                  className="kv-input-radius w-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
              </form>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm font-medium">
              {visibleMenuItems
                .filter((item) => item.showOnMobile)
                .map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {renderNavIcon(item.icon, 'h-4 w-4 text-zinc-400')}
                    <span>{item.label}</span>
                  </a>
                ))}
              {featureFlags?.premiumSection !== false && (
                <a
                  href="#/plans"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Subscription Plans
                </a>
              )}
              {genres.slice(0, 4).map((g) => (
                <a
                  key={g.id}
                  href={`#/genre/${g.slug}`}
                  className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {g.name}
                </a>
              ))}
              <a
                href="/admin.html"
                className="col-span-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Admin Console
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AdSlot config={settings.ads?.header} label="Header banner" />

        {route.page === 'home' && (() => {
          const heroSection = homeCfg?.sections.find((s) => s.kind === 'hero');
          const showHero = heroSection ? heroSection.visible : true;
          const heroHeight = homeCfg?.heroHeightPx ?? 540;
          const overlayOpacity = homeCfg?.heroOverlayOpacity ?? 0.72;
          const useSlideTransition = homeCfg?.heroTransition === 'slide';
          const activeSlideIdx = heroSlides.length > 0 ? heroIndex % heroSlides.length : 0;

          const orderedSections = (homeCfg?.sections ?? []).filter(
            (s) => s.visible && s.kind !== 'hero'
          );

          const renderMovieRow = (key: string, title: string, list: MovieItem[], actionHash?: string) => {
            if (list.length === 0) return null;
            return (
              <HorizontalRow
                key={key}
                title={title}
                actionLabel={actionHash && homeCfg?.showSeeAllLink !== false ? 'See All' : undefined}
                onAction={actionHash && homeCfg?.showSeeAllLink !== false ? () => navigate(actionHash) : undefined}
              >
                {list.map((m) => (
                  <div key={m.id} className={`${cardWidthClass} shrink-0`}>
                    <MovieCard
                      movie={m}
                      user={profile}
                      plans={plans}
                      adSettings={adSettings}
                      unlocksMap={unlocksMap}
                      inWatchlist={watchlistIds.has(m.id)}
                      history={historyMap[m.id]}
                      shape={shapeCfg}
                      homeLayout={homeCfg}
                      onSelect={handleSelectMovie}
                      onPlay={handlePlayMovie}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  </div>
                ))}
              </HorizontalRow>
            );
          };

          const resolveCollectionMovies = (col: CustomCollection): MovieItem[] => {
            const items = col.movieIds
              .map((id) => moviesMap[id])
              .filter((m): m is MovieItem => Boolean(m));
            if (col.sortOrder === 'newest') return sortMovies(items, 'newest');
            if (col.sortOrder === 'rating') return sortMovies(items, 'rating');
            if (col.sortOrder === 'views') return sortMovies(items, 'views');
            return items;
          };

          return (
            <div>
              {/* Hero Slider */}
              {showHero && (
                catalogLoading ? (
                  <div className="kv-skeleton w-full" style={{ height: `${heroHeight}px` }} />
                ) : heroSlides.length > 0 ? (
                  <section
                    aria-label="Featured spotlight"
                    className="relative w-full overflow-hidden bg-zinc-950"
                    style={{ height: `clamp(380px, 60vw, ${heroHeight}px)` }}
                  >
                    <div
                      className={useSlideTransition ? 'flex h-full transition-transform duration-500 ease-out' : 'relative h-full w-full'}
                      style={
                        useSlideTransition
                          ? {
                              width: `${heroSlides.length * 100}%`,
                              transform: `translateX(-${(activeSlideIdx * 100) / heroSlides.length}%)`,
                            }
                          : undefined
                      }
                    >
                      {heroSlides.map((slide, idx) => {
                        const active = idx === activeSlideIdx;
                        return (
                          <div
                            key={slide.banner.id}
                            className={
                              useSlideTransition
                                ? 'relative h-full shrink-0'
                                : `absolute inset-0 transition-opacity duration-500 ${
                                    active ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'
                                  }`
                            }
                            style={useSlideTransition ? { width: `${100 / heroSlides.length}%` } : undefined}
                          >
                            <img
                              src={slide.banner.imageUrl || slide.movie.bannerUrl || slide.movie.posterUrl}
                              alt={slide.movie.title}
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div
                              className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/55 to-black/25"
                              style={{ opacity: overlayOpacity }}
                            />
                            <div
                              className="absolute inset-0"
                              style={{
                                background: buildLinearGradientCss(settings.theme?.heroGradient),
                                opacity: Math.min(0.45, overlayOpacity * 0.45),
                              }}
                            />

                            <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-12 sm:px-6 sm:pb-16">
                              <div className="max-w-xl text-white">
                                <div className="flex items-center gap-2 text-xs font-medium text-zinc-300 tabular-nums">
                                  <span className="uppercase tracking-wider">{slide.movie.type}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{slide.movie.releaseYear}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatDuration(slide.movie.duration)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{slide.movie.genres.slice(0, 2).join(' · ')}</span>
                                  <AccessBadge
                                    movie={slide.movie}
                                    user={profile}
                                    plans={plans}
                                    adSettings={adSettings}
                                    unlocksMap={unlocksMap}
                                    compactResponsive={false}
                                  />
                                </div>
                                <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                                  {slide.movie.title}
                                </h1>
                                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-200 sm:text-base">
                                  {slide.movie.description}
                                </p>
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                  {homeCfg?.heroShowPlayButton !== false && (
                                    <button
                                      type="button"
                                      onClick={() => handlePlayMovie(slide.movie, undefined, slide.banner.id)}
                                      className="kv-primary-btn inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-lg transition-opacity hover:opacity-90"
                                    >
                                      <Play className="h-4 w-4 fill-current" />
                                      {t('playNow', 'Play Now')}
                                    </button>
                                  )}
                                  {homeCfg?.heroShowMoreInfoButton !== false && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectMovie(slide.movie)}
                                      className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                                    >
                                      <Info className="h-4 w-4" />
                                      More Info
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {heroSlides.length > 1 && homeCfg?.heroShowArrows !== false && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setHeroIndex((i) => (i - 1 + heroSlides.length) % heroSlides.length)
                          }
                          aria-label="Previous spotlight"
                          className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:flex"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeroIndex((i) => (i + 1) % heroSlides.length)}
                          aria-label="Next spotlight"
                          className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:flex"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}

                    {heroSlides.length > 1 && homeCfg?.heroShowDots !== false && (
                      <div className="absolute bottom-5 right-6 z-20 flex items-center gap-2">
                        {heroSlides.map((s, idx) => (
                          <button
                            key={s.banner.id}
                            type="button"
                            onClick={() => setHeroIndex(idx)}
                            aria-label={`Show spotlight ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === activeSlideIdx
                                ? 'w-7 bg-white'
                                : 'w-2.5 bg-white/40 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ) : null
              )}

              {/* Banner Custom Ad Below Hero Spotlight */}
              {customAds.length > 0 && (
                <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
                  <CustomAdSlot
                    placement="banner"
                    customAds={customAds}
                    adSettings={adSettings}
                    user={profile}
                    contentType="all"
                  />
                </div>
              )}

              {/* Ordered Catalog Rows */}
              <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
                {catalogLoading ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <MovieCardSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <>
                    {orderedSections.map((sec, idx) => {
                      let node: React.ReactNode = null;
                      if (sec.kind === 'continue') {
                        node = renderMovieRow(sec.id, sec.title, continueWatchingMovies);
                      } else if (sec.kind === 'trending') {
                        node = renderMovieRow(sec.id, sec.title, trendingMovies, '/movies');
                      } else if (sec.kind === 'featured') {
                        node = renderMovieRow(sec.id, sec.title, featuredMovies, '/movies');
                      } else if (sec.kind === 'top_rated') {
                        node = renderMovieRow(sec.id, sec.title, topRatedMovies, '/movies');
                      } else if (sec.kind === 'recent') {
                        node = renderMovieRow(sec.id, sec.title, recentMovies, '/movies');
                      } else if (sec.kind === 'series') {
                        node = renderMovieRow(sec.id, sec.title, seriesMovies, '/series');
                      } else if (sec.kind === 'upcoming') {
                        node = renderMovieRow(sec.id, sec.title, upcomingMovies);
                      } else if (sec.kind === 'genres') {
                        node = (
                          <React.Fragment key={sec.id}>
                            {genres.map((g) => {
                              const genreItems = movies.filter((m) =>
                                m.genres.some((mg) => slugify(mg) === g.slug || mg === g.name)
                              );
                              return renderMovieRow(`genre-${g.id}`, g.name, genreItems, `/genre/${g.slug}`);
                            })}
                          </React.Fragment>
                        );
                      } else if (sec.kind === 'collection') {
                        const col = (homeCfg?.customCollections ?? []).find(
                          (c) => c.id === sec.collectionId
                        );
                        if (col && isWithinSchedule(col.startAt, col.endAt)) {
                          node = renderMovieRow(
                            sec.id,
                            sec.title || col.title,
                            resolveCollectionMovies(col)
                          );
                        }
                      }

                      return (
                        <React.Fragment key={sec.id}>
                          {node}
                          {idx === 1 && (
                            <>
                              <CustomAdSlot
                                placement="home"
                                customAds={customAds}
                                adSettings={adSettings}
                                user={profile}
                                contentType="all"
                              />
                              <AdSlot config={settings.ads?.betweenRows} label="Catalog promotion" />
                            </>
                          )}
                          {idx === 4 && (
                            <CustomAdSlot
                              placement="home"
                              customAds={customAds}
                              adSettings={adSettings}
                              user={profile}
                              contentType="all"
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {route.page === 'movies' && (
          <BrowseView
            title={t('movies', 'Movies')}
            subtitle="Feature films, documentaries, and restorations."
            movies={movies}
            genres={genres}
            plans={plans}
            unlocksMap={unlocksMap}
            initialType="movie"
            loading={catalogLoading}
            watchlistIds={watchlistIds}
            historyMap={historyMap}
            shape={shapeCfg}
            homeLayout={homeCfg}
            user={profile}
            customAds={customAds}
            adSettings={adSettings}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {route.page === 'series' && (
          <BrowseView
            title={t('series', 'Series')}
            subtitle="Multi-season mysteries, dramas, and anthology adventures."
            movies={movies}
            genres={genres}
            plans={plans}
            unlocksMap={unlocksMap}
            initialType="series"
            loading={catalogLoading}
            watchlistIds={watchlistIds}
            historyMap={historyMap}
            shape={shapeCfg}
            homeLayout={homeCfg}
            user={profile}
            customAds={customAds}
            adSettings={adSettings}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {route.page === 'genre' && (
          <BrowseView
            title={
              genres.find((g) => g.slug === route.param)?.name ??
              (route.param ? route.param.toUpperCase() : 'Genres')
            }
            subtitle="Filtered by genre."
            movies={movies}
            genres={genres}
            plans={plans}
            unlocksMap={unlocksMap}
            initialGenre={route.param ?? 'all'}
            loading={catalogLoading}
            watchlistIds={watchlistIds}
            historyMap={historyMap}
            shape={shapeCfg}
            homeLayout={homeCfg}
            user={profile}
            customAds={customAds}
            adSettings={adSettings}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {route.page === 'search' && (
          <BrowseView
            title={`Search${route.query ? `: "${route.query}"` : ''}`}
            subtitle="Search across titles, cast, directors, genres, and tags."
            movies={movies}
            genres={genres}
            plans={plans}
            unlocksMap={unlocksMap}
            searchQuery={route.query ?? ''}
            loading={catalogLoading}
            watchlistIds={watchlistIds}
            historyMap={historyMap}
            shape={shapeCfg}
            homeLayout={homeCfg}
            user={profile}
            customAds={customAds}
            adSettings={adSettings}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {route.page === 'mylist' && (
          <BrowseView
            title={t('mylist', 'My List')}
            subtitle="Titles saved to watch later."
            movies={myListMovies}
            genres={genres}
            plans={plans}
            unlocksMap={unlocksMap}
            loading={catalogLoading}
            watchlistIds={watchlistIds}
            historyMap={historyMap}
            shape={shapeCfg}
            homeLayout={homeCfg}
            user={profile}
            customAds={customAds}
            adSettings={adSettings}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {route.page === 'plans' && (
          <SubscriptionsView
            plans={plans}
            movies={movies}
            user={profile}
            highlightedPlanId={route.param}
            onSubscribe={handleSubscribePlan}
            onCancelSubscription={handleCancelSubscription}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSelectMovie={handleSelectMovie}
          />
        )}

        {route.page === 'page' && (
          <CustomPageView
            page={activeCustomPage}
            slug={route.param || ''}
            onBackHome={() => navigate('/home')}
            onNotify={notify}
          />
        )}

        {route.page === 'movie' && activeMovie && (
          <DetailsView
            movie={activeMovie}
            allMovies={movies}
            episodes={episodes}
            comments={comments}
            plans={plans}
            user={profile}
            unlocksMap={unlocksMap}
            inWatchlist={watchlistIds.has(activeMovie.id)}
            isLiked={likes.includes(activeMovie.id)}
            userRating={ratings[activeMovie.id] ?? 0}
            historyMap={historyMap}
            watchlistIds={watchlistIds}
            featureFlags={featureFlags}
            shape={shapeCfg}
            homeLayout={homeCfg}
            sidebarAd={settings.ads?.sidebar}
            customAds={customAds}
            adSettings={adSettings}
            onPlay={handlePlayMovie}
            onSelectMovie={handleSelectMovie}
            onToggleWatchlist={handleToggleWatchlist}
            onToggleLike={handleToggleLike}
            onRate={handleRate}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onSubmitReport={handleSubmitReport}
            onShare={handleShare}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSubscribePrompt={(planId) =>
              navigate(planId ? `/plans?plan=${encodeURIComponent(planId)}` : '/plans')
            }
          />
        )}

        {route.page === 'watch' && activeMovie && (() => {
          const activeBanner = route.bannerId
            ? banners.find((b) => b.id === route.bannerId)
            : undefined;
          return (
            <>
              <VideoPlayer
                movie={activeMovie}
                episode={activeEpisode}
                nextEpisode={nextEpisode}
                user={profile}
                plans={plans}
                unlocksMap={unlocksMap}
                bannerAdMode={activeBanner?.adSelectionMode}
                bannerUnlockAdIds={activeBanner?.unlockAdIds}
                initialProgress={historyMap[activeMovie.id]}
                playerConfig={settings.player}
                belowPlayerAd={settings.ads?.belowPlayer}
                customAds={customAds}
                vastAds={vastAds}
                adSettings={adSettings}
                onBack={() => navigate(`/movie/${activeMovie.slug}`)}
                onSaveProgress={handleSaveProgress}
                onSelectEpisode={(ep) => navigate(`/watch/${activeMovie.id}/${ep.seasonNumber}/${ep.id}`)}
                onOpenAuth={() => setAuthModalOpen(true)}
                onSubscribePrompt={(planId) =>
                  navigate(planId ? `/plans?plan=${encodeURIComponent(planId)}` : '/plans')
                }
                onUnlockGranted={handleUnlockGranted}
              />
              <WatchRecommendations
                movie={activeMovie}
                allMovies={movies}
                episodes={episodes}
                activeEpisode={activeEpisode}
                user={profile}
                plans={plans}
                adSettings={adSettings}
                unlocksMap={unlocksMap}
                inWatchlist={watchlistIds.has(activeMovie.id)}
                watchlistIds={watchlistIds}
                historyMap={historyMap}
                shape={shapeCfg}
                homeLayout={homeCfg}
                onSelectEpisode={(ep) => navigate(`/watch/${activeMovie.id}/${ep.seasonNumber}/${ep.id}`)}
                onSelectMovie={handleSelectMovie}
                onPlayMovie={(m) => handlePlayMovie(m)}
                onToggleWatchlist={handleToggleWatchlist}
              />
            </>
          );
        })()}

        {route.page === 'profile' && (
          <ProfileView
            user={profile}
            history={history}
            moviesMap={moviesMap}
            onOpenAuth={() => setAuthModalOpen(true)}
            onUpdateProfile={async (name, photo) => {
              if (!profile) return;
              await updateOwnUserProfile(profile.uid, { displayName: name, photoURL: photo });
              setProfile({ ...profile, displayName: name, photoURL: photo });
              notify('Profile updated', 'success');
            }}
            onUploadAvatar={async (file, onProgress) => {
              if (!profile) throw new Error('Not signed in');
              return uploadFileWithProgress(
                `avatars/${profile.uid}/${Date.now()}-${file.name}`,
                file,
                onProgress
              );
            }}
            onChangePassword={async (pw) => {
              await updateCurrentUserPassword(pw);
              notify('Password updated', 'success');
            }}
            onRemoveHistoryItem={async (movieId) => {
              setHistory((prev) => prev.filter((h) => h.movieId !== movieId));
              if (authUser) await removeUserHistoryItem(authUser.uid, movieId);
              notify('Removed from history', 'success');
            }}
            onClearHistory={async () => {
              const ids = history.map((h) => h.movieId);
              setHistory([]);
              try {
                localStorage.setItem('kv_guest_history', '[]');
              } catch {}
              if (authUser && ids.length > 0) await clearUserHistory(authUser.uid, ids);
              notify('Watch history cleared', 'success');
            }}
            onDeleteAccount={async () => {
              await deleteCurrentUserAccount();
              notify('Account deleted', 'info');
              navigate('/home');
            }}
            onPlayMovie={handlePlayMovie}
            onManagePlans={() => navigate('/plans')}
          />
        )}

        {(route.page === 'notfound' ||
          ((route.page === 'movie' || route.page === 'watch') && !catalogLoading && !activeMovie)) && (
          <div className="mx-auto max-w-lg px-4 py-24 text-center">
            <h1 className="font-display text-3xl font-bold">Title Not Found</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              The page or title you requested is unavailable.
            </p>
            <a
              href="#/home"
              className="kv-primary-btn mt-6 inline-block px-5 py-2.5 text-sm font-semibold"
            >
              Return Home
            </a>
          </div>
        )}
      </main>

      {/* Multi-Column Footer */}
      {(() => {
        const footerCfg = settings.footer;
        const columns = footerCfg?.columns ?? [];
        const enabledSocials = (footerCfg?.socialLinks ?? []).filter(
          (s) => s.enabled && s.url.trim()
        );
        const socialStyle = footerCfg?.socialIconStyle || 'outline';
        const footerLogo = brandingCfg?.footerLogoUrl || activeLogoUrl;
        const footerPages = publishedPages.filter((p) => p.showInFooter);

        return (
          <footer className="border-t border-zinc-200 bg-white py-12 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#08080c] dark:text-zinc-400">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-3">
                  {footerLogo ? (
                    <img
                      src={footerLogo}
                      alt={settings.siteName}
                      className="h-8 w-auto object-contain"
                    />
                  ) : (
                    <p className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {settings.siteName}
                    </p>
                  )}
                  <p className="leading-relaxed">
                    {brandingCfg?.tagline ||
                      'Streaming platform for licensed, original, and public-domain works.'}
                  </p>
                  {enabledSocials.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {enabledSocials.map((s) => (
                        <a
                          key={s.platform}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={s.platform}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold uppercase transition-colors ${
                            socialStyle === 'filled'
                              ? 'bg-[var(--kv-accent,#e50914)] text-white hover:opacity-90'
                              : socialStyle === 'minimal'
                              ? 'text-zinc-500 hover:text-[var(--kv-accent,#e50914)]'
                              : 'border border-zinc-300 text-zinc-600 hover:border-[var(--kv-accent,#e50914)] hover:text-[var(--kv-accent,#e50914)] dark:border-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {renderSocialBadge(s.platform)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {columns.map((col) => (
                  <div key={col.id}>
                    <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      {col.title}
                    </h3>
                    <ul className="space-y-2">
                      {col.links.map((link) => (
                        <li key={`${col.id}-${link.label}`}>
                          <a
                            href={link.href}
                            className="transition-colors hover:text-zinc-900 dark:hover:text-white"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {columns.length < 2 && footerPages.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Pages
                    </h3>
                    <ul className="space-y-2">
                      {footerPages.map((pg) => (
                        <li key={pg.id}>
                          <a
                            href={`#/page/${pg.slug}`}
                            className="transition-colors hover:text-zinc-900 dark:hover:text-white"
                          >
                            {pg.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-10 flex flex-col justify-between gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800/80 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">
                    {formatCopyrightText(
                      footerCfg?.copyrightText || `© {year} ${settings.siteName}. All rights reserved.`
                    )}
                  </p>
                  {footerCfg?.disclaimerText && (
                    <p className="max-w-2xl text-[11px] text-zinc-400">{footerCfg.disclaimerText}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="/admin.html"
                    className="font-medium text-zinc-700 transition-colors hover:text-[var(--kv-accent,#e50914)] dark:text-zinc-200"
                  >
                    Admin Console
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowEntrance(true)}
                    className="transition-colors hover:text-zinc-900 dark:hover:text-white"
                  >
                    Replay Intro
                  </button>
                </div>
              </div>
            </div>
          </footer>
        );
      })()}

      {/* Mobile Bottom Tab Bar */}
      {(() => {
        const tabs = (navCfg?.mobileTabs ?? []).filter((tab) => {
          if (!tab.enabled) return false;
          if (featureFlags?.premiumSection === false && tab.href.includes('plans')) return false;
          if (featureFlags?.watchlist === false && tab.href.includes('mylist')) return false;
          return true;
        });
        if (tabs.length === 0) return null;
        return (
          <nav
            aria-label="Mobile navigation"
            className="fixed bottom-0 left-0 right-0 z-40 grid border-t border-zinc-200 bg-white/95 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-[#0b0b0f]/95 md:hidden"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
                  tab.href.includes('plans')
                    ? 'text-amber-500'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {renderNavIcon(tab.icon, 'h-4 w-4')}
                <span className="truncate max-w-full px-1">{tab.label}</span>
              </a>
            ))}
          </nav>
        );
      })()}

      {/* Global Overlays: Welcome/Promo/App-Install Popup + Cookie Consent */}
      <SitePopupOverlay popup={settings.popup} onNavigateHref={navigateHref} />
      <CookieConsentBar cookie={settings.cookieConsent} onNavigateHref={navigateHref} />

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        allowRegistration={settings.allowRegistration}
        allowSocialLogin={featureFlags?.socialLogin !== false}
        onClose={() => setAuthModalOpen(false)}
        onGoogleLogin={async () => {
          await signInWithGooglePopup();
          notify('Signed in with Google', 'success');
        }}
        onEmailLogin={async (e, p) => {
          await signInWithEmail(e, p);
          notify('Signed in', 'success');
        }}
        onEmailRegister={async (e, p, name) => {
          await registerWithEmail(e, p, name);
          notify('Account created. Verification email sent.', 'success');
        }}
        onForgotPassword={async (e) => {
          await sendResetPassword(e);
          notify('Password reset email sent', 'info');
        }}
      />
    </div>
  );
}

export default function UserApp() {
  return (
    <ToastProvider>
      <UserPanelShell />
    </ToastProvider>
  );
}
