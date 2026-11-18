export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'banned';
export type UserPlan = 'free' | 'premium';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  pricePerMonth: number;
  currency: string;
  billingInterval: 'monthly';
  description: string;
  features: string[];
  badgeColor: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  subscriptionPlanId?: string | null;
  subscriptionPlanName?: string | null;
  planExpiresAt: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export type VideoSourceType = 'mp4' | 'hls' | 'embed';

export interface VideoSource {
  label: string;
  url: string;
  type: VideoSourceType;
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  url: string;
}

export type TitleType = 'movie' | 'series';
export type TitleStatus = 'published' | 'draft';
export type AgeRating = 'G' | 'PG' | 'PG-13' | 'R' | 'TV-MA';

export type AccessMode =
  | 'free'
  | 'subscription_only'
  | 'ad_unlock_only'
  | 'subscription_or_ad'
  | 'inherit';

export type AdUnlockValidityMode = 'episode_hours' | 'session';
export type AdUnlockFailureFallback = 'keep_locked' | 'allow_once';

export interface AccessRule {
  mode: AccessMode;
  planId?: string | null;
  planName?: string | null;
  requiresSignIn?: boolean;
  adUnlockAllowed?: boolean;
  adsRequired?: number;
  adSource?: 'any_vast' | 'specific_ad_ids';
  adIds?: string[];
  unlockValidityHours?: number | null;
  unlockValidityMode?: AdUnlockValidityMode | null;
}

export interface MovieItem {
  id: string;
  title: string;
  slug: string;
  type: TitleType;
  description: string;
  releaseYear: number;
  duration: number;
  rating: number;
  ageRating: AgeRating;
  language: string;
  country: string;
  genres: string[];
  cast: string[];
  director: string;
  tags: string[];
  posterUrl: string;
  bannerUrl: string;
  trailerUrl: string;
  videoSources: VideoSource[];
  subtitles: SubtitleTrack[];
  isFeatured: boolean;
  isTrending: boolean;
  isPremium: boolean;
  requiresSignIn?: boolean;
  requiredPlanId?: string | null;
  requiredPlanName?: string | null;
  access?: AccessRule;
  seasonAccess?: Record<string, AccessRule>;
  status: TitleStatus;
  views: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeItem {
  id: string;
  seriesId: string;
  seasonId: string;
  seasonNumber: number;
  number: number;
  title: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
  videoSources: VideoSource[];
  subtitles: SubtitleTrack[];
  access?: AccessRule;
  createdAt: string;
}

export interface GenreItem {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export interface BannerItem {
  id: string;
  movieId: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  adSelectionMode?: 'inherit' | 'specific_ad_ids';
  unlockAdIds?: string[];
}

export interface WatchlistItem {
  movieId: string;
  addedAt: string;
}

export interface WatchHistoryItem {
  movieId: string;
  progressSeconds: number;
  durationSeconds: number;
  seasonId?: string;
  episodeId?: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  movieId: string;
  uid: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: string;
  isHidden: boolean;
}

export type ReportType = 'broken link' | 'wrong info' | 'other';
export type ReportStatus = 'open' | 'resolved';

export interface ReportItem {
  id: string;
  movieId: string;
  uid: string;
  type: ReportType;
  message: string;
  status: ReportStatus;
  createdAt: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

// --- Site Customization Architecture (Tabs 1–11) ---

export interface BrandingSettings {
  tagline: string;
  logoLightUrl: string;
  footerLogoUrl: string;
  faviconUrl: string;
  appIconUrl: string;
  logoHeight: number;
  logoPosition: 'left' | 'center';
  splashEnabled: boolean;
  splashLogoUrl: string;
  splashAnimation: 'fade' | 'pulse' | 'spinner';
  splashBgColor: string;
}

export interface ThemeColorPalette {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  navbarBgColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

export interface GradientConfig {
  angle: number;
  stops: string[];
}

export interface CustomThemePreset {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: ThemeColorPalette;
}

export interface ThemeSettings {
  activePresetId: string;
  colors: ThemeColorPalette;
  customPresets: CustomThemePreset[];
  defaultMode: 'dark' | 'light' | 'system';
  allowUserThemeToggle: boolean;
  heroGradient: GradientConfig;
  buttonGradient: GradientConfig;
}

export interface TypographySettings {
  headingFont: string;
  bodyFont: string;
  baseFontSize: number;
  headingWeight: 500 | 600 | 700 | 800;
  letterSpacing: number;
  lineHeight: number;
}

export interface ShapeSettings {
  radiusPreset: 'sharp' | 'rounded' | 'pill';
  cardRadius: number;
  buttonRadius: number;
  inputRadius: number;
  modalRadius: number;
  posterRatio: '2:3' | '16:9' | '1:1';
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'strong';
  cardBorder: boolean;
  hoverEffect: 'scale' | 'glow' | 'lift' | 'none';
  hoverSpeedMs: number;
  buttonStyle: 'filled' | 'outline' | 'gradient';
  buttonSize: 'sm' | 'md' | 'lg';
  navbarStyle: 'solid' | 'transparent-to-solid' | 'glass';
  navbarBlur: number;
  navbarSticky: boolean;
  navbarHeight: number;
  reducedMotion: boolean;
}

export type HomeSectionKind =
  | 'hero'
  | 'continue'
  | 'trending'
  | 'recent'
  | 'top_rated'
  | 'featured'
  | 'genres'
  | 'series'
  | 'upcoming'
  | 'collection';

export interface HomeSectionConfig {
  id: string;
  kind: HomeSectionKind;
  title: string;
  visible: boolean;
  collectionId?: string;
}

export interface CustomCollection {
  id: string;
  title: string;
  movieIds: string[];
  sortOrder: 'manual' | 'newest' | 'rating' | 'views';
  startAt?: string;
  endAt?: string;
}

export interface HomeLayoutSettings {
  sections: HomeSectionConfig[];
  heroAutoplay: boolean;
  heroIntervalSec: number;
  heroHeightPx: number;
  heroOverlayOpacity: number;
  heroTransition: 'fade' | 'slide';
  heroShowDots: boolean;
  heroShowArrows: boolean;
  heroShowPlayButton: boolean;
  heroShowMoreInfoButton: boolean;
  heroMaxSlides: number;
  itemsPerRowDesktop: number;
  itemsPerRowTablet: number;
  itemsPerRowMobile: number;
  cardSize: 'compact' | 'standard' | 'large';
  showCardRating: boolean;
  showCardYear: boolean;
  showCardBadges: boolean;
  showSeeAllLink: boolean;
  browseMode: 'grid' | 'carousel';
  browseCardsPerRow: number;
  customCollections: CustomCollection[];
}

export type NavIconName =
  | 'home'
  | 'film'
  | 'tv'
  | 'bookmark'
  | 'crown'
  | 'search'
  | 'user'
  | 'compass'
  | 'star'
  | 'info'
  | 'mail';

export interface NavMenuItem {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
  showOnMobile: boolean;
  external?: boolean;
}

export interface MobileTabConfig {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
  enabled: boolean;
}

export interface NavigationSettings {
  menuItems: NavMenuItem[];
  showSearchBar: boolean;
  showThemeToggle: boolean;
  showLanguageSelector: boolean;
  showProfileMenu: boolean;
  mobileTabs: MobileTabConfig[];
}

export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}

export type SocialPlatform = 'instagram' | 'youtube' | 'telegram' | 'x' | 'facebook' | 'whatsapp';

export interface SocialLinkItem {
  platform: SocialPlatform;
  url: string;
  enabled: boolean;
}

export interface FooterSettings {
  columns: FooterColumn[];
  copyrightText: string;
  disclaimerText: string;
  socialIconStyle: 'outline' | 'filled' | 'minimal';
  socialLinks: SocialLinkItem[];
}

export type TargetPageKey = 'all' | 'home' | 'movies' | 'series' | 'plans' | 'watch' | 'page';

export interface AnnouncementSettings {
  text: string;
  isActive: boolean;
  link?: string;
  bgColor?: string;
  textColor?: string;
  dismissible?: boolean;
  startAt?: string;
  endAt?: string;
  targetPages?: TargetPageKey[];
}

export interface PopupSettings {
  enabled: boolean;
  type: 'welcome' | 'promo' | 'app-install';
  imageUrl: string;
  title: string;
  text: string;
  buttonLabel: string;
  buttonHref: string;
  frequency: 'once' | 'session' | 'daily';
  startAt?: string;
  endAt?: string;
}

export interface MaintenanceSettings {
  message: string;
  imageUrl: string;
  expectedReturnTime: string;
}

export interface CookieConsentSettings {
  enabled: boolean;
  text: string;
  linkLabel: string;
  linkHref: string;
}

export interface PlayerCustomSettings {
  accentColor: string;
  controlBarStyle: 'compact' | 'full';
  defaultQuality: '1080p' | '720p' | 'auto';
  defaultSpeed: number;
  defaultSubtitleLang: string;
  autoplayNext: boolean;
  countdownSeconds: number;
  showSkipIntro: boolean;
  skipIntroSeconds: number;
  enablePiP: boolean;
  showDownloadButton: boolean;
  enableSpeedControl: boolean;
  enableKeyboardShortcuts: boolean;
  watermarkEnabled: boolean;
  watermarkMode: 'text' | 'image';
  watermarkText: string;
  watermarkImageUrl: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  watermarkOpacity: number;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleBgOpacity: number;
  subtitlePosition: 'bottom' | 'top';
  loadingImageUrl: string;
}

export interface SeoSettings {
  metaTitleTemplate: string;
  description: string;
  keywords: string;
  ogImageUrl: string;
  useTitlePosterForOg: boolean;
  canonicalBaseUrl: string;
  googleAnalyticsId: string;
  searchConsoleVerification: string;
  enableJsonLd: boolean;
}

export interface CustomCodeSettings {
  safeMode: boolean;
  customCss: string;
  customJs: string;
}

export interface AdPlacementConfig {
  enabled: boolean;
  snippet: string;
}

export interface AdsSettings {
  header: AdPlacementConfig;
  betweenRows: AdPlacementConfig;
  belowPlayer: AdPlacementConfig;
  sidebar: AdPlacementConfig;
}

export interface I18nSettings {
  defaultLanguage: string;
  labels: Record<string, Record<string, string>>;
}

export interface FeatureFlags {
  comments: boolean;
  ratings: boolean;
  watchlist: boolean;
  registration: boolean;
  socialLogin: boolean;
  premiumSection: boolean;
  reports: boolean;
}

export interface SiteSettings {
  siteName: string;
  logoUrl: string;
  primaryColor: string;
  announcement: AnnouncementSettings;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  footerLinks: FooterLink[];
  tmdbApiKey?: string;
  branding?: BrandingSettings;
  theme?: ThemeSettings;
  typography?: TypographySettings;
  shape?: ShapeSettings;
  homeLayout?: HomeLayoutSettings;
  navigation?: NavigationSettings;
  footer?: FooterSettings;
  popup?: PopupSettings;
  maintenance?: MaintenanceSettings;
  cookieConsent?: CookieConsentSettings;
  player?: PlayerCustomSettings;
  seo?: SeoSettings;
  customCode?: CustomCodeSettings;
  ads?: AdsSettings;
  i18n?: I18nSettings;
  featureFlags?: FeatureFlags;
}

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  contentHtml: string;
  showContactForm: boolean;
  status: 'published' | 'draft';
  showInFooter: boolean;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  pageSlug: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  adminUid: string;
  action: string;
  targetId: string;
  createdAt: string;
}

export type SortOption = 'newest' | 'rating' | 'views' | 'title';

export interface BrowseFilters {
  type?: TitleType | 'all';
  genre?: string;
  minYear?: number;
  maxYear?: number;
  minRating?: number;
  language?: string;
  access?: 'all' | 'free' | 'signin' | 'premium' | 'ad_unlock' | 'ad_only' | 'sub_only';
}

export interface DashboardStats {
  totalMovies: number;
  totalSeries: number;
  totalUsers: number;
  premiumUsers: number;
  totalViews: number;
  openReports: number;
  newUsersLast7Days: number;
}

// --- Advertising Module (Custom Image Ads + VAST Video Ads) ---

export type AdPlacementType = 'player' | 'home' | 'banner';
export type AdTargetContentType = 'all' | 'movie' | 'video' | 'tvshow';
export type AdAudience = 'all' | 'free' | 'premium' | 'guest';
export type AdDevice = 'desktop' | 'mobile' | 'tablet';
export type AdManualStatus = 'active' | 'inactive';
export type AdComputedStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

export interface CustomAdItem {
  id: string;
  name: string;
  type: 'image';
  placement: AdPlacementType;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  redirectUrl: string;
  openInNewTab: boolean;
  targetContentType: AdTargetContentType;
  targetIds: string[];
  startDate: string;
  endDate: string;
  status: AdManualStatus;
  priority: number;
  weight: number;
  dailyImpressionCap: number;
  devices: AdDevice[];
  audience: AdAudience;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type VastAdType = 'pre-roll' | 'mid-roll' | 'post-roll' | 'overlay';

export interface VastAdItem {
  id: string;
  name: string;
  type: VastAdType;
  vastTagUrl: string;
  targetType: Exclude<AdTargetContentType, 'all'>;
  targetIds: string[];
  midRollAtSeconds: number[];
  overlayStartSeconds: number;
  overlayDurationSeconds: number;
  skipAfterSeconds: number;
  startDate: string;
  endDate: string;
  status: AdManualStatus;
  priority: number;
  audience: AdAudience;
  devices: AdDevice[];
  impressions: number;
  completions: number;
  skips: number;
  clicks: number;
  errors: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type AdKind = 'custom' | 'vast';
export type AdEventName = 'impression' | 'click' | 'complete' | 'skip' | 'error';

export interface AdEventItem {
  id: string;
  adId: string;
  adKind: AdKind;
  event: AdEventName;
  contentId: string;
  contentType: string;
  placement: string;
  uid: string;
  device: AdDevice;
  createdAt: string;
}

export interface AdUnlockSettings {
  adUnlockEnabled: boolean;
  allowGuestAdUnlock: boolean;
  unlockValidityMode: AdUnlockValidityMode;
  unlockValidityHours: number;
  maxUnlocksPerHour: number;
  unlockSkipAllowed: boolean;
  adErrorFallback: AdUnlockFailureFallback;
  gateTitle: string;
  gateDescription: string;
  paidBadgeText: string;
  adBadgeText: string;
  freeBadgeText: string;
  includedBadgeText: string;
  showCardBadges: boolean;
  showFreeBadge: boolean;
  showIncludedBadge: boolean;
}

export interface AdUnlockRecord {
  contentId: string;
  contentType: 'movie' | 'episode';
  seriesId?: string | null;
  unlockedAt: string;
  expiresAt: string | null;
  adId: string;
  method: 'rewarded_ad';
}

export type AccessEventName =
  | 'gate_impression'
  | 'ad_unlock_start'
  | 'ad_unlock_complete'
  | 'ad_unlock_fail'
  | 'ad_unlock_cancel'
  | 'subscribe_cta_click'
  | 'rate_limit_hit';

export interface AccessEventItem {
  id: string;
  event: AccessEventName;
  contentId: string;
  contentType: 'movie' | 'episode';
  seriesId?: string | null;
  adId?: string;
  uid: string;
  device: AdDevice;
  createdAt: string;
}

export interface AdGlobalSettings {
  adsEnabled: boolean;
  hideAdsForPremium: boolean;
  maxAdsPerSession: number;
  minSecondsBetweenVideoAds: number;
  adLabelText: string;
  showAdLabel: boolean;
  testMode: boolean;
  defaultDailyCap: number;
  unlockSettings?: AdUnlockSettings;
}

