import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  Film,
  KeyRound,
  Layers,
  Lock,
  PlayCircle,
  Save,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import type {
  AccessMode,
  AccessRule,
  AdGlobalSettings,
  AdUnlockRecord,
  AdUnlockSettings,
  EpisodeItem,
  MovieItem,
  SubscriptionPlan,
  UserProfile,
  VastAdItem,
} from '../../types/streaming';
import { DEFAULT_UNLOCK_SETTINGS } from '../../data/seedAds';
import {
  canWatch,
  getBadgeModel,
  getUnlockSettings,
  resolveEffectiveAccess,
} from '../../utils/accessControl';
import {
  bulkUpdateAccessRules,
  fetchSeriesEpisodes,
  saveMovieDoc,
  seedHybridAccessDemoToFirestore,
} from '../../lib/firebase';
import { AccessBadge } from '../user/AccessBadge';
import { ConfirmDialog } from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface AccessManagerViewProps {
  movies: MovieItem[];
  plans: SubscriptionPlan[];
  vastAds: VastAdItem[];
  adSettings: AdGlobalSettings;
  adminUid: string;
  onSaveAdSettings: (next: AdGlobalSettings) => Promise<void>;
  onRefreshAll: () => Promise<void>;
}

const MODE_LABELS: Record<AccessMode, string> = {
  inherit: 'Inherit',
  free: 'Free',
  subscription_only: 'Sub Only',
  ad_unlock_only: 'Ad Only',
  subscription_or_ad: 'Sub or Ad',
};

function heatmapColorClass(mode: AccessMode, effectiveMode?: Exclude<AccessMode, 'inherit'>): string {
  const m = mode === 'inherit' ? 'inherit' : effectiveMode ?? mode;
  switch (m) {
    case 'free':
      return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
    case 'subscription_only':
      return 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'ad_unlock_only':
      return 'border-teal-500/50 bg-teal-500/15 text-teal-700 dark:text-teal-300';
    case 'subscription_or_ad':
      return 'border-violet-500/50 bg-violet-500/15 text-violet-700 dark:text-violet-300';
    default:
      return 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400';
  }
}

export const AccessManagerView: React.FC<AccessManagerViewProps> = ({
  movies,
  plans,
  vastAds,
  adSettings,
  adminUid,
  onSaveAdSettings,
  onRefreshAll,
}) => {
  const { notify } = useToast();
  const [subTab, setSubTab] = useState<'tree' | 'settings'>('tree');
  const [seedingDemo, setSeedingDemo] = useState(false);

  // --- Series Tree & Heatmap State ---
  const seriesList = useMemo(() => movies.filter((m) => m.type === 'series'), [movies]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(seriesList[0]?.id ?? '');
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [selectedEpIds, setSelectedEpIds] = useState<string[]>([]);
  const [lastClickedEpId, setLastClickedEpId] = useState<string | null>(null);

  // Bulk rule draft
  const defaultPlan = plans.find((p) => p.isActive) ?? plans[0];
  const [bulkMode, setBulkMode] = useState<AccessMode>('subscription_or_ad');
  const [bulkPlanId, setBulkPlanId] = useState<string>(defaultPlan?.id ?? 'plan-cinema-plus');
  const [bulkAdsRequired, setBulkAdsRequired] = useState(1);
  const [bulkAdSource, setBulkAdSource] = useState<'any_vast' | 'specific_ad_ids'>('any_vast');
  const [bulkAdIds, setBulkAdIds] = useState<string[]>([]);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [applyingBulk, setApplyingBulk] = useState(false);

  // Quick Rules Wizard
  const [wizardPreset, setWizardPreset] = useState<
    'first_n_free' | 'every_nth_free' | 'all_sub_or_ad' | 'reset_inherit'
  >('first_n_free');
  const [wizardParamN, setWizardParamN] = useState(2);
  const [confirmWizardOpen, setConfirmWizardOpen] = useState(false);

  // --- Ad Unlock & Badge Settings Draft ---
  const [unlockDraft, setUnlockDraft] = useState<AdUnlockSettings>(() =>
    getUnlockSettings(adSettings)
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // --- "Test as viewer" Simulator ---
  const [simRole, setSimRole] = useState<'guest' | 'free_user' | 'subscriber' | 'expired_unlock'>('free_user');
  const [simMovieId, setSimMovieId] = useState<string>(movies[0]?.id ?? '');
  const [simEpisodeId, setSimEpisodeId] = useState<string>('');
  const [simEpisodes, setSimEpisodes] = useState<EpisodeItem[]>([]);

  useEffect(() => {
    setUnlockDraft(getUnlockSettings(adSettings));
  }, [adSettings]);

  useEffect(() => {
    if (!selectedSeriesId && seriesList[0]?.id) {
      setSelectedSeriesId(seriesList[0].id);
    }
  }, [seriesList, selectedSeriesId]);

  useEffect(() => {
    if (!simMovieId && movies[0]?.id) {
      setSimMovieId(movies[0].id);
    }
  }, [movies, simMovieId]);

  useEffect(() => {
    if (!selectedSeriesId) {
      setEpisodes([]);
      return;
    }
    let active = true;
    setLoadingEps(true);
    fetchSeriesEpisodes(selectedSeriesId)
      .then((list) => {
        if (!active) return;
        setEpisodes(list);
        setSelectedEpIds([]);
      })
      .finally(() => {
        if (active) setLoadingEps(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSeriesId]);

  const simMovie = useMemo(
    () => movies.find((m) => m.id === simMovieId) ?? movies[0],
    [movies, simMovieId]
  );

  useEffect(() => {
    if (!simMovie || simMovie.type !== 'series') {
      setSimEpisodes([]);
      setSimEpisodeId('');
      return;
    }
    let active = true;
    fetchSeriesEpisodes(simMovie.id).then((eps) => {
      if (!active) return;
      setSimEpisodes(eps);
      setSimEpisodeId(eps[0]?.id ?? '');
    });
    return () => {
      active = false;
    };
  }, [simMovie?.id, simMovie?.type]);

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.id === selectedSeriesId) ?? null,
    [seriesList, selectedSeriesId]
  );

  const seasonsGrouped = useMemo(() => {
    const groups = new Map<number, EpisodeItem[]>();
    episodes.forEach((ep) => {
      const list = groups.get(ep.seasonNumber) || [];
      list.push(ep);
      groups.set(ep.seasonNumber, list);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([seasonNum, list]) => ({
        seasonNum,
        episodes: list.sort((a, b) => a.number - b.number),
      }));
  }, [episodes]);

  const flatOrderedEpisodes = useMemo(
    () => seasonsGrouped.flatMap((g) => g.episodes),
    [seasonsGrouped]
  );

  const playableVastAds = useMemo(
    () => vastAds.filter((v) => v.type !== 'overlay'),
    [vastAds]
  );

  const buildRuleFromDraft = (mode: AccessMode): AccessRule => {
    const chosenPlan = plans.find((p) => p.id === bulkPlanId) ?? defaultPlan;
    return {
      mode,
      planId:
        mode === 'subscription_only' || mode === 'subscription_or_ad'
          ? chosenPlan?.id ?? 'plan-cinema-plus'
          : null,
      planName:
        mode === 'subscription_only' || mode === 'subscription_or_ad'
          ? chosenPlan?.name ?? 'Cinema Plus'
          : null,
      requiresSignIn: mode === 'subscription_only',
      adUnlockAllowed: mode === 'ad_unlock_only' || mode === 'subscription_or_ad',
      adsRequired: bulkAdsRequired,
      adSource: bulkAdSource,
      adIds: bulkAdSource === 'specific_ad_ids' ? bulkAdIds : [],
    };
  };

  const handleEpisodeTileClick = (ep: EpisodeItem, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedEpId) {
      const a = flatOrderedEpisodes.findIndex((x) => x.id === lastClickedEpId);
      const b = flatOrderedEpisodes.findIndex((x) => x.id === ep.id);
      if (a >= 0 && b >= 0) {
        const [start, end] = a <= b ? [a, b] : [b, a];
        const rangeIds = flatOrderedEpisodes.slice(start, end + 1).map((x) => x.id);
        setSelectedEpIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedEpIds((prev) =>
        prev.includes(ep.id) ? prev.filter((id) => id !== ep.id) : [...prev, ep.id]
      );
      setLastClickedEpId(ep.id);
      return;
    }
    setSelectedEpIds((prev) =>
      prev.includes(ep.id) ? prev.filter((id) => id !== ep.id) : [...prev, ep.id]
    );
    setLastClickedEpId(ep.id);
  };

  const wizardPreviewChanges = useMemo(() => {
    if (!selectedSeries || flatOrderedEpisodes.length === 0) return [];
    const chosenPlan = plans.find((p) => p.id === bulkPlanId) ?? defaultPlan;
    const subOrAdRule: AccessRule = {
      mode: 'subscription_or_ad',
      planId: chosenPlan?.id ?? 'plan-cinema-plus',
      planName: chosenPlan?.name ?? 'Cinema Plus',
      adUnlockAllowed: true,
      adsRequired: 1,
      adSource: 'any_vast',
      adIds: [],
    };
    const freeRule: AccessRule = {
      mode: 'free',
      planId: null,
      planName: null,
      requiresSignIn: false,
      adUnlockAllowed: false,
      adsRequired: 1,
      adSource: 'any_vast',
      adIds: [],
    };
    const inheritRule: AccessRule = { mode: 'inherit' };

    return flatOrderedEpisodes.map((ep, globalIdx) => {
      const beforeMode = resolveEffectiveAccess(selectedSeries, ep).mode;
      let nextRule: AccessRule = inheritRule;
      if (wizardPreset === 'first_n_free') {
        nextRule = globalIdx < wizardParamN ? freeRule : subOrAdRule;
      } else if (wizardPreset === 'every_nth_free') {
        const n = Math.max(2, wizardParamN);
        nextRule = (globalIdx + 1) % n === 1 ? freeRule : subOrAdRule;
      } else if (wizardPreset === 'all_sub_or_ad') {
        nextRule = subOrAdRule;
      } else if (wizardPreset === 'reset_inherit') {
        nextRule = inheritRule;
      }
      const simulatedEp: EpisodeItem = { ...ep, access: nextRule };
      const afterMode = resolveEffectiveAccess(selectedSeries, simulatedEp).mode;
      return {
        ep,
        nextRule,
        beforeMode,
        afterMode,
        changed: beforeMode !== afterMode || ep.access?.mode !== nextRule.mode,
      };
    });
  }, [selectedSeries, flatOrderedEpisodes, wizardPreset, wizardParamN, plans, bulkPlanId, defaultPlan]);

  const handleApplyBulk = async () => {
    if (!selectedSeries || selectedEpIds.length === 0) return;
    setApplyingBulk(true);
    try {
      const rule = buildRuleFromDraft(bulkMode);
      const targets = flatOrderedEpisodes.filter((ep) => selectedEpIds.includes(ep.id));
      await bulkUpdateAccessRules({
        seriesId: selectedSeries.id,
        episodePatches: targets.map((ep) => ({
          seasonId: ep.seasonId,
          episodeId: ep.id,
          access: rule,
        })),
        adminUid,
        actionSummary: `Bulk set ${targets.length} episodes of "${selectedSeries.title}" to ${bulkMode}`,
      });
      setEpisodes((prev) =>
        prev.map((ep) => (selectedEpIds.includes(ep.id) ? { ...ep, access: rule } : ep))
      );
      setSelectedEpIds([]);
      setConfirmBulkOpen(false);
      notify(`Updated ${targets.length} episodes to "${MODE_LABELS[bulkMode]}"`, 'success');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleApplyWizard = async () => {
    if (!selectedSeries || wizardPreviewChanges.length === 0) return;
    setApplyingBulk(true);
    try {
      await bulkUpdateAccessRules({
        seriesId: selectedSeries.id,
        episodePatches: wizardPreviewChanges.map((item) => ({
          seasonId: item.ep.seasonId,
          episodeId: item.ep.id,
          access: item.nextRule,
        })),
        adminUid,
        actionSummary: `Applied Quick Rules Wizard (${wizardPreset}) to "${selectedSeries.title}"`,
      });
      const patchMap = new Map(wizardPreviewChanges.map((c) => [c.ep.id, c.nextRule]));
      setEpisodes((prev) =>
        prev.map((ep) => ({ ...ep, access: patchMap.get(ep.id) ?? ep.access }))
      );
      setConfirmWizardOpen(false);
      notify(`Applied wizard rules across ${wizardPreviewChanges.length} episodes`, 'success');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      await seedHybridAccessDemoToFirestore(adminUid);
      await onRefreshAll();
      setSelectedSeriesId('the-amber-signal');
      notify('Seeded 2-Season Hybrid Access Demo ("The Amber Signal") & Demo Movies', 'success');
    } finally {
      setSeedingDemo(false);
    }
  };

  // Simulator calculations
  const simUser: UserProfile | null = useMemo(() => {
    if (simRole === 'guest') return null;
    const base: UserProfile = {
      uid: 'sim-viewer',
      displayName: 'Preview Viewer',
      email: 'viewer@kinovault.demo',
      photoURL: '',
      role: 'user',
      status: 'active',
      plan: simRole === 'subscriber' ? 'premium' : 'free',
      subscriptionPlanId: simRole === 'subscriber' ? (defaultPlan?.id ?? 'plan-cinema-plus') : null,
      subscriptionPlanName: simRole === 'subscriber' ? (defaultPlan?.name ?? 'Cinema Plus') : null,
      planExpiresAt: simRole === 'subscriber' ? new Date(Date.now() + 30 * 86400_000).toISOString() : null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    return base;
  }, [simRole, defaultPlan]);

  const simEpisode = useMemo(
    () => simEpisodes.find((e) => e.id === simEpisodeId) ?? null,
    [simEpisodes, simEpisodeId]
  );

  const simAdSettings: AdGlobalSettings = useMemo(
    () => ({ ...adSettings, unlockSettings: unlockDraft }),
    [adSettings, unlockDraft]
  );

  const simUnlocksMap: Record<string, AdUnlockRecord> = useMemo(() => {
    if (simRole !== 'expired_unlock' || !simMovie) return {};
    const cid = simEpisode?.id ?? simMovie.id;
    return {
      [cid]: {
        contentId: cid,
        contentType: simEpisode ? 'episode' : 'movie',
        seriesId: simEpisode ? simMovie.id : undefined,
        unlockedAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
        adId: 'sim-vast',
        method: 'rewarded_ad',
      },
    };
  }, [simRole, simMovie, simEpisode]);

  const simEval = useMemo(() => {
    if (!simMovie) return null;
    return canWatch({
      user: simUser,
      movie: simMovie,
      episode: simEpisode,
      plans,
      unlocksMap: simUnlocksMap,
      adSettings: simAdSettings,
    });
  }, [simUser, simMovie, simEpisode, plans, simUnlocksMap, simAdSettings]);

  const previewSampleMovies = useMemo(() => {
    const base = movies[0] || {
      id: 'preview',
      title: 'Sample Title',
      slug: 'sample',
      type: 'movie' as const,
      description: '',
      releaseYear: 2026,
      duration: 120,
      rating: 8.5,
      ageRating: 'PG-13' as const,
      language: 'English',
      country: 'US',
      genres: ['Drama'],
      cast: [],
      director: '',
      tags: [],
      posterUrl: '/src/assets/images/poster_solaris_drift_1794830225596.jpg',
      bannerUrl: '',
      trailerUrl: '',
      videoSources: [],
      subtitles: [],
      isFeatured: false,
      isTrending: false,
      isPremium: false,
      status: 'published' as const,
      views: 0,
      likesCount: 0,
      createdAt: '',
      updatedAt: '',
    };
    return {
      subOnly: { ...base, access: { mode: 'subscription_only' as const, planId: defaultPlan?.id, planName: defaultPlan?.name } },
      adOnly: { ...base, access: { mode: 'ad_unlock_only' as const, adUnlockAllowed: true } },
      hybrid: { ...base, access: { mode: 'subscription_or_ad' as const, planId: defaultPlan?.id, planName: defaultPlan?.name, adUnlockAllowed: true } },
      free: { ...base, isPremium: false, requiredPlanId: null, requiresSignIn: false, access: { mode: 'free' as const } },
    };
  }, [movies, defaultPlan]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('tree')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === 'tree'
                ? 'bg-[#7c3aed] text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Series Tree &amp; Bulk Rules
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === 'settings'
                ? 'bg-[#7c3aed] text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Ad-Unlock, Badges &amp; Simulator
          </button>
        </div>

        <button
          type="button"
          disabled={seedingDemo}
          onClick={handleSeedDemo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
        >
          <Database className="h-3.5 w-3.5" />
          {seedingDemo ? 'Seeding Hybrid Demo...' : 'Seed Hybrid Access Demo'}
        </button>
      </div>

      {/* TAB 1: SERIES TREE, HEATMAP & QUICK WIZARD */}
      {subTab === 'tree' && (
        <div className="space-y-6">
          {seriesList.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-[#13131c]">
              <Film className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-sm text-zinc-500">
                No Series found yet. Click “Seed Hybrid Access Demo” above to create a 2-season x 5-episode sample series.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              {/* Left 2 Columns: Tree + Heatmap */}
              <div className="space-y-5 xl:col-span-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-bold">
                        Hierarchical Access Matrix
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Click tiles to toggle · Shift+Click for range · Ctrl/Cmd+Click multi-select
                      </p>
                    </div>
                    <select
                      aria-label="Select series"
                      value={selectedSeriesId}
                      onChange={(e) => setSelectedSeriesId(e.target.value)}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {seriesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Series Root Default */}
                  {selectedSeries && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="text-xs">
                        <span className="font-semibold">Series Default Rule:</span>{' '}
                        <span className="text-zinc-500">
                          {MODE_LABELS[resolveEffectiveAccess(selectedSeries).mode]}
                          {selectedSeries.access?.planName ? ` (${selectedSeries.access.planName})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Series default access mode"
                          value={selectedSeries.access?.mode ?? resolveEffectiveAccess(selectedSeries).mode}
                          onChange={async (e) => {
                            const nextMode = e.target.value as AccessMode;
                            const rule = buildRuleFromDraft(nextMode);
                            await saveMovieDoc(
                              {
                                ...selectedSeries,
                                access: rule,
                                isPremium:
                                  nextMode === 'subscription_only' ||
                                  nextMode === 'subscription_or_ad',
                                requiredPlanId: rule.planId ?? null,
                                requiredPlanName: rule.planName ?? null,
                                updatedAt: new Date().toISOString(),
                              },
                              adminUid,
                              false
                            );
                            await onRefreshAll();
                            notify(`Series default updated to ${MODE_LABELS[nextMode]}`, 'success');
                          }}
                          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="free">Free</option>
                          <option value="subscription_or_ad">Sub or Ad</option>
                          <option value="subscription_only">Sub Only</option>
                          <option value="ad_unlock_only">Ad Only</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Heatmap Legend */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Free
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Sub or Ad
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Sub Only
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Ad Only
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-zinc-500" /> Inherit
                    </span>
                  </div>

                  {/* Season Tree & Heatmap Grid */}
                  {loadingEps ? (
                    <p className="mt-6 text-xs text-zinc-500">Loading episodes...</p>
                  ) : seasonsGrouped.length === 0 ? (
                    <p className="mt-6 text-xs text-zinc-500">No episodes in this series yet.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {seasonsGrouped.map(({ seasonNum, episodes: sEps }) => {
                        const isOpen = expandedSeasons[seasonNum] !== false;
                        const seasonKey = `season-${seasonNum}`;
                        const seasonRuleMode =
                          selectedSeries?.seasonAccess?.[seasonKey]?.mode ?? 'inherit';
                        return (
                          <div
                            key={seasonNum}
                            className="rounded-xl border border-zinc-200 dark:border-zinc-800"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSeasons((p) => ({ ...p, [seasonNum]: !isOpen }))
                                }
                                className="inline-flex items-center gap-1.5 text-xs font-bold"
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                Season {seasonNum} ({sEps.length} eps)
                              </button>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-500">Season override:</span>
                                <select
                                  aria-label={`Season ${seasonNum} override`}
                                  value={seasonRuleMode}
                                  onChange={async (e) => {
                                    if (!selectedSeries) return;
                                    const nextMode = e.target.value as AccessMode;
                                    const nextSeasonAccess = {
                                      ...(selectedSeries.seasonAccess || {}),
                                      [seasonKey]: buildRuleFromDraft(nextMode),
                                    };
                                    await bulkUpdateAccessRules({
                                      seriesId: selectedSeries.id,
                                      seasonAccessPatch: nextSeasonAccess,
                                      adminUid,
                                      actionSummary: `Set Season ${seasonNum} override on "${selectedSeries.title}" to ${nextMode}`,
                                    });
                                    await onRefreshAll();
                                    notify(`Season ${seasonNum} rule updated`, 'success');
                                  }}
                                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  <option value="inherit">Inherit from Series</option>
                                  <option value="free">Free</option>
                                  <option value="subscription_or_ad">Sub or Ad</option>
                                  <option value="subscription_only">Sub Only</option>
                                  <option value="ad_unlock_only">Ad Only</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedEpIds((prev) =>
                                      Array.from(new Set([...prev, ...sEps.map((x) => x.id)]))
                                    )
                                  }
                                  className="text-[11px] font-medium text-[#7c3aed] hover:underline"
                                >
                                  Select Season
                                </button>
                              </div>
                            </div>

                            {isOpen && (
                              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-5">
                                {sEps.map((ep) => {
                                  const rawMode = ep.access?.mode ?? 'inherit';
                                  const effective = selectedSeries
                                    ? resolveEffectiveAccess(selectedSeries, ep)
                                    : null;
                                  const isSelected = selectedEpIds.includes(ep.id);
                                  return (
                                    <button
                                      key={ep.id}
                                      type="button"
                                      onClick={(e) => handleEpisodeTileClick(ep, e)}
                                      className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${heatmapColorClass(
                                        rawMode,
                                        effective?.mode
                                      )} ${
                                        isSelected
                                          ? 'ring-2 ring-[#7c3aed] ring-offset-1 dark:ring-offset-[#13131c]'
                                          : 'hover:opacity-90'
                                      }`}
                                    >
                                      <div className="flex w-full items-center justify-between text-[11px] font-bold">
                                        <span>
                                          S{ep.seasonNumber}E{ep.number}
                                        </span>
                                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-[#7c3aed]" />}
                                      </div>
                                      <p className="mt-1 line-clamp-1 w-full text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                                        {ep.title}
                                      </p>
                                      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-85">
                                        {rawMode === 'inherit'
                                          ? `Inherit (${MODE_LABELS[effective?.mode ?? 'free']})`
                                          : MODE_LABELS[rawMode]}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Floating/Inline Bulk Action Bar */}
                {selectedEpIds.length > 0 && (
                  <div className="rounded-xl border border-[#7c3aed]/50 bg-[#7c3aed]/10 p-4 dark:bg-[#7c3aed]/15">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#7c3aed] dark:text-violet-300">
                        {selectedEpIds.length} episode{selectedEpIds.length === 1 ? '' : 's'} selected for bulk update
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedEpIds([])}
                        className="text-xs text-zinc-500 hover:underline"
                      >
                        Clear selection
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-zinc-500">Access Mode</label>
                        <select
                          value={bulkMode}
                          onChange={(e) => setBulkMode(e.target.value as AccessMode)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="inherit">Inherit from Season/Series</option>
                          <option value="free">Free</option>
                          <option value="subscription_or_ad">Sub or Ad</option>
                          <option value="subscription_only">Subscription Only</option>
                          <option value="ad_unlock_only">Ad-Unlock Only</option>
                        </select>
                      </div>

                      {(bulkMode === 'subscription_only' || bulkMode === 'subscription_or_ad') && (
                        <div>
                          <label className="mb-1 block text-[11px] text-zinc-500">Required Plan</label>
                          <select
                            value={bulkPlanId}
                            onChange={(e) => setBulkPlanId(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(bulkMode === 'ad_unlock_only' || bulkMode === 'subscription_or_ad') && (
                        <div>
                          <label className="mb-1 block text-[11px] text-zinc-500">Ads Required (1–3)</label>
                          <select
                            value={bulkAdsRequired}
                            onChange={(e) => setBulkAdsRequired(Number(e.target.value))}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {[1, 2, 3].map((n) => (
                              <option key={n} value={n}>
                                {n} ad{n > 1 ? 's' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {(bulkMode === 'ad_unlock_only' || bulkMode === 'subscription_or_ad') && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="radio"
                              checked={bulkAdSource === 'any_vast'}
                              onChange={() => setBulkAdSource('any_vast')}
                            />
                            Any active VAST ad
                          </label>
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="radio"
                              checked={bulkAdSource === 'specific_ad_ids'}
                              onChange={() => setBulkAdSource('specific_ad_ids')}
                            />
                            Pick specific VAST ads
                          </label>
                        </div>
                        {bulkAdSource === 'specific_ad_ids' && (
                          <div className="flex flex-wrap gap-2">
                            {playableVastAds.map((ad) => {
                              const checked = bulkAdIds.includes(ad.id);
                              return (
                                <label
                                  key={ad.id}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setBulkAdIds((prev) =>
                                        e.target.checked
                                          ? [...prev, ad.id]
                                          : prev.filter((id) => id !== ad.id)
                                      )
                                    }
                                  />
                                  {ad.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmBulkOpen(true)}
                        className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d28d9]"
                      >
                        Apply to {selectedEpIds.length} Selected
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Quick Rules Wizard */}
              <div className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-[#7c3aed]" />
                  <h3 className="font-display text-sm font-bold">Quick Rules Wizard</h3>
                </div>
                <p className="text-xs text-zinc-500">
                  Preview and batch-apply a monetization pattern across all episodes of{' '}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {selectedSeries?.title || 'this series'}
                  </strong>
                  .
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Rule Preset</label>
                    <select
                      value={wizardPreset}
                      onChange={(e) =>
                        setWizardPreset(
                          e.target.value as
                            | 'first_n_free'
                            | 'every_nth_free'
                            | 'all_sub_or_ad'
                            | 'reset_inherit'
                        )
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="first_n_free">First N episodes Free, rest Sub or Ad</option>
                      <option value="every_nth_free">Every Nth episode Free</option>
                      <option value="all_sub_or_ad">All episodes Sub or Ad</option>
                      <option value="reset_inherit">Reset all to Inherit</option>
                    </select>
                  </div>

                  {(wizardPreset === 'first_n_free' || wizardPreset === 'every_nth_free') && (
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">
                        {wizardPreset === 'first_n_free' ? 'Free leading episodes (N)' : 'Every Nth episode'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={wizardParamN}
                        onChange={(e) => setWizardParamN(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
                      />
                    </div>
                  )}

                  {/* Diff Preview */}
                  <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Before → After Diff Preview
                    </p>
                    {wizardPreviewChanges.map(({ ep, beforeMode, afterMode, changed }) => (
                      <div
                        key={ep.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="truncate font-mono text-zinc-500">
                          S{ep.seasonNumber}E{ep.number}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-zinc-400">{MODE_LABELS[beforeMode]}</span>
                          <span>→</span>
                          <span
                            className={
                              changed ? 'font-bold text-[#7c3aed] dark:text-violet-400' : 'text-zinc-500'
                            }
                          >
                            {MODE_LABELS[afterMode]}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={wizardPreviewChanges.length === 0 || applyingBulk}
                    onClick={() => setConfirmWizardOpen(true)}
                    className="w-full rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
                  >
                    Apply Wizard Rules ({wizardPreviewChanges.length} eps)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AD-UNLOCK SETTINGS, BADGES & VIEWER SIMULATOR */}
      {subTab === 'settings' && (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingSettings(true);
              try {
                await onSaveAdSettings({
                  ...adSettings,
                  unlockSettings: unlockDraft,
                });
              } finally {
                setSavingSettings(false);
              }
            }}
            className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#13131c] xl:col-span-2"
          >
            <div>
              <h2 className="font-display text-base font-bold">
                Rewarded Ad-Unlock &amp; Gate Copy Settings
              </h2>
              <p className="text-xs text-zinc-500">
                Configure expiry windows, hourly rate limits, failure fallbacks, gate wording, and card badge labels.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  key: 'adUnlockEnabled' as const,
                  title: 'Enable Ad-Unlock Globally',
                  desc: 'Show "Watch Ad to Unlock" option on eligible gated titles.',
                },
                {
                  key: 'allowGuestAdUnlock' as const,
                  title: 'Allow Guest Ad-Unlock',
                  desc: 'Let unauthenticated visitors watch ads to unlock into browser storage.',
                },
                {
                  key: 'unlockSkipAllowed' as const,
                  title: 'Allow Skipping Rewarded Ads',
                  desc: 'Off by default: viewer must finish the ad before unlocking.',
                },
                {
                  key: 'showCardBadges' as const,
                  title: 'Show Badges on Cards & Lists',
                  desc: 'Display orange plan, green ad-unlock, and free badges.',
                },
              ].map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-xs font-semibold">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{t.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(unlockDraft[t.key])}
                    onChange={(e) =>
                      setUnlockDraft((prev) => ({ ...prev, [t.key]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#7c3aed]"
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Validity Scope
                </label>
                <select
                  value={unlockDraft.unlockValidityMode}
                  onChange={(e) =>
                    setUnlockDraft((p) => ({
                      ...p,
                      unlockValidityMode: e.target.value as 'episode_hours' | 'session',
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="episode_hours">Episode / Title for X Hours</option>
                  <option value="session">This Browser Session Only</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Validity Hours (Default 24h)
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  disabled={unlockDraft.unlockValidityMode === 'session'}
                  value={unlockDraft.unlockValidityHours}
                  onChange={(e) =>
                    setUnlockDraft((p) => ({ ...p, unlockValidityHours: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums disabled:opacity-50 dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Max Unlocks / User / Hour
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={unlockDraft.maxUnlocksPerHour}
                  onChange={(e) =>
                    setUnlockDraft((p) => ({ ...p, maxUnlocksPerHour: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Fallback After 2 Ad Failures
                </label>
                <select
                  value={unlockDraft.adErrorFallback}
                  onChange={(e) =>
                    setUnlockDraft((p) => ({
                      ...p,
                      adErrorFallback: e.target.value as 'keep_locked' | 'allow_once',
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="keep_locked">Keep Locked (“Subscribe instead”)</option>
                  <option value="allow_once">Allow Free Playback Once</option>
                </select>
              </div>
            </div>

            {/* Editable Gate Copy */}
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-zinc-500">
                Watch Gate Copy (Tokens: {'{plan}'}, {'{price}'}, {'{title}'}, {'{episode}'}, {'{ads}'})
              </h3>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Gate Title</label>
                <input
                  type="text"
                  value={unlockDraft.gateTitle}
                  onChange={(e) => setUnlockDraft((p) => ({ ...p, gateTitle: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Gate Description</label>
                <textarea
                  rows={2}
                  value={unlockDraft.gateDescription}
                  onChange={(e) =>
                    setUnlockDraft((p) => ({ ...p, gateDescription: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
                />
              </div>
            </div>

            {/* Badge Text & Visibility Controls */}
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-zinc-500">
                Badge Labels &amp; Toggles
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Paid Badge Text</label>
                  <input
                    type="text"
                    value={unlockDraft.paidBadgeText}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, paidBadgeText: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Ad Badge Text</label>
                  <input
                    type="text"
                    value={unlockDraft.adBadgeText}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, adBadgeText: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Free Badge Text</label>
                  <input
                    type="text"
                    value={unlockDraft.freeBadgeText}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, freeBadgeText: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Included Badge Text</label>
                  <input
                    type="text"
                    value={unlockDraft.includedBadgeText}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, includedBadgeText: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-xs dark:border-zinc-700"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-5 pt-1 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={unlockDraft.showFreeBadge}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, showFreeBadge: e.target.checked }))
                    }
                    className="accent-[#7c3aed]"
                  />
                  Show “{unlockDraft.freeBadgeText || 'Free'}” badge on free cards
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={unlockDraft.showIncludedBadge}
                    onChange={(e) =>
                      setUnlockDraft((p) => ({ ...p, showIncludedBadge: e.target.checked }))
                    }
                    className="accent-[#7c3aed]"
                  />
                  Show “{unlockDraft.includedBadgeText || 'Included'}” badge to subscribers
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingSettings ? 'Saving...' : 'Save Ad-Unlock & Badge Settings'}
              </button>
            </div>
          </form>

          {/* Right Column: Live Badge Preview + "Test as Viewer" Simulator */}
          <div className="space-y-6">
            {/* Live Desktop & Mobile Badge Matrix */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <h3 className="font-display text-sm font-bold">Live Badge Preview</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Desktop full labels &amp; mobile compact codes update live as you edit.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Subscription Only', m: previewSampleMovies.subOnly },
                  { label: 'Free with Ads', m: previewSampleMovies.adOnly },
                  { label: 'Hybrid (Sub or Ad)', m: previewSampleMovies.hybrid },
                  { label: 'Free Title', m: previewSampleMovies.free },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                  >
                    <span className="text-[11px] font-medium text-zinc-500">{row.label}</span>
                    <AccessBadge
                      movie={row.m}
                      plans={plans}
                      adSettings={simAdSettings}
                      compactResponsive={false}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Test as Viewer Simulator */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#7c3aed]" />
                <h3 className="font-display text-sm font-bold">Test as Viewer Simulator</h3>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Simulated Role</label>
                  <select
                    value={simRole}
                    onChange={(e) =>
                      setSimRole(
                        e.target.value as 'guest' | 'free_user' | 'subscriber' | 'expired_unlock'
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="guest">Guest (Not Signed In)</option>
                    <option value="free_user">Free Signed-In Viewer</option>
                    <option value="subscriber">Cinema Plus Subscriber</option>
                    <option value="expired_unlock">Expired Ad-Unlock</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Title</label>
                  <select
                    value={simMovieId}
                    onChange={(e) => setSimMovieId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {movies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.type})
                      </option>
                    ))}
                  </select>
                </div>

                {simEpisodes.length > 0 && (
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-500">Episode</label>
                    <select
                      value={simEpisodeId}
                      onChange={(e) => setSimEpisodeId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {simEpisodes.map((ep) => (
                        <option key={ep.id} value={ep.id}>
                          S{ep.seasonNumber}E{ep.number}: {ep.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Miniature Gate / Direct Play Preview */}
              {simMovie && simEval && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center text-white">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>
                      Rule: <strong className="text-zinc-200">{simEval.mode}</strong> (from{' '}
                      {simEval.effectiveRule.inheritedFrom})
                    </span>
                    <AccessBadge
                      movie={simMovie}
                      episode={simEpisode}
                      user={simUser}
                      plans={plans}
                      adSettings={simAdSettings}
                      unlocksMap={simUnlocksMap}
                      compactResponsive={false}
                    />
                  </div>

                  {simEval.allowed ? (
                    <div className="space-y-1 py-4">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
                      <p className="font-display text-sm font-bold">Plays Directly Ad-Free</p>
                      <p className="text-[11px] text-zinc-400">Reason: {simEval.reason}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <p className="font-display text-sm font-bold">
                        {simEval.requiresSignInFirst
                          ? 'Sign In to Watch'
                          : simEval.canWatchAd
                          ? simEval.copy.gateTitle
                          : `Subscription Required: ${simEval.planName}`}
                      </p>
                      <p className="text-[11px] text-zinc-300 line-clamp-2">
                        {simEval.copy.gateDescription}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                        {!simUser && (
                          <span className="rounded bg-[#7c3aed] px-2.5 py-1 text-[10px] font-semibold">
                            Sign In to Watch
                          </span>
                        )}
                        {simEval.canWatchAd && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#7c3aed] px-2.5 py-1 text-[10px] font-semibold">
                            <PlayCircle className="h-3 w-3" />
                            {simEval.copy.watchAdLabel}
                          </span>
                        )}
                        {simEval.canSubscribe && (
                          <span className="rounded border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">
                            {simEval.copy.subscribeLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmBulkOpen}
        title="Confirm Bulk Access Update"
        message={`Apply "${MODE_LABELS[bulkMode]}" to ${selectedEpIds.length} selected episode(s) in "${selectedSeries?.title}"?`}
        confirmLabel={applyingBulk ? 'Applying...' : 'Apply Changes'}
        onCancel={() => setConfirmBulkOpen(false)}
        onConfirm={handleApplyBulk}
      />

      <ConfirmDialog
        open={confirmWizardOpen}
        title="Apply Quick Rules Wizard"
        message={`This will update access rules across ${wizardPreviewChanges.length} episodes of "${selectedSeries?.title}".`}
        confirmLabel={applyingBulk ? 'Applying...' : 'Confirm & Apply'}
        onCancel={() => setConfirmWizardOpen(false)}
        onConfirm={handleApplyWizard}
      />
    </div>
  );
};
