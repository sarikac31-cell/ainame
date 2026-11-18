import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Film,
  Flag,
  Heart,
  LogIn,
  Play,
  Plus,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  AdGlobalSettings,
  AdPlacementConfig,
  AdUnlockRecord,
  CommentItem,
  CustomAdItem,
  EpisodeItem,
  FeatureFlags,
  HomeLayoutSettings,
  MovieItem,
  ReportType,
  ShapeSettings,
  SubscriptionPlan,
  UserProfile,
  WatchHistoryItem,
} from '../../types/streaming';
import {
  canCommentRateLimit,
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  getSimilarMovies,
  sanitizeText,
} from '../../utils/catalog';
import { canWatch, resolveEffectiveAccess } from '../../utils/accessControl';
import { Modal } from '../ui/Modal';
import { AccessBadge } from './AccessBadge';
import { CustomAdSlot } from './CustomAdSlot';
import { MovieCard } from './MovieCard';
import { AdSlot } from './SiteOverlays';
import { buildCleanYouTubeEmbedUrl, extractYouTubeVideoId } from '../../utils/youtube';

interface DetailsViewProps {
  movie: MovieItem;
  allMovies: MovieItem[];
  episodes: EpisodeItem[];
  comments: CommentItem[];
  plans: SubscriptionPlan[];
  user: UserProfile | null;
  inWatchlist: boolean;
  isLiked: boolean;
  userRating: number;
  historyMap: Record<string, WatchHistoryItem>;
  watchlistIds: Set<string>;
  unlocksMap?: Record<string, AdUnlockRecord>;
  featureFlags?: FeatureFlags;
  shape?: ShapeSettings;
  homeLayout?: HomeLayoutSettings;
  sidebarAd?: AdPlacementConfig;
  customAds?: CustomAdItem[];
  adSettings?: AdGlobalSettings;
  onPlay: (movie: MovieItem, episode?: EpisodeItem) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleWatchlist: (movie: MovieItem) => void;
  onToggleLike: (movie: MovieItem) => void;
  onRate: (movie: MovieItem, value: number) => void;
  onAddComment: (movieId: string, text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSubmitReport: (movieId: string, type: ReportType, message: string) => Promise<void>;
  onShare: (movie: MovieItem) => void;
  onOpenAuth: () => void;
  onSubscribePrompt: (planId?: string) => void;
}

export function DetailsView({
  movie,
  allMovies,
  episodes,
  comments,
  plans,
  user,
  inWatchlist,
  isLiked,
  userRating,
  historyMap,
  watchlistIds,
  unlocksMap = {},
  featureFlags,
  shape,
  homeLayout,
  sidebarAd,
  customAds = [],
  adSettings,
  onPlay,
  onSelectMovie,
  onToggleWatchlist,
  onToggleLike,
  onRate,
  onAddComment,
  onDeleteComment,
  onSubmitReport,
  onShare,
  onOpenAuth,
  onSubscribePrompt,
}: DetailsViewProps) {
  const seasons = useMemo(() => {
    const nums = Array.from(new Set(episodes.map((e) => e.seasonNumber))).sort((a, b) => a - b);
    return nums.length > 0 ? nums : [1];
  }, [episodes]);

  const [selectedSeason, setSelectedSeason] = useState(seasons[0]);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('broken link');
  const [reportMsg, setReportMsg] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [lastCommentMs, setLastCommentMs] = useState(0);
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    setSelectedSeason(seasons[0]);
  }, [movie.id, seasons]);

  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((e) => e.seasonNumber === selectedSeason)
        .sort((a, b) => a.number - b.number),
    [episodes, selectedSeason]
  );

  const hasMixedFreeEpisodes = useMemo(() => {
    if (movie.type !== 'series' || episodes.length === 0) return false;
    const modes = episodes.map((ep) => resolveEffectiveAccess(movie, ep).mode);
    return modes.includes('free') && modes.some((m) => m !== 'free');
  }, [movie, episodes]);

  const similarMovies = useMemo(() => getSimilarMovies(movie, allMovies, 6), [movie, allMovies]);
  const movieHistory = historyMap[movie.id];
  const access = useMemo(
    () =>
      canWatch({
        user,
        movie,
        episode: seasonEpisodes[0] ?? null,
        plans,
        unlocksMap,
        adSettings,
      }),
    [movie, seasonEpisodes, user, plans, unlocksMap, adSettings]
  );

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError('');
    if (!user) {
      onOpenAuth();
      return;
    }
    const clean = sanitizeText(commentText, 1000);
    if (!clean) {
      setCommentError('Write a comment before posting.');
      return;
    }
    const limitCheck = canCommentRateLimit(lastCommentMs);
    if (!limitCheck.allowed) {
      setCommentError(`Please wait ${limitCheck.waitSeconds}s before posting again.`);
      return;
    }
    setSubmittingComment(true);
    try {
      await onAddComment(movie.id, clean);
      setCommentText('');
      setLastCommentMs(Date.now());
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    const clean = sanitizeText(reportMsg, 1000);
    if (!clean) return;
    setSubmittingReport(true);
    try {
      await onSubmitReport(movie.id, reportType, clean);
      setReportMsg('');
      setReportOpen(false);
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="pb-16">
      {/* Backdrop Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-white/10">
        <div className="absolute inset-0">
          <img
            src={movie.bannerUrl || movie.posterUrl}
            alt={movie.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/80 to-[#0b0b0f]/45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/75 to-transparent" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:py-16">
          <div className="hidden w-52 shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-2xl md:block">
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              referrerPolicy="no-referrer"
              className="aspect-[3/4] w-full object-cover"
            />
          </div>

          <div className="flex-1 text-white">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-300 tabular-nums">
              <span className="uppercase tracking-wider text-zinc-200">{movie.type}</span>
              <span aria-hidden="true">·</span>
              <span>{movie.releaseYear}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(movie.duration)}</span>
              <span aria-hidden="true">·</span>
              <span>{movie.ageRating}</span>
              <span aria-hidden="true">·</span>
              <span>{movie.language}</span>
              <span aria-hidden="true">·</span>
              <AccessBadge
                movie={movie}
                user={user}
                plans={plans}
                adSettings={adSettings}
                episodes={episodes}
                unlocksMap={unlocksMap}
                compactResponsive={false}
              />
            </div>

            <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {movie.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-400 tabular-nums">
                <Star className="h-4 w-4 fill-current" />
                {movie.rating.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{movie.genres.join(' · ')}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatCompactNumber(movie.views)} views</span>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-200 sm:text-base">
              {movie.description}
            </p>

            <div className="mt-4 space-y-1 text-xs text-zinc-400 sm:text-sm">
              {movie.director && (
                <p>
                  <span className="text-zinc-500">Director:</span> {movie.director}
                </p>
              )}
              {movie.cast.length > 0 && (
                <p>
                  <span className="text-zinc-500">Cast:</span> {movie.cast.join(', ')}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPlay(movie, seasonEpisodes[0])}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--kv-accent,#e50914)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                {movieHistory && movieHistory.progressSeconds > 10 ? 'Resume' : 'Play Now'}
              </button>

              {!access.allowed && access.reason === 'sign_in_required' && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 whitespace-nowrap"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In to Watch
                </button>
              )}

              {!access.allowed && access.canSubscribe && (
                <button
                  type="button"
                  onClick={() =>
                    onSubscribePrompt(access.requiredPlan?.id ?? movie.requiredPlanId ?? undefined)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-200 backdrop-blur-sm transition-colors hover:bg-amber-500/30 whitespace-nowrap"
                >
                  <Crown className="h-4 w-4" />
                  Get {access.planName} ({access.priceText})
                </button>
              )}

              {movie.trailerUrl && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 whitespace-nowrap"
                >
                  <Film className="h-4 w-4" />
                  Trailer
                </button>
              )}

              {featureFlags?.watchlist !== false && (
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(movie)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 whitespace-nowrap"
                >
                  {inWatchlist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {inWatchlist ? 'In My List' : 'My List'}
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleLike(movie)}
                aria-label="Like title"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-3 text-sm font-medium backdrop-blur-sm transition-colors tabular-nums whitespace-nowrap ${
                  isLiked
                    ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                    : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                {formatCompactNumber(movie.likesCount)}
              </button>

              <button
                type="button"
                onClick={() => onShare(movie)}
                aria-label="Share title"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" />
              </button>

              {featureFlags?.reports !== false && (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  aria-label="Report broken link or issue"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <Flag className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Star Rating */}
            {featureFlags?.ratings !== false && (
              <div className="mt-5 flex items-center gap-3 text-xs text-zinc-300">
                <span>Your rating:</span>
                <div className="flex items-center gap-1" role="group" aria-label="Rate this title">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => onRate(movie, star)}
                      aria-label={`Rate ${star} stars`}
                      className={`p-0.5 transition-transform hover:scale-110 ${
                        star <= userRating ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Star className={`h-4 w-4 ${star <= userRating ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
                {userRating > 0 && <span className="tabular-nums text-zinc-400">({userRating}/5)</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-10 sm:px-6">
        {/* Series Episodes */}
        {movie.type === 'series' && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-xl font-bold">Episodes</h2>
                {hasMixedFreeEpisodes && (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    Some episodes free
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-zinc-200/80 p-1 dark:bg-zinc-900">
                {seasons.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSeason(s)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedSeason === s
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    Season {s}
                  </button>
                ))}
              </div>
            </div>

            {seasonEpisodes.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No episodes added for Season {selectedSeason} yet.
              </p>
            ) : (
              <div className="grid gap-3">
                {seasonEpisodes.map((ep) => {
                  const isCurrentEp = movieHistory?.episodeId === ep.id;
                  const epProgressPct =
                    isCurrentEp && movieHistory && movieHistory.durationSeconds > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (movieHistory.progressSeconds / movieHistory.durationSeconds) * 100
                          )
                        )
                      : 0;
                  const epEval = canWatch({
                    user,
                    movie,
                    episode: ep,
                    plans,
                    unlocksMap,
                    adSettings,
                  });
                  return (
                    <div
                      key={ep.id}
                      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#13131c] dark:hover:border-zinc-700 sm:flex-row sm:items-center"
                    >
                      <button
                        type="button"
                        onClick={() => onPlay(movie, ep)}
                        className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-48"
                      >
                        <img
                          src={ep.thumbnailUrl || movie.bannerUrl || movie.posterUrl}
                          alt={ep.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </div>
                        {epProgressPct > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                            <div
                              className="h-full bg-[var(--kv-accent,#e50914)]"
                              style={{ width: `${epProgressPct}%` }}
                            />
                          </div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h3 className="font-display text-base font-semibold truncate">
                              {ep.number}. {ep.title}
                            </h3>
                            <AccessBadge
                              movie={movie}
                              episode={ep}
                              user={user}
                              plans={plans}
                              adSettings={adSettings}
                              unlocksMap={unlocksMap}
                              compactResponsive={false}
                            />
                            {epEval.reason === 'ad_unlocked' && epEval.expiresInText && (
                              <span className="text-[11px] font-medium text-emerald-400">
                                · {epEval.expiresInText}
                              </span>
                            )}
                          </div>
                          <span className="font-mono-tabular shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                            {ep.duration}m
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {ep.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Banner Custom Ad + Legacy Opt-In Details Ad Slot */}
        {adSettings && customAds.length > 0 && (
          <CustomAdSlot
            placement="banner"
            customAds={customAds}
            adSettings={adSettings}
            user={user}
            contentType={movie.type === 'series' ? 'tvshow' : 'movie'}
            contentId={movie.id}
          />
        )}
        <AdSlot config={sidebarAd} label="Details promotion" />

        {/* More Like This */}
        {similarMovies.length > 0 && (
          <section>
            <h2 className="mb-5 font-display text-xl font-bold">More Like This</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {similarMovies.map((sim) => (
                <MovieCard
                  key={sim.id}
                  movie={sim}
                  inWatchlist={watchlistIds.has(sim.id)}
                  history={historyMap[sim.id]}
                  shape={shape}
                  homeLayout={homeLayout}
                  user={user}
                  plans={plans}
                  adSettings={adSettings}
                  unlocksMap={unlocksMap}
                  onSelect={onSelectMovie}
                  onPlay={(m) => onPlay(m)}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          </section>
        )}

        {/* Comments Section */}
        {featureFlags?.comments !== false && (
          <section className="max-w-3xl">
            <h2 className="mb-4 font-display text-xl font-bold">
              Discussion ({comments.length})
            </h2>

          <form onSubmit={handleCommentSubmit} className="mb-6 space-y-3">
            <label htmlFor="comment-input" className="sr-only">
              Add a comment
            </label>
            <textarea
              id="comment-input"
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                user ? 'Share your thoughts on this title...' : 'Sign in to join the discussion...'
              }
              maxLength={1000}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[var(--kv-accent,#e50914)] dark:border-zinc-800 dark:bg-[#13131c] dark:text-zinc-100"
            />
            {commentError && <p className="text-xs text-rose-500">{commentError}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {commentText.length}/1000
              </span>
              <button
                type="submit"
                disabled={submittingComment}
                className="rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {comments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No comments yet. Start the conversation.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {comments
                .filter((c) => !c.isHidden)
                .map((c) => (
                  <div key={c.id} className="flex items-start gap-3 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {c.userPhoto ? (
                        <img
                          src={c.userPhoto}
                          alt={c.userName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        c.userName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {c.userName}
                          </span>
                          <span aria-hidden="true" className="text-zinc-400">
                            ·
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        {user && (user.uid === c.uid || user.role === 'admin') && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(c.id)}
                            aria-label="Delete comment"
                            className="rounded p-1 text-zinc-400 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
          </section>
        )}
      </div>

      {/* Trailer Modal */}
      <Modal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        title={`${movie.title} — Trailer`}
        maxWidthClass="max-w-3xl"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {(() => {
            const ytTrailerId = movie.trailerUrl ? extractYouTubeVideoId(movie.trailerUrl) : null;
            if (ytTrailerId) {
              return (
                <iframe
                  src={`${buildCleanYouTubeEmbedUrl(ytTrailerId, window.location.origin)}&autoplay=1`}
                  title={`${movie.title} Trailer`}
                  className="h-full w-full origin-center scale-[1.18]"
                  allow="autoplay; encrypted-media"
                />
              );
            }
            return <video src={movie.trailerUrl} controls autoPlay className="h-full w-full" />;
          })()}
        </div>
      </Modal>

      {/* Report Issue Modal */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report Issue — ${movie.title}`}
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div>
            <label htmlFor="report-type" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Issue Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="broken link">Broken Link</option>
              <option value="wrong info">Wrong Metadata / Info</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-msg" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Details
            </label>
            <textarea
              id="report-msg"
              rows={3}
              required
              value={reportMsg}
              onChange={(e) => setReportMsg(e.target.value)}
              placeholder="Describe the playback or metadata issue..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingReport}
              className="rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
