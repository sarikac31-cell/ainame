import React from 'react';
import { CheckCircle2, Film, Lock, PlayCircle, Sparkles } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdUnlockRecord,
  EpisodeItem,
  MovieItem,
  SubscriptionPlan,
  UserProfile,
} from '../../types/streaming';
import { getBadgeModel } from '../../utils/accessControl';

interface AccessBadgeProps {
  movie: MovieItem;
  episode?: EpisodeItem | null;
  user?: UserProfile | null;
  plans?: SubscriptionPlan[];
  adSettings?: AdGlobalSettings | null;
  episodes?: EpisodeItem[];
  unlocksMap?: Record<string, AdUnlockRecord>;
  showSeriesChip?: boolean;
  compactResponsive?: boolean;
  className?: string;
}

export const AccessBadge: React.FC<AccessBadgeProps> = ({
  movie,
  episode = null,
  user = null,
  plans = [],
  adSettings,
  episodes,
  unlocksMap = {},
  showSeriesChip = false,
  compactResponsive = true,
  className = '',
}) => {
  const model = getBadgeModel({
    movie,
    episode,
    user,
    plans,
    adSettings,
    episodes,
    unlocksMap,
  });

  if (!model.show && !(showSeriesChip && movie.type === 'series')) {
    return null;
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 text-[11px] font-semibold tracking-wide ${className}`}
      aria-label={model.ariaLabel || undefined}
    >
      {model.show && model.kind === 'paid' && (
        <span
          title={model.tooltip}
          className="inline-flex items-center gap-1 rounded bg-amber-500/95 px-1.5 py-0.5 text-zinc-950 shadow-sm"
        >
          <Lock className="h-3 w-3 shrink-0" />
          <span className={compactResponsive ? 'hidden sm:inline' : ''}>
            {model.primaryLabel}
          </span>
          {compactResponsive && <span className="sm:hidden">{model.compactCode}</span>}
        </span>
      )}

      {model.show && model.kind === 'ad_unlock' && (
        <span
          title={model.tooltip}
          className="inline-flex items-center gap-1 rounded bg-emerald-500/95 px-1.5 py-0.5 text-zinc-950 shadow-sm"
        >
          <PlayCircle className="h-3 w-3 shrink-0" />
          <span className={compactResponsive ? 'hidden sm:inline' : ''}>
            {model.primaryLabel}
          </span>
          {compactResponsive && <span className="sm:hidden">{model.compactCode}</span>}
        </span>
      )}

      {model.show && model.kind === 'hybrid' && (
        <>
          <span
            title={model.tooltip}
            className="inline-flex items-center gap-1 rounded bg-amber-500/95 px-1.5 py-0.5 text-zinc-950 shadow-sm"
          >
            <Lock className="h-3 w-3 shrink-0" />
            <span className={compactResponsive ? 'hidden sm:inline' : ''}>
              {model.primaryLabel}
            </span>
            {compactResponsive && <span className="sm:hidden">PRO</span>}
          </span>
          {model.secondaryLabel && (
            <span
              title={model.tooltip}
              className="inline-flex items-center gap-1 rounded bg-emerald-500/95 px-1.5 py-0.5 text-zinc-950 shadow-sm"
            >
              <PlayCircle className="h-3 w-3 shrink-0" />
              <span className={compactResponsive ? 'hidden sm:inline' : ''}>
                {model.secondaryLabel}
              </span>
              {compactResponsive && <span className="sm:hidden">AD</span>}
            </span>
          )}
        </>
      )}

      {model.show && model.kind === 'free' && (
        <span
          title={model.tooltip}
          className="inline-flex items-center gap-1 rounded border border-white/25 bg-black/75 px-1.5 py-0.5 text-white backdrop-blur-sm"
        >
          <Sparkles className="h-3 w-3 shrink-0 text-emerald-400" />
          <span>{model.primaryLabel}</span>
        </span>
      )}

      {model.show && model.kind === 'included' && (
        <span
          title={model.tooltip}
          className="inline-flex items-center gap-1 rounded bg-emerald-600/95 px-1.5 py-0.5 text-white shadow-sm"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>{model.primaryLabel}</span>
        </span>
      )}

      {model.show && model.kind === 'signin' && (
        <span
          title={model.tooltip}
          className="inline-flex items-center gap-1 rounded border border-white/20 bg-black/75 px-1.5 py-0.5 text-white backdrop-blur-sm"
        >
          <Lock className="h-3 w-3 shrink-0" />
          <span>{model.primaryLabel}</span>
        </span>
      )}

      {showSeriesChip && movie.type === 'series' && (
        <span className="inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-white/95 backdrop-blur-sm">
          <Film className="hidden h-2.5 w-2.5 sm:inline" />
          Series
        </span>
      )}
    </div>
  );
};
