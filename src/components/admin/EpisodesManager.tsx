import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, KeyRound, Layers, Plus, Trash2 } from 'lucide-react';
import type {
  AccessMode,
  AccessRule,
  AdGlobalSettings,
  EpisodeItem,
  MovieItem,
  SubscriptionPlan,
  VastAdItem,
} from '../../types/streaming';
import { detectVideoSourceType } from '../../utils/youtube';
import {
  bulkUpdateAccessRules,
  deleteEpisodeDoc,
  fetchSeriesEpisodes,
  saveEpisodeDoc,
} from '../../lib/firebase';
import { AccessBadge } from '../user/AccessBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface EpisodesManagerProps {
  movies: MovieItem[];
  plans?: SubscriptionPlan[];
  vastAds?: VastAdItem[];
  adSettings?: AdGlobalSettings;
  adminUid: string;
  onSeriesUpdated?: (updatedMovie: MovieItem) => void;
}

export function EpisodesManager({
  movies,
  plans = [],
  vastAds = [],
  adSettings,
  adminUid,
  onSeriesUpdated,
}: EpisodesManagerProps) {
  const { notify } = useToast();
  const seriesList = movies.filter((m) => m.type === 'series');
  const [selectedSeriesId, setSelectedSeriesId] = useState(seriesList[0]?.id ?? '');
  const [seasonNum, setSeasonNum] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAccessEp, setEditingAccessEp] = useState<EpisodeItem | null>(null);
  const [epRuleDraft, setEpRuleDraft] = useState<AccessRule>({ mode: 'inherit' });

  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(45);
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedSeriesId && seriesList[0]?.id) {
      setSelectedSeriesId(seriesList[0].id);
    }
  }, [seriesList, selectedSeriesId]);

  useEffect(() => {
    if (!selectedSeriesId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchSeriesEpisodes(selectedSeriesId);
        if (active) setEpisodes(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedSeriesId]);

  const seasonEpisodes = episodes
    .filter((e) => e.seasonNumber === seasonNum)
    .sort((a, b) => a.number - b.number);

  const handleAddEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeriesId || !newTitle.trim()) return;
    const ep: EpisodeItem = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      seriesId: selectedSeriesId,
      seasonId: `season-${seasonNum}`,
      seasonNumber: seasonNum,
      number: seasonEpisodes.length + 1,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Episode synopsis.',
      duration: Math.max(1, newDuration),
      thumbnailUrl: '',
      videoSources: newUrl.trim()
        ? [{ label: '1080p', url: newUrl.trim(), type: detectVideoSourceType(newUrl.trim()) }]
        : [],
      subtitles: [],
      createdAt: new Date().toISOString(),
    };
    await saveEpisodeDoc(ep, adminUid);
    setEpisodes((prev) => [...prev, ep]);
    setNewTitle('');
    setNewUrl('');
    setNewDesc('');
    notify(`Added Episode ${ep.number}`, 'success');
  };

  const handleBulkImport = async () => {
    const lines = bulkUrls
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!selectedSeriesId || lines.length === 0) return;

    const created: EpisodeItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      const ep: EpisodeItem = {
        id: `ep-${Date.now()}-${i}`,
        seriesId: selectedSeriesId,
        seasonId: `season-${seasonNum}`,
        seasonNumber: seasonNum,
        number: seasonEpisodes.length + i + 1,
        title: `Episode ${seasonEpisodes.length + i + 1}`,
        description: 'Imported episode.',
        duration: 45,
        thumbnailUrl: '',
        videoSources: [
          {
            label: '1080p',
            url: lines[i],
            type: detectVideoSourceType(lines[i]),
          },
        ],
        subtitles: [],
        createdAt: new Date().toISOString(),
      };
      await saveEpisodeDoc(ep, adminUid);
      created.push(ep);
    }
    setEpisodes((prev) => [...prev, ...created]);
    setBulkUrls('');
    notify(`Imported ${created.length} episodes`, 'success');
  };

  const reorderEpisode = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= seasonEpisodes.length || fromIdx === toIdx) return;
    const reordered = [...seasonEpisodes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updatedSeason = reordered.map((ep, idx) => ({ ...ep, number: idx + 1 }));

    setEpisodes((prev) => [
      ...prev.filter((e) => e.seasonNumber !== seasonNum),
      ...updatedSeason,
    ]);

    for (const ep of updatedSeason) {
      await saveEpisodeDoc(ep, adminUid);
    }
    notify('Episode order saved', 'success');
  };

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.id === selectedSeriesId) ?? null,
    [seriesList, selectedSeriesId]
  );
  const playableVastAds = useMemo(() => vastAds.filter((a) => a.type !== 'overlay'), [vastAds]);
  const defaultPlan = plans.find((p) => p.isActive) ?? plans[0];

  if (seriesList.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-[#13131c]">
        <Layers className="mx-auto h-8 w-8 text-zinc-400" />
        <p className="mt-2 text-sm text-zinc-500">Create a Series title first to manage episodes.</p>
      </div>
    );
  }

  const seasonKey = `season-${seasonNum}`;
  const currentSeasonMode = selectedSeries?.seasonAccess?.[seasonKey]?.mode ?? 'inherit';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#13131c]">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Series</label>
            <select
              value={selectedSeriesId}
              onChange={(e) => setSelectedSeriesId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Season</label>
            <select
              value={seasonNum}
              onChange={(e) => setSeasonNum(Number(e.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Season {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Season Default Access Bar */}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Season {seasonNum} Default Access
          </label>
          <select
            value={currentSeasonMode}
            onChange={async (e) => {
              if (!selectedSeries) return;
              const nextMode = e.target.value as AccessMode;
              const nextSeasonAccess: Record<string, AccessRule> = {
                ...(selectedSeries.seasonAccess || {}),
                [seasonKey]: {
                  mode: nextMode,
                  planId:
                    nextMode === 'subscription_only' || nextMode === 'subscription_or_ad'
                      ? defaultPlan?.id ?? 'plan-cinema-plus'
                      : null,
                  planName:
                    nextMode === 'subscription_only' || nextMode === 'subscription_or_ad'
                      ? defaultPlan?.name ?? 'Cinema Plus'
                      : null,
                  adUnlockAllowed: nextMode === 'ad_unlock_only' || nextMode === 'subscription_or_ad',
                  adsRequired: 1,
                },
              };
              await bulkUpdateAccessRules({
                seriesId: selectedSeries.id,
                seasonAccessPatch: nextSeasonAccess,
                adminUid,
                actionSummary: `Updated Season ${seasonNum} access on "${selectedSeries.title}" to ${nextMode}`,
              });
              onSeriesUpdated?.({ ...selectedSeries, seasonAccess: nextSeasonAccess });
              notify(`Season ${seasonNum} default access saved`, 'success');
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="inherit">Inherit from Series</option>
            <option value="free">Free</option>
            <option value="subscription_or_ad">Sub or Ad</option>
            <option value="subscription_only">Subscription Only</option>
            <option value="ad_unlock_only">Ad-Unlock Only</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Episodes list with drag-and-drop */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c] lg:col-span-2">
          <h3 className="mb-4 font-display text-base font-semibold">
            Season {seasonNum} Episodes ({seasonEpisodes.length})
          </h3>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading episodes...</p>
          ) : seasonEpisodes.length === 0 ? (
            <p className="text-sm text-zinc-500">No episodes in Season {seasonNum}.</p>
          ) : (
            <div className="space-y-2">
              {seasonEpisodes.map((ep, idx) => (
                <div
                  key={ep.id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) reorderEpisode(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-400" />
                    <span className="font-mono-tabular shrink-0 text-xs font-semibold text-zinc-500">
                      E{ep.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{ep.title}</p>
                        {selectedSeries && (
                          <AccessBadge
                            movie={selectedSeries}
                            episode={ep}
                            plans={plans}
                            adSettings={adSettings}
                            compactResponsive={false}
                          />
                        )}
                        {ep.access?.mode === 'inherit' || !ep.access ? (
                          <span className="text-[10px] text-zinc-400">(Inherited)</span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-zinc-500 tabular-nums">
                        {ep.duration}m · {ep.videoSources[0]?.url || 'No stream URL'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccessEp(ep);
                        setEpRuleDraft(
                          ep.access ?? {
                            mode: 'inherit',
                            planId: defaultPlan?.id ?? 'plan-cinema-plus',
                            planName: defaultPlan?.name ?? 'Cinema Plus',
                            adsRequired: 1,
                            adSource: 'any_vast',
                            adIds: [],
                          }
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <KeyRound className="h-3 w-3" />
                      Access
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderEpisode(idx, idx - 1)}
                      aria-label="Move episode up"
                      className="rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderEpisode(idx, idx + 1)}
                      aria-label="Move episode down"
                      className="rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEpisodeDoc(selectedSeriesId, ep.seasonId, ep.id, adminUid);
                        setEpisodes((prev) => prev.filter((x) => x.id !== ep.id));
                        notify('Episode deleted', 'success');
                      }}
                      aria-label="Delete episode"
                      className="rounded p-1 text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / Bulk-Add Episode */}
        <div className="space-y-6">
          <form
            onSubmit={handleAddEpisode}
            className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]"
          >
            <h3 className="font-display text-sm font-semibold">Add Episode</h3>
            <input
              type="text"
              required
              placeholder="Episode title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            <input
              type="number"
              min={1}
              placeholder="Duration (minutes)"
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
            />
            <input
              type="url"
              placeholder="YouTube URL, .mp4, or .m3u8"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            <textarea
              rows={2}
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Episode
            </button>
          </form>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#13131c]">
            <h3 className="font-display text-sm font-semibold">Bulk Import URLs</h3>
            <textarea
              rows={4}
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder="Paste one video URL per line (YouTube, .mp4, or .m3u8)..."
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={handleBulkImport}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Import Episodes
            </button>
          </div>
        </div>
      </div>

      {/* Per-Episode Access Editor Modal */}
      <Modal
        open={Boolean(editingAccessEp)}
        onClose={() => setEditingAccessEp(null)}
        title={
          editingAccessEp
            ? `Episode Access — S${editingAccessEp.seasonNumber}E${editingAccessEp.number}: ${editingAccessEp.title}`
            : 'Episode Access'
        }
        maxWidthClass="max-w-md"
      >
        {editingAccessEp && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Access Policy</label>
              <select
                value={epRuleDraft.mode}
                onChange={(e) => {
                  const m = e.target.value as AccessMode;
                  setEpRuleDraft((prev) => ({
                    ...prev,
                    mode: m,
                    planId:
                      m === 'subscription_only' || m === 'subscription_or_ad'
                        ? prev.planId || defaultPlan?.id || 'plan-cinema-plus'
                        : null,
                    planName:
                      m === 'subscription_only' || m === 'subscription_or_ad'
                        ? prev.planName || defaultPlan?.name || 'Cinema Plus'
                        : null,
                    adUnlockAllowed: m === 'ad_unlock_only' || m === 'subscription_or_ad',
                  }));
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="inherit">Inherit from Season / Series</option>
                <option value="free">Free</option>
                <option value="subscription_or_ad">Subscription OR Watch Ad to Unlock</option>
                <option value="ad_unlock_only">Ad-Unlock Only</option>
                <option value="subscription_only">Subscription Only</option>
              </select>
            </div>

            {(epRuleDraft.mode === 'ad_unlock_only' ||
              epRuleDraft.mode === 'subscription_or_ad') && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Ads Required (1–3)</label>
                  <select
                    value={epRuleDraft.adsRequired ?? 1}
                    onChange={(e) =>
                      setEpRuleDraft((p) => ({ ...p, adsRequired: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} ad{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-500">
                    Rewarded VAST Ad Selection
                  </label>
                  <div className="flex gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={(epRuleDraft.adSource || 'any_vast') === 'any_vast'}
                        onChange={() =>
                          setEpRuleDraft((p) => ({ ...p, adSource: 'any_vast', adIds: [] }))
                        }
                      />
                      Any active VAST
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={epRuleDraft.adSource === 'specific_ad_ids'}
                        onChange={() =>
                          setEpRuleDraft((p) => ({ ...p, adSource: 'specific_ad_ids' }))
                        }
                      />
                      Specific VAST ads
                    </label>
                  </div>

                  {epRuleDraft.adSource === 'specific_ad_ids' && (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      {playableVastAds.map((ad) => {
                        const checked = (epRuleDraft.adIds || []).includes(ad.id);
                        return (
                          <label key={ad.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const prevIds = epRuleDraft.adIds || [];
                                setEpRuleDraft((p) => ({
                                  ...p,
                                  adIds: e.target.checked
                                    ? [...prevIds, ad.id]
                                    : prevIds.filter((id) => id !== ad.id),
                                }));
                              }}
                            />
                            <span className="truncate">{ad.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAccessEp(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const updated: EpisodeItem = { ...editingAccessEp, access: epRuleDraft };
                  await saveEpisodeDoc(updated, adminUid);
                  setEpisodes((prev) =>
                    prev.map((x) => (x.id === updated.id ? updated : x))
                  );
                  setEditingAccessEp(null);
                  notify(`Saved access policy for S${updated.seasonNumber}E${updated.number}`, 'success');
                }}
                className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d28d9]"
              >
                Save Access Rule
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
