import React, { useMemo, useState } from 'react';
import { Check, Info, Play, Plus, Star } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdUnlockRecord,
  EpisodeItem,
  HomeLayoutSettings,
  MovieItem,
  ShapeSettings,
  SubscriptionPlan,
  UserProfile,
  WatchHistoryItem,
} from '../../types/streaming';
import { formatDuration, getWatchRecommendations } from '../../utils/catalog';
import { AccessBadge } from './AccessBadge';
import { MovieCard } from './MovieCard';

interface WatchRecommendationsProps {
  movie: MovieItem;
  allMovies: MovieItem[];
  episodes: EpisodeItem[];
  activeEpisode?: EpisodeItem | null;
  inWatchlist: boolean;
  watchlistIds: Set<string>;
  historyMap: Record<string, WatchHistoryItem>;
  shape?: ShapeSettings;
  homeLayout?: HomeLayoutSettings;
  user?: UserProfile | null;
  plans?: SubscriptionPlan[];
  adSettings?: AdGlobalSettings | null;
  unlocksMap?: Record<string, AdUnlockRecord>;
  onSelectEpisode: (episode: EpisodeItem) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onPlayMovie: (movie: MovieItem) => void;
  onToggleWatchlist: (movie: MovieItem) => void;
}

export const WatchRecommendations: React.FC<WatchRecommendationsProps> = ({
  movie,
  allMovies,
  episodes,
  activeEpisode,
  inWatchlist,
  watchlistIds,
  historyMap,
  shape,
  homeLayout,
  user = null,
  plans = [],
  adSettings,
  unlocksMap = {},
  onSelectEpisode,
  onSelectMovie,
  onPlayMovie,
  onToggleWatchlist,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>('all');

  const seasons = useMemo(() => {
    const nums = Array.from(new Set(episodes.map((e) => e.seasonNumber))).sort((a, b) => a - b);
    return nums.length > 0 ? nums : [1];
  }, [episodes]);

  const [selectedSeason, setSelectedSeason] = useState<number>(
    () => activeEpisode?.seasonNumber ?? seasons[0] ?? 1
  );

  // Sync season tab & reset type filter when switching titles or episodes
  React.useEffect(() => {
    setTypeFilter('all');
  }, [movie.id]);

  React.useEffect(() => {
    if (activeEpisode?.seasonNumber) {
      setSelectedSeason(activeEpisode.seasonNumber);
    } else if (seasons.length > 0 && !seasons.includes(selectedSeason)) {
      setSelectedSeason(seasons[0]);
    }
  }, [activeEpisode?.seasonNumber, seasons, selectedSeason]);

  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((e) => e.seasonNumber === selectedSeason)
        .sort((a, b) => a.number - b.number),
    [episodes, selectedSeason]
  );

  const recommendations = useMemo(
    () => getWatchRecommendations(movie, allMovies, 12),
    [movie, allMovies]
  );

  // Prefer same-genre titles if any exist; fall back to full items list when none share genres
  const baseRecommendations =
    recommendations.sameGenre.length > 0 ? recommendations.sameGenre : recommendations.items;

  const hasMovies = useMemo(
    () => baseRecommendations.some((m) => m.type === 'movie'),
    [baseRecommendations]
  );
  const hasSeries = useMemo(
    () => baseRecommendations.some((m) => m.type === 'series'),
    [baseRecommendations]
  );

  const effectiveTypeFilter =
    typeFilter === 'all' || (hasMovies && hasSeries) ? typeFilter : 'all';

  const filteredRecommendations = useMemo(() => {
    if (effectiveTypeFilter === 'all') return baseRecommendations;
    return baseRecommendations.filter((m) => m.type === effectiveTypeFilter);
  }, [baseRecommendations, effectiveTypeFilter]);

  const headingLabel =
    recommendations.sameGenre.length > 0 && recommendations.matchedGenres.length > 0
      ? `More in ${recommendations.matchedGenres.slice(0, 2).join(' · ')}`
      : 'Recommended to Watch Next';

  const subtitleLabel =
    recommendations.sameGenre.length > 0
      ? 'Movies and series matching the same genre'
      : 'More titles from the catalog you might enjoy';

  return (
    <div
      className="mx-auto max-w-6xl space-y-10 px-4 pb-14 pt-2 sm:px-6"
      data-testid="watch-recommendations"
    >
      {/* Compact Currently Playing Strip */}
      <section className="flex flex-wrap items-start justify-between gap-4 border-t border-zinc-200/80 pt-6 dark:border-zinc-800/80">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {movie.title}
            {activeEpisode ? ` · S${activeEpisode.seasonNumber} E${activeEpisode.number}: ${activeEpisode.title}` : ''}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-500 tabular-nums">
              <Star className="h-3.5 w-3.5 fill-current" />
              {movie.rating.toFixed(1)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{movie.releaseYear}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {formatDuration(activeEpisode?.duration ?? movie.duration)}
            </span>
            {movie.genres.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{movie.genres.join(' · ')}</span>
              </>
            )}
          </div>
          {(activeEpisode?.description || movie.description) && (
            <p className="max-w-3xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-sm line-clamp-2">
              {activeEpisode?.description || movie.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleWatchlist(movie)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            {inWatchlist ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {inWatchlist ? 'In My List' : 'My List'}
          </button>
          <button
            type="button"
            onClick={() => onSelectMovie(movie)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <Info className="h-3.5 w-3.5" />
            Details
          </button>
        </div>
      </section>

      {/* Series Episodes Selector Below Player */}
      {movie.type === 'series' && episodes.length > 0 && (
        <section aria-label="Series episodes">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold sm:text-xl">Episodes</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Select another episode to continue watching
              </p>
            </div>
            {seasons.length > 1 && (
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
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seasonEpisodes.map((ep) => {
              const isCurrent = activeEpisode?.id === ep.id;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => onSelectEpisode(ep)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`group flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    isCurrent
                      ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)]/10'
                      : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-[#13131c] dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    <img
                      src={ep.thumbnailUrl || movie.bannerUrl || movie.posterUrl}
                      alt={ep.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold tabular-nums">
                        {isCurrent ? `Playing · E${ep.number}` : `Episode ${ep.number}`}
                      </span>
                      <span className="tabular-nums">{ep.duration}m</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold">{ep.title}</p>
                    <div className="mt-1">
                      <AccessBadge
                        movie={movie}
                        episode={ep}
                        user={user}
                        plans={plans}
                        adSettings={adSettings}
                        unlocksMap={unlocksMap}
                        compactResponsive
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommended Movies & Series of Same Genre */}
      {baseRecommendations.length > 0 && (
        <section aria-label="Recommended titles">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold sm:text-xl">{headingLabel}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitleLabel}</p>
            </div>

            {hasMovies && hasSeries && (
              <div
                className="flex items-center gap-1 rounded-lg bg-zinc-200/80 p-1 dark:bg-zinc-900"
                role="group"
                aria-label="Filter recommended titles by type"
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'movie', label: 'Movies' },
                    { id: 'series', label: 'Series' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      typeFilter === tab.id
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredRecommendations.map((rec) => (
              <MovieCard
                key={rec.id}
                movie={rec}
                inWatchlist={watchlistIds.has(rec.id)}
                history={historyMap[rec.id]}
                shape={shape}
                homeLayout={homeLayout}
                user={user}
                plans={plans}
                adSettings={adSettings}
                unlocksMap={unlocksMap}
                onSelect={onSelectMovie}
                onPlay={onPlayMovie}
                onToggleWatchlist={onToggleWatchlist}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
