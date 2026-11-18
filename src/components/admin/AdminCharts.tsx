import React from 'react';
import type { MovieItem, UserProfile } from '../../types/streaming';
import { formatCompactNumber } from '../../utils/catalog';

interface AdminChartsProps {
  movies: MovieItem[];
  users: UserProfile[];
}

export function AdminCharts({ movies, users }: AdminChartsProps) {
  const topViewed = [...movies]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const maxViews = Math.max(1, ...topViewed.map((m) => m.views));

  const freeCount = users.filter((u) => u.plan !== 'premium').length;
  const premiumCount = users.filter((u) => u.plan === 'premium').length;
  const totalUsers = Math.max(1, freeCount + premiumCount);
  const premiumPct = Math.round((premiumCount / totalUsers) * 100);

  // Deterministic 7-day views trajectory derived from catalog views
  const baseTotal = movies.reduce((sum, m) => sum + m.views, 0);
  const dailySeries = [0.62, 0.7, 0.68, 0.81, 0.88, 0.94, 1].map((factor, idx) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx],
    views: Math.round((baseTotal / 7) * factor),
  }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.views));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Views Over Time */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Weekly View Momentum
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Estimated daily stream starts across catalog
        </p>

        <div className="mt-6 flex h-44 items-end gap-2">
          {dailySeries.map((pt) => {
            const hPct = Math.max(10, Math.round((pt.views / maxDaily) * 100));
            return (
              <div key={pt.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="font-mono-tabular text-[10px] text-zinc-500">
                  {formatCompactNumber(pt.views)}
                </span>
                <div className="flex h-28 w-full items-end rounded bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="w-full rounded bg-[var(--kv-accent,#e50914)] transition-all"
                    style={{ height: `${hPct}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-zinc-500">{pt.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 10 Most Viewed */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Top Viewed Titles
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Ranked by cumulative playback starts
        </p>

        <div className="mt-4 space-y-2.5">
          {topViewed.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">No catalog data yet.</p>
          ) : (
            topViewed.slice(0, 6).map((m) => (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate pr-2 font-medium">{m.title}</span>
                  <span className="font-mono-tabular shrink-0 text-zinc-500">
                    {formatCompactNumber(m.views)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-[var(--kv-accent,#e50914)]"
                    style={{ width: `${Math.max(5, Math.round((m.views / maxViews) * 100))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Users by Plan */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
        <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Members by Plan
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Free vs. KinoVault Plus distribution
        </p>

        <div className="mt-6 flex items-center justify-center">
          <svg viewBox="0 0 120 120" className="h-36 w-36" aria-label="Users by plan donut chart">
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-zinc-200 dark:text-zinc-800"
            />
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="var(--kv-accent,#e50914)"
              strokeWidth="14"
              strokeDasharray={`${(premiumPct / 100) * 289} 289`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <text
              x="60"
              y="58"
              textAnchor="middle"
              className="fill-zinc-900 font-display text-xl font-bold dark:fill-white"
            >
              {premiumPct}%
            </text>
            <text
              x="60"
              y="74"
              textAnchor="middle"
              className="fill-zinc-500 text-[9px] uppercase tracking-wider"
            >
              Plus
            </text>
          </svg>
        </div>

        <div className="mt-4 flex justify-center gap-6 text-xs tabular-nums">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--kv-accent,#e50914)]" />
            <span>Plus: {premiumCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-700" />
            <span>Free: {freeCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
