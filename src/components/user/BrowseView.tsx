import React, { useMemo, useState } from 'react';
import { Film, SlidersHorizontal } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdUnlockRecord,
  BrowseFilters,
  CustomAdItem,
  GenreItem,
  HomeLayoutSettings,
  MovieItem,
  ShapeSettings,
  SortOption,
  SubscriptionPlan,
  UserProfile,
  WatchHistoryItem,
} from '../../types/streaming';
import { filterMovies, searchMovies, sortMovies } from '../../utils/catalog';
import { CustomAdSlot } from './CustomAdSlot';
import { MovieCard, MovieCardSkeleton } from './MovieCard';

interface BrowseViewProps {
  title: string;
  subtitle?: string;
  movies: MovieItem[];
  genres: GenreItem[];
  initialType?: 'all' | 'movie' | 'series';
  initialGenre?: string;
  searchQuery?: string;
  loading?: boolean;
  watchlistIds: Set<string>;
  historyMap: Record<string, WatchHistoryItem>;
  shape?: ShapeSettings;
  homeLayout?: HomeLayoutSettings;
  user?: UserProfile | null;
  plans?: SubscriptionPlan[];
  unlocksMap?: Record<string, AdUnlockRecord>;
  customAds?: CustomAdItem[];
  adSettings?: AdGlobalSettings;
  onSelectMovie: (movie: MovieItem) => void;
  onPlayMovie: (movie: MovieItem) => void;
  onToggleWatchlist: (movie: MovieItem) => void;
}

export function BrowseView({
  title,
  subtitle,
  movies,
  genres,
  initialType = 'all',
  initialGenre = 'all',
  searchQuery = '',
  loading = false,
  watchlistIds,
  historyMap,
  shape,
  homeLayout,
  user = null,
  plans = [],
  unlocksMap = {},
  customAds = [],
  adSettings,
  onSelectMovie,
  onPlayMovie,
  onToggleWatchlist,
}: BrowseViewProps) {
  const [filters, setFilters] = useState<BrowseFilters>({
    type: initialType,
    genre: initialGenre,
    minRating: 0,
    language: 'all',
    access: 'all',
    minYear: 1920,
    maxYear: 2027,
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [visibleCount, setVisibleCount] = useState(12);
  const [showFilters, setShowFilters] = useState(false);

  const languages = useMemo(() => {
    const set = new Set(movies.map((m) => m.language).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [movies]);

  const results = useMemo(() => {
    const searched = searchQuery ? searchMovies(movies, searchQuery) : movies;
    const filtered = filterMovies(searched, {
      ...filters,
      type: filters.type ?? initialType,
      genre: filters.genre ?? initialGenre,
    });
    return sortMovies(filtered, sortBy);
  }, [movies, searchQuery, filters, initialType, initialGenre, sortBy]);

  const visible = results.slice(0, visibleCount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {adSettings && customAds.length > 0 && (
        <CustomAdSlot
          placement="banner"
          customAds={customAds}
          adSettings={adSettings}
          user={user}
          contentType={initialType === 'movie' ? 'movie' : initialType === 'series' ? 'tvshow' : 'all'}
          className="mb-6"
        />
      )}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#14141c] dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>

          <select
            aria-label="Sort titles"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none dark:border-zinc-800 dark:bg-[#14141c] dark:text-zinc-200"
          >
            <option value="newest">Sort: Newest</option>
            <option value="rating">Sort: Top Rated</option>
            <option value="views">Sort: Most Viewed</option>
            <option value="title">Sort: A–Z</option>
          </select>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c] sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="f-type" className="mb-1 block text-xs text-zinc-500">
              Type
            </label>
            <select
              id="f-type"
              value={filters.type ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value as BrowseFilters['type'] }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              <option value="all">All</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
          </div>

          <div>
            <label htmlFor="f-genre" className="mb-1 block text-xs text-zinc-500">
              Genre
            </label>
            <select
              id="f-genre"
              value={filters.genre ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value }))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              <option value="all">All Genres</option>
              {genres.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="f-lang" className="mb-1 block text-xs text-zinc-500">
              Language
            </label>
            <select
              id="f-lang"
              value={filters.language ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'all' ? 'All Languages' : lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="f-rating" className="mb-1 block text-xs text-zinc-500">
              Min Rating
            </label>
            <select
              id="f-rating"
              value={filters.minRating ?? 0}
              onChange={(e) => setFilters((f) => ({ ...f, minRating: Number(e.target.value) }))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              <option value={0}>Any</option>
              <option value={7}>7.0+</option>
              <option value={8}>8.0+</option>
              <option value={8.5}>8.5+</option>
            </select>
          </div>

          <div>
            <label htmlFor="f-access" className="mb-1 block text-xs text-zinc-500">
              Access
            </label>
            <select
              id="f-access"
              value={filters.access ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({ ...f, access: e.target.value as BrowseFilters['access'] }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              <option value="all">All Access</option>
              <option value="free">Free (No Sign-In)</option>
              <option value="ad_unlock">Watch Ad or Subscribe</option>
              <option value="ad_only">Watch Ad Only</option>
              <option value="sub_only">Subscription Only</option>
              <option value="signin">Sign-In Required</option>
              <option value="premium">All Subscription Plans</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters({
                  type: initialType,
                  genre: initialGenre,
                  minRating: 0,
                  language: 'all',
                  access: 'all',
                })
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-[#13131c]">
          <Film className="h-10 w-10 text-zinc-400" />
          <h2 className="mt-3 font-display text-lg font-semibold">No matching titles</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Try clearing your filters or searching for another title, actor, or genre.
          </p>
        </div>
      ) : (
        <>
          {homeLayout?.browseMode === 'carousel' ? (
            <div className="kv-row-scroll flex gap-4 overflow-x-auto pb-3">
              {visible.map((m) => (
                <div key={m.id} className="w-[44%] shrink-0 sm:w-[29%] md:w-[22%] lg:w-[16%]">
                  <MovieCard
                    movie={m}
                    inWatchlist={watchlistIds.has(m.id)}
                    history={historyMap[m.id]}
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
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 ${
                homeLayout?.browseCardsPerRow === 3
                  ? 'lg:grid-cols-3'
                  : homeLayout?.browseCardsPerRow === 4
                  ? 'lg:grid-cols-4'
                  : homeLayout?.browseCardsPerRow === 5
                  ? 'lg:grid-cols-5'
                  : homeLayout?.browseCardsPerRow === 7
                  ? 'lg:grid-cols-7'
                  : homeLayout?.browseCardsPerRow === 8
                  ? 'lg:grid-cols-8'
                  : 'lg:grid-cols-6'
              }`}
            >
              {visible.map((m) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  inWatchlist={watchlistIds.has(m.id)}
                  history={historyMap[m.id]}
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
          )}

          {results.length > visibleCount && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 12)}
                className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Load More ({results.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
