import React from 'react';
import { Check, Play, Plus } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdUnlockRecord,
  HomeLayoutSettings,
  MovieItem,
  ShapeSettings,
  SubscriptionPlan,
  UserProfile,
  WatchHistoryItem,
} from '../../types/streaming';
import { AccessBadge } from './AccessBadge';

interface MovieCardProps {
  movie: MovieItem;
  inWatchlist?: boolean;
  history?: WatchHistoryItem;
  shape?: ShapeSettings;
  homeLayout?: HomeLayoutSettings;
  user?: UserProfile | null;
  plans?: SubscriptionPlan[];
  adSettings?: AdGlobalSettings | null;
  unlocksMap?: Record<string, AdUnlockRecord>;
  onSelect: (movie: MovieItem) => void;
  onPlay: (movie: MovieItem) => void;
  onToggleWatchlist: (movie: MovieItem) => void;
}

export function MovieCard({
  movie,
  inWatchlist = false,
  history,
  shape,
  homeLayout,
  user = null,
  plans = [],
  adSettings,
  unlocksMap = {},
  onSelect,
  onPlay,
  onToggleWatchlist,
}: MovieCardProps) {
  const progressPct =
    history && history.durationSeconds > 0
      ? Math.min(100, Math.max(4, Math.round((history.progressSeconds / history.durationSeconds) * 100)))
      : 0;

  const aspectClass =
    shape?.posterRatio === '16:9'
      ? 'aspect-video'
      : shape?.posterRatio === '1:1'
      ? 'aspect-square'
      : 'aspect-[2/3]';

  const shadowClass =
    shape?.shadowIntensity === 'none'
      ? 'shadow-none'
      : shape?.shadowIntensity === 'strong'
      ? 'shadow-2xl'
      : shape?.shadowIntensity === 'medium'
      ? 'shadow-lg'
      : 'shadow-sm';

  const hoverClass = shape?.reducedMotion || shape?.hoverEffect === 'none'
    ? ''
    : shape?.hoverEffect === 'lift'
    ? 'group-hover:-translate-y-1.5'
    : shape?.hoverEffect === 'glow'
    ? 'group-hover:ring-2 group-hover:ring-[var(--kv-accent,#e50914)]'
    : 'group-hover:scale-[1.03]';

  const showBadges = homeLayout?.showCardBadges ?? true;
  const showYear = homeLayout?.showCardYear ?? true;
  const showRating = homeLayout?.showCardRating ?? true;

  return (
    <article className="group relative flex flex-col">
      <div
        className={`relative ${aspectClass} w-full overflow-hidden bg-zinc-200 dark:bg-[#171722] ${
          shape?.cardBorder === false ? '' : 'border border-zinc-200/80 dark:border-white/10'
        } ${shadowClass} transition-all ${hoverClass}`}
        style={{
          borderRadius: `${shape?.cardRadius ?? 8}px`,
          transitionDuration: `${shape?.hoverSpeedMs ?? 220}ms`,
        }}
      >
        <button
          type="button"
          onClick={() => onSelect(movie)}
          aria-label={`Open details for ${movie.title}`}
          className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kv-accent,#e50914)]"
        >
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-opacity duration-300"
            />
          ) : (
            <div className="flex h-full w-full items-end bg-gradient-to-br from-zinc-800 to-zinc-950 p-4">
              <span className="font-display text-sm font-semibold text-white">{movie.title}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
        </button>

        {/* Access & Series Corner Badges */}
        {showBadges && (
          <div className="pointer-events-none absolute left-2 right-2 top-2.5">
            <AccessBadge
              movie={movie}
              user={user}
              plans={plans}
              adSettings={adSettings}
              unlocksMap={unlocksMap}
              showSeriesChip
              compactResponsive
            />
          </div>
        )}

        {/* Hover quick actions */}
        <div className="absolute bottom-3 left-2.5 right-2.5 flex items-center justify-between gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onPlay(movie)}
            aria-label={`Play ${movie.title}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm transition-colors hover:bg-zinc-200 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play
          </button>
          <button
            type="button"
            onClick={() => onToggleWatchlist(movie)}
            aria-label={
              inWatchlist
                ? `Remove ${movie.title} from My List`
                : `Add ${movie.title} to My List`
            }
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/30 bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black"
          >
            {inWatchlist ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Resume progress bar */}
        {progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
            <div
              className="h-full bg-[var(--kv-accent,#e50914)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Unboxed clean metadata */}
      <div className="mt-2.5 px-0.5">
        <button
          type="button"
          onClick={() => onSelect(movie)}
          className="block w-full truncate text-left font-display text-sm font-semibold transition-colors hover:text-[var(--kv-accent,#e50914)]"
        >
          {movie.title}
        </button>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {showYear && <span>{movie.releaseYear}</span>}
          {showYear && showRating && <span aria-hidden="true">·</span>}
          {showRating && <span>{movie.rating.toFixed(1)}</span>}
          {(showYear || showRating) && <span aria-hidden="true">·</span>}
          <span className="truncate">{movie.genres[0] ?? 'Cinema'}</span>
        </div>
      </div>
    </article>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="kv-skeleton aspect-[2/3] w-full rounded-lg" />
      <div className="kv-skeleton mt-2.5 h-4 w-3/4 rounded" />
      <div className="kv-skeleton mt-1.5 h-3 w-1/2 rounded" />
    </div>
  );
}
