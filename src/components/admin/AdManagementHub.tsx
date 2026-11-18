import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Copy,
  Database,
  Edit3,
  Film,
  Image as ImageIcon,
  PauseCircle,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  Tv,
} from 'lucide-react';
import type {
  AdComputedStatus,
  AdEventItem,
  AdGlobalSettings,
  AdPlacementType,
  CustomAdItem,
  MovieItem,
  VastAdItem,
  VastAdType,
} from '../../types/streaming';
import { SEED_EPISODES } from '../../data/seedCatalog';
import {
  computeAdMetrics,
  computeAdStatus,
  summarizeAdEventsByDay,
} from '../../utils/adEngine';
import { formatCompactNumber } from '../../utils/catalog';
import { fetchSeriesEpisodes } from '../../lib/firebase';
import { ConfirmDialog } from '../ui/Modal';
import {
  CustomAdFormModal,
  type EpisodeOption,
  VastAdFormModal,
  VastTestPreviewModal,
} from './AdModals';
import { AdReportsView } from './AdReportsView';

export type AdsSubSection = 'overview' | 'custom' | 'vast' | 'settings' | 'reports';

interface AdManagementHubProps {
  section: AdsSubSection;
  customAds: CustomAdItem[];
  vastAds: VastAdItem[];
  adEvents: AdEventItem[];
  adSettings: AdGlobalSettings;
  movies: MovieItem[];
  adminUid: string;
  adminName: string;
  onSaveCustomAd: (ad: CustomAdItem, isNew: boolean) => Promise<void>;
  onDeleteCustomAd: (ad: CustomAdItem) => Promise<void>;
  onSaveVastAd: (ad: VastAdItem, isNew: boolean) => Promise<void>;
  onDeleteVastAd: (ad: VastAdItem) => Promise<void>;
  onSaveAdSettings: (next: AdGlobalSettings) => Promise<void>;
  onSeedSampleAds: () => Promise<void>;
  onNavigateSection: (next: AdsSubSection) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function StatusBadge({ status }: { status: AdComputedStatus }) {
  const styles: Record<AdComputedStatus, string> = {
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    scheduled: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    expired: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400',
    inactive: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

export const AdManagementHub: React.FC<AdManagementHubProps> = ({
  section,
  customAds,
  vastAds,
  adEvents,
  adSettings,
  movies,
  adminUid,
  adminName,
  onSaveCustomAd,
  onDeleteCustomAd,
  onSaveVastAd,
  onDeleteVastAd,
  onSaveAdSettings,
  onSeedSampleAds,
  onNavigateSection,
  onNotify,
}) => {
  // Load episode options once for Series / TV Show target pickers
  const [episodesList, setEpisodesList] = useState<EpisodeOption[]>([]);
  useEffect(() => {
    let active = true;
    const seriesMovies = movies.filter((m) => m.type === 'series');
    if (seriesMovies.length === 0) return;
    Promise.all(
      seriesMovies.map(async (s) => {
        const eps = await fetchSeriesEpisodes(s.id).catch(() => SEED_EPISODES[s.id] || []);
        return eps.map((ep) => ({
          id: ep.id,
          seriesId: s.id,
          label: `${s.title} — S${ep.seasonNumber} E${ep.number} ${ep.title}`,
        }));
      })
    ).then((nested) => {
      if (active) setEpisodesList(nested.flat());
    });
    return () => {
      active = false;
    };
  }, [movies]);

  // Custom Ads filters & selection
  const [customSearch, setCustomSearch] = useState('');
  const [customPlacementFilter, setCustomPlacementFilter] = useState<'all' | AdPlacementType>('all');
  const [customStatusFilter, setCustomStatusFilter] = useState<'all' | AdComputedStatus>('all');
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<string>>(new Set());
  const [customPage, setCustomPage] = useState(1);

  // VAST Ads filters
  const [vastSearch, setVastSearch] = useState('');
  const [vastTypeFilter, setVastTypeFilter] = useState<'all' | VastAdType>('all');
  const [vastStatusFilter, setVastStatusFilter] = useState<'all' | AdComputedStatus>('all');

  // Modals
  const [editingCustomAd, setEditingCustomAd] = useState<CustomAdItem | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [deletingCustomAd, setDeletingCustomAd] = useState<CustomAdItem | null>(null);

  const [editingVastAd, setEditingVastAd] = useState<VastAdItem | null>(null);
  const [vastModalOpen, setVastModalOpen] = useState(false);
  const [deletingVastAd, setDeletingVastAd] = useState<VastAdItem | null>(null);
  const [testingVastAd, setTestingVastAd] = useState<VastAdItem | null>(null);

  // Global Ad Settings draft
  const [settingsDraft, setSettingsDraft] = useState<AdGlobalSettings>(adSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    setSettingsDraft(adSettings);
  }, [adSettings]);

  const moviesMap = useMemo(() => {
    const map: Record<string, string> = {};
    movies.forEach((m) => {
      map[m.id] = m.title;
    });
    episodesList.forEach((e) => {
      map[e.id] = e.label;
    });
    return map;
  }, [movies, episodesList]);

  const formatTargets = (ids: string[], fallbackLabel: string) => {
    if (!ids || ids.length === 0) return fallbackLabel;
    const names = ids.map((id) => moviesMap[id] || id);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2})`;
  };

  // --- Overview Analytics ---
  const overviewStats = useMemo(() => {
    const now = Date.now();
    const in7d = now + 7 * 86400_000;

    const allAds = [
      ...customAds.map((c) => ({ ...c, kind: 'custom' as const })),
      ...vastAds.map((v) => ({ ...v, kind: 'vast' as const })),
    ];

    const activeCustom = customAds.filter((a) => computeAdStatus(a, now) === 'active').length;
    const activeVast = vastAds.filter((a) => computeAdStatus(a, now) === 'active').length;
    const totalImpressions = allAds.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = allAds.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const expiringSoon = allAds.filter((a) => {
      if (computeAdStatus(a, now) !== 'active') return false;
      const endMs = Date.parse(a.endDate);
      return Number.isFinite(endMs) && endMs <= in7d;
    });

    const topByCtr = [...allAds]
      .map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
        impressions: a.impressions,
        clicks: a.clicks,
      }))
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 10);

    const placementTotals = {
      Home: customAds
        .filter((a) => a.placement === 'home')
        .reduce((s, a) => s + a.impressions, 0),
      Banner: customAds
        .filter((a) => a.placement === 'banner')
        .reduce((s, a) => s + a.impressions, 0),
      Player:
        customAds
          .filter((a) => a.placement === 'player')
          .reduce((s, a) => s + a.impressions, 0) +
        vastAds.reduce((s, a) => s + a.impressions, 0),
    };

    const daily = summarizeAdEventsByDay(adEvents, 7, now);

    return {
      activeCustom,
      activeVast,
      totalImpressions,
      totalClicks,
      avgCtr,
      expiringSoon,
      topByCtr,
      placementTotals,
      daily,
    };
  }, [customAds, vastAds, adEvents]);

  // --- Filtered Custom & VAST ---
  const filteredCustomAds = useMemo(() => {
    const q = customSearch.trim().toLowerCase();
    return customAds.filter((ad) => {
      if (customPlacementFilter !== 'all' && ad.placement !== customPlacementFilter) return false;
      const st = computeAdStatus(ad);
      if (customStatusFilter !== 'all' && st !== customStatusFilter) return false;
      if (q && !ad.name.toLowerCase().includes(q) && !ad.redirectUrl.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [customAds, customSearch, customPlacementFilter, customStatusFilter]);

  const pageSize = 10;
  const pagedCustomAds = filteredCustomAds.slice(
    (customPage - 1) * pageSize,
    customPage * pageSize
  );
  const totalCustomPages = Math.max(1, Math.ceil(filteredCustomAds.length / pageSize));

  const filteredVastAds = useMemo(() => {
    const q = vastSearch.trim().toLowerCase();
    return vastAds.filter((ad) => {
      if (vastTypeFilter !== 'all' && ad.type !== vastTypeFilter) return false;
      const st = computeAdStatus(ad);
      if (vastStatusFilter !== 'all' && st !== vastStatusFilter) return false;
      if (q && !ad.name.toLowerCase().includes(q) && !ad.vastTagUrl.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [vastAds, vastSearch, vastTypeFilter, vastStatusFilter]);

  const handleBulkCustomAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedCustomIds.size === 0) return;
    const targets = customAds.filter((a) => selectedCustomIds.has(a.id));
    for (const ad of targets) {
      if (action === 'delete') {
        await onDeleteCustomAd(ad);
      } else {
        await onSaveCustomAd(
          {
            ...ad,
            status: action === 'activate' ? 'active' : 'inactive',
            updatedAt: new Date().toISOString(),
          },
          false
        );
      }
    }
    setSelectedCustomIds(new Set());
    onNotify(`Updated ${targets.length} custom ad(s).`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Sub-Section Header Tabs + Emergency Pause */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-3.5 w-3.5" /> },
              { id: 'custom', label: `Custom Ads (${customAds.length})`, icon: <ImageIcon className="h-3.5 w-3.5" /> },
              { id: 'vast', label: `VAST Ads (${vastAds.length})`, icon: <Tv className="h-3.5 w-3.5" /> },
              { id: 'settings', label: 'Ad Settings', icon: <Settings2 className="h-3.5 w-3.5" /> },
              { id: 'reports', label: 'Reports & Export', icon: <Film className="h-3.5 w-3.5" /> },
            ] as { id: AdsSubSection; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigateSection(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                section === t.id
                  ? 'bg-[var(--kv-accent,#e50914)] text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                await onSeedSampleAds();
              } finally {
                setSeeding(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Database className="h-3.5 w-3.5" />
            {seeding ? 'Seeding...' : 'Seed Sample Ads'}
          </button>

          <button
            type="button"
            onClick={() =>
              onSaveAdSettings({ ...adSettings, adsEnabled: !adSettings.adsEnabled })
            }
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              adSettings.adsEnabled
                ? 'border border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            {adSettings.adsEnabled ? 'Pause All Ads' : 'Resume All Ads'}
          </button>
        </div>
      </div>

      {/* ============================================================
          SECTION 1: OVERVIEW
         ============================================================ */}
      {section === 'overview' && (
        <div className="space-y-6">
          {!adSettings.adsEnabled && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Global Emergency Pause is active. No ads are currently shown on the User Portal.
            </div>
          )}

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: 'Active Custom Ads', value: overviewStats.activeCustom },
              { label: 'Active VAST Ads', value: overviewStats.activeVast },
              { label: 'Total Impressions', value: formatCompactNumber(overviewStats.totalImpressions) },
              { label: 'Total Clicks', value: formatCompactNumber(overviewStats.totalClicks) },
              { label: 'Average CTR', value: `${overviewStats.avgCtr.toFixed(2)}%` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* 3 Charts Grid */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Chart 1: Impressions & Clicks (7d) */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <h3 className="text-sm font-semibold">Daily Telemetry (Last 7 Days)</h3>
              <p className="mb-3 text-[11px] text-zinc-500">Live adEvents impressions vs clicks</p>
              <svg viewBox="0 0 320 150" className="h-36 w-full" aria-label="Daily ad impressions and clicks chart">
                {(() => {
                  const maxVal = Math.max(
                    1,
                    ...overviewStats.daily.map((d) => Math.max(d.impressions, d.clicks))
                  );
                  return overviewStats.daily.map((d, idx) => {
                    const x = 18 + idx * 42;
                    const impH = Math.round((d.impressions / maxVal) * 95);
                    const clkH = Math.round((d.clicks / maxVal) * 95);
                    return (
                      <g key={d.date}>
                        <rect
                          x={x}
                          y={118 - impH}
                          width={14}
                          height={Math.max(3, impH)}
                          rx={3}
                          fill="var(--kv-accent,#e50914)"
                          opacity={0.85}
                        />
                        <rect
                          x={x + 16}
                          y={118 - clkH}
                          width={10}
                          height={Math.max(2, clkH)}
                          rx={2}
                          fill="#f59e0b"
                          opacity={0.9}
                        />
                        <text
                          x={x + 12}
                          y={136}
                          textAnchor="middle"
                          fontSize="10"
                          fill="currentColor"
                          opacity={0.6}
                        >
                          {d.label}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
              <div className="mt-1 flex items-center gap-4 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--kv-accent,#e50914)]" />
                  Impressions
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Clicks
                </span>
              </div>
            </div>

            {/* Chart 2: Top Performing Ads by CTR */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <h3 className="text-sm font-semibold">Top Performing Ads by CTR</h3>
              <p className="mb-3 text-[11px] text-zinc-500">Click-through efficiency ranking</p>
              <div className="space-y-2.5">
                {overviewStats.topByCtr.slice(0, 6).map((row) => {
                  const maxCtr = Math.max(1, ...overviewStats.topByCtr.map((r) => r.ctr));
                  const pct = Math.round((row.ctr / maxCtr) * 100);
                  return (
                    <div key={`${row.kind}-${row.id}`} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate font-medium">
                          {row.name}{' '}
                          <span className="text-[10px] uppercase text-zinc-400">({row.kind})</span>
                        </span>
                        <span className="font-mono-tabular shrink-0 font-semibold">
                          {row.ctr.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-[var(--kv-accent,#e50914)]"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {overviewStats.topByCtr.length === 0 && (
                  <p className="text-xs text-zinc-500">No ad campaigns recorded yet.</p>
                )}
              </div>
            </div>

            {/* Chart 3: Impressions by Placement */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <h3 className="text-sm font-semibold">Impressions by Placement</h3>
              <p className="mb-3 text-[11px] text-zinc-500">Home vs Banner vs Player + VAST</p>
              <div className="space-y-4 pt-2">
                {(['Home', 'Banner', 'Player'] as const).map((slot) => {
                  const val = overviewStats.placementTotals[slot];
                  const total = Math.max(
                    1,
                    overviewStats.placementTotals.Home +
                      overviewStats.placementTotals.Banner +
                      overviewStats.placementTotals.Player
                  );
                  const pct = Math.round((val / total) * 100);
                  return (
                    <div key={slot} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{slot}</span>
                        <span className="font-mono-tabular text-zinc-500">
                          {val.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Expiring Within 7 Days */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
            <h3 className="mb-3 text-sm font-semibold">
              Campaigns Expiring Within 7 Days ({overviewStats.expiringSoon.length})
            </h3>
            {overviewStats.expiringSoon.length === 0 ? (
              <p className="text-xs text-zinc-500">No active campaigns are scheduled to expire in the next 7 days.</p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {overviewStats.expiringSoon.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5">
                    <span className="font-semibold">
                      {a.name} <span className="text-[11px] text-zinc-400">({a.kind})</span>
                    </span>
                    <span className="font-mono-tabular text-amber-500">Ends {a.endDate.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 2: CUSTOM ADS CRUD TABLE
         ============================================================ */}
      {section === 'custom' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={customSearch}
                  onChange={(e) => {
                    setCustomSearch(e.target.value);
                    setCustomPage(1);
                  }}
                  placeholder="Search name or URL..."
                  className="rounded-lg border border-zinc-300 bg-white py-2 pl-8 pr-3 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                />
              </div>

              <select
                value={customPlacementFilter}
                onChange={(e) => setCustomPlacementFilter(e.target.value as 'all' | AdPlacementType)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
              >
                <option value="all">All Placements</option>
                <option value="home">Home Page</option>
                <option value="banner">Banner</option>
                <option value="player">Video Player</option>
              </select>

              <select
                value={customStatusFilter}
                onChange={(e) => setCustomStatusFilter(e.target.value as 'all' | AdComputedStatus)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCustomIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleBulkCustomAction('activate')}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                  >
                    Activate ({selectedCustomIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkCustomAction('deactivate')}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                  >
                    Deactivate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkCustomAction('delete')}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingCustomAd(null);
                  setCustomModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Custom Ad
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
                      aria-label="Select all custom ads"
                      checked={
                        pagedCustomAds.length > 0 &&
                        pagedCustomAds.every((a) => selectedCustomIds.has(a.id))
                      }
                      onChange={(e) => {
                        setSelectedCustomIds(
                          e.target.checked
                            ? new Set(pagedCustomAds.map((a) => a.id))
                            : new Set()
                        );
                      }}
                    />
                  </th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Placement</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Redirect URL</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Imp / Clicks / CTR</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pagedCustomAds.map((ad) => {
                  const computed = computeAdStatus(ad);
                  const metrics = computeAdMetrics(ad);
                  return (
                    <tr key={ad.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${ad.name}`}
                          checked={selectedCustomIds.has(ad.id)}
                          onChange={(e) => {
                            const next = new Set(selectedCustomIds);
                            if (e.target.checked) next.add(ad.id);
                            else next.delete(ad.id);
                            setSelectedCustomIds(next);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={ad.imageUrl}
                            alt={ad.altText || ad.name}
                            className="h-9 w-16 rounded object-cover bg-zinc-900"
                          />
                          <div>
                            <p className="font-semibold">{ad.name}</p>
                            <p className="text-[10px] text-zinc-400">
                              Priority {ad.priority} · Weight {ad.weight}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize">{ad.type}</td>
                      <td className="p-3 capitalize">
                        {ad.placement === 'home' ? 'Home Page' : ad.placement}
                      </td>
                      <td className="p-3 text-zinc-500">
                        {ad.placement === 'home'
                          ? 'Global Home'
                          : formatTargets(ad.targetIds, `All ${ad.targetContentType}`)}
                      </td>
                      <td className="p-3 max-w-[160px] truncate font-mono text-[11px] text-zinc-500">
                        {ad.redirectUrl}
                      </td>
                      <td className="font-mono-tabular p-3 whitespace-nowrap text-zinc-500">
                        {ad.startDate.slice(0, 10)} → {ad.endDate.slice(0, 10)}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          title="Click to toggle active/inactive"
                          onClick={() =>
                            onSaveCustomAd(
                              {
                                ...ad,
                                status: ad.status === 'active' ? 'inactive' : 'active',
                                updatedAt: new Date().toISOString(),
                              },
                              false
                            )
                          }
                        >
                          <StatusBadge status={computed} />
                        </button>
                      </td>
                      <td className="font-mono-tabular p-3 text-right whitespace-nowrap">
                        <span className="font-semibold">{formatCompactNumber(ad.impressions)}</span> /{' '}
                        {formatCompactNumber(ad.clicks)} /{' '}
                        <span className="text-[var(--kv-accent,#e50914)] font-semibold">
                          {metrics.ctrPct}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomAd(ad);
                              setCustomModalOpen(true);
                            }}
                            aria-label={`Edit ${ad.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const now = new Date().toISOString();
                              await onSaveCustomAd(
                                {
                                  ...ad,
                                  id: `cad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                  name: `${ad.name} (Copy)`,
                                  status: 'inactive',
                                  impressions: 0,
                                  clicks: 0,
                                  createdAt: now,
                                  updatedAt: now,
                                },
                                true
                              );
                            }}
                            aria-label={`Duplicate ${ad.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCustomAd(ad)}
                            aria-label={`Delete ${ad.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pagedCustomAds.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-zinc-500">
                      No custom image ads match your filter. Click “Add Custom Ad” or “Seed Sample Ads”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalCustomPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 text-xs dark:border-zinc-800">
                <span className="text-zinc-500">
                  Page {customPage} of {totalCustomPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={customPage <= 1}
                    onClick={() => setCustomPage((p) => p - 1)}
                    className="rounded border border-zinc-300 px-2.5 py-1 disabled:opacity-40 dark:border-zinc-700"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={customPage >= totalCustomPages}
                    onClick={() => setCustomPage((p) => p + 1)}
                    className="rounded border border-zinc-300 px-2.5 py-1 disabled:opacity-40 dark:border-zinc-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 3: VAST ADS CRUD TABLE
         ============================================================ */}
      {section === 'vast' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={vastSearch}
                  onChange={(e) => setVastSearch(e.target.value)}
                  placeholder="Search VAST ad..."
                  className="rounded-lg border border-zinc-300 bg-white py-2 pl-8 pr-3 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
                />
              </div>

              <select
                value={vastTypeFilter}
                onChange={(e) => setVastTypeFilter(e.target.value as 'all' | VastAdType)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
              >
                <option value="all">All VAST Slots</option>
                <option value="pre-roll">Pre-Roll</option>
                <option value="mid-roll">Mid-Roll</option>
                <option value="post-roll">Post-Roll</option>
                <option value="overlay">Overlay</option>
              </select>

              <select
                value={vastStatusFilter}
                onChange={(e) => setVastStatusFilter(e.target.value as 'all' | AdComputedStatus)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#13131c]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingVastAd(null);
                setVastModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add VAST Ad
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#13131c]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Skip</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Imp / Comp / CTR / Err</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredVastAds.map((ad) => {
                  const computed = computeAdStatus(ad);
                  const metrics = computeAdMetrics(ad);
                  return (
                    <tr key={ad.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="p-3">
                        <p className="font-semibold">{ad.name}</p>
                        <p className="max-w-[200px] truncate font-mono text-[10px] text-zinc-400">
                          {ad.vastTagUrl}
                        </p>
                      </td>
                      <td className="p-3 capitalize font-medium">{ad.type}</td>
                      <td className="p-3 text-zinc-500">
                        {formatTargets(ad.targetIds, `All ${ad.targetType}`)}
                      </td>
                      <td className="font-mono-tabular p-3">
                        {ad.skipAfterSeconds === 0 ? 'No skip' : `${ad.skipAfterSeconds}s`}
                      </td>
                      <td className="font-mono-tabular p-3 whitespace-nowrap text-zinc-500">
                        {ad.startDate.slice(0, 10)} → {ad.endDate.slice(0, 10)}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            onSaveVastAd(
                              {
                                ...ad,
                                status: ad.status === 'active' ? 'inactive' : 'active',
                                updatedAt: new Date().toISOString(),
                              },
                              false
                            )
                          }
                        >
                          <StatusBadge status={computed} />
                        </button>
                      </td>
                      <td className="font-mono-tabular p-3 text-right whitespace-nowrap">
                        {formatCompactNumber(ad.impressions)} / {metrics.completionRatePct} /{' '}
                        <span className="font-semibold text-[var(--kv-accent,#e50914)]">
                          {metrics.ctrPct}
                        </span>{' '}
                        / <span className="text-zinc-400">{ad.errors}e</span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTestingVastAd(ad)}
                            aria-label={`Test ${ad.name}`}
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <Play className="h-3 w-3" />
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVastAd(ad);
                              setVastModalOpen(true);
                            }}
                            aria-label={`Edit ${ad.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingVastAd(ad)}
                            aria-label={`Delete ${ad.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredVastAds.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-zinc-500">
                      No VAST video ads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 4: AD SETTINGS
         ============================================================ */}
      {section === 'settings' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingSettings(true);
            try {
              await onSaveAdSettings(settingsDraft);
            } finally {
              setSavingSettings(false);
            }
          }}
          className="max-w-2xl space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#13131c]"
        >
          <div>
            <h3 className="font-display text-base font-bold">Global Advertising Delivery Controls</h3>
            <p className="text-xs text-zinc-500">
              Control frequency caps, premium ad-free immunity, ad badges, and safe sandbox testing.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                key: 'adsEnabled' as const,
                title: 'Enable Advertising System (Master Switch)',
                desc: 'Turn off immediately to pause all custom image and VAST video ads site-wide.',
              },
              {
                key: 'hideAdsForPremium' as const,
                title: 'Hide Ads for Premium Subscribers',
                desc: 'Keep paid subscription members completely ad-free across home, browse, and player.',
              },
              {
                key: 'showAdLabel' as const,
                title: 'Display Disclosure Badge (“Ad”)',
                desc: 'Always show the subtle transparency pill on sponsored placements.',
              },
              {
                key: 'testMode' as const,
                title: 'Test Mode (Safe Preview · Zero Counting)',
                desc: 'Show clearly labeled placeholder slates when testing tags without writing analytics counters.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800"
              >
                <div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft[item.key]}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 accent-[var(--kv-accent,#e50914)]"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="as-max" className="mb-1 block text-xs font-medium text-zinc-500">
                Max Video Ads Per Session
              </label>
              <input
                id="as-max"
                type="number"
                min={0}
                max={100}
                value={settingsDraft.maxAdsPerSession}
                onChange={(e) =>
                  setSettingsDraft((p) => ({ ...p, maxAdsPerSession: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
            </div>

            <div>
              <label htmlFor="as-min-sec" className="mb-1 block text-xs font-medium text-zinc-500">
                Min Seconds Between Video Ads (Cooldown)
              </label>
              <input
                id="as-min-sec"
                type="number"
                min={0}
                max={7200}
                value={settingsDraft.minSecondsBetweenVideoAds}
                onChange={(e) =>
                  setSettingsDraft((p) => ({
                    ...p,
                    minSecondsBetweenVideoAds: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
            </div>

            <div>
              <label htmlFor="as-label" className="mb-1 block text-xs font-medium text-zinc-500">
                Ad Badge Label Text
              </label>
              <input
                id="as-label"
                type="text"
                maxLength={24}
                value={settingsDraft.adLabelText}
                onChange={(e) =>
                  setSettingsDraft((p) => ({ ...p, adLabelText: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
            </div>

            <div>
              <label htmlFor="as-dcap" className="mb-1 block text-xs font-medium text-zinc-500">
                Default Daily Impression Cap per Browser (0 = unlimited)
              </label>
              <input
                id="as-dcap"
                type="number"
                min={0}
                value={settingsDraft.defaultDailyCap}
                onChange={(e) =>
                  setSettingsDraft((p) => ({ ...p, defaultDailyCap: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-lg bg-[var(--kv-accent,#e50914)] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Ad Settings'}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================
          SECTION 5: REPORTS
         ============================================================ */}
      {section === 'reports' && (
        <AdReportsView
          customAds={customAds}
          vastAds={vastAds}
          adEvents={adEvents}
          movies={movies}
          adminName={adminName}
        />
      )}

      {/* Modals */}
      <CustomAdFormModal
        open={customModalOpen}
        initialAd={editingCustomAd}
        movies={movies}
        episodes={episodesList}
        adminUid={adminUid}
        onClose={() => setCustomModalOpen(false)}
        onSave={onSaveCustomAd}
        onNotify={onNotify}
      />

      <VastAdFormModal
        open={vastModalOpen}
        initialAd={editingVastAd}
        movies={movies}
        episodes={episodesList}
        adminUid={adminUid}
        onClose={() => setVastModalOpen(false)}
        onSave={onSaveVastAd}
      />

      <VastTestPreviewModal
        ad={testingVastAd}
        onClose={() => setTestingVastAd(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingCustomAd)}
        title="Delete Custom Ad"
        message={`Delete "${deletingCustomAd?.name}" and remove any uploaded ad creative from Firebase Storage?`}
        confirmLabel="Delete Ad"
        danger
        onCancel={() => setDeletingCustomAd(null)}
        onConfirm={async () => {
          if (!deletingCustomAd) return;
          await onDeleteCustomAd(deletingCustomAd);
          setDeletingCustomAd(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingVastAd)}
        title="Delete VAST Ad"
        message={`Delete VAST campaign "${deletingVastAd?.name}" permanently?`}
        confirmLabel="Delete VAST Ad"
        danger
        onCancel={() => setDeletingVastAd(null)}
        onConfirm={async () => {
          if (!deletingVastAd) return;
          await onDeleteVastAd(deletingVastAd);
          setDeletingVastAd(null);
        }}
      />
    </div>
  );
};
