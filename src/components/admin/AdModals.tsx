import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Layers,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type {
  AdAudience,
  AdDevice,
  AdPlacementType,
  AdTargetContentType,
  CustomAdItem,
  EpisodeItem,
  MovieItem,
  VastAdItem,
  VastAdType,
} from '../../types/streaming';
import {
  isValidAdRedirectUrl,
  parseVastXmlSummary,
  type ParsedVastResult,
  validateAdImageFile,
  validateCustomAdDraft,
  validateVastAdDraft,
} from '../../utils/adEngine';
import { uploadFileWithProgress } from '../../lib/firebase';
import { Modal } from '../ui/Modal';

export interface EpisodeOption {
  id: string;
  label: string;
  seriesId: string;
}

function getPlacementDimensions(p: AdPlacementType): {
  title: string;
  sizeHint: string;
  desc: string;
  aspectClass: string;
} {
  switch (p) {
    case 'home':
      return {
        title: 'Home Page',
        sizeHint: '1200 x 300px (4:1) · Mobile 720 x 240px',
        desc: 'Appears between home catalog rows (after row 2 & row 5). Global reach.',
        aspectClass: 'aspect-[4/1]',
      };
    case 'banner':
      return {
        title: 'Banner',
        sizeHint: '970 x 250px or 728 x 90px',
        desc: 'Appears below Hero Spotlight, top of Browse, and on Title Details.',
        aspectClass: 'aspect-[4/1]',
      };
    case 'player':
      return {
        title: 'Video Player',
        sizeHint: '640 x 360px or 728 x 90px',
        desc: 'Appears as dismissible pause-screen overlay or below player bar.',
        aspectClass: 'aspect-[16/5]',
      };
  }
}

interface TargetMultiSelectProps {
  label: string;
  options: { id: string; label: string; sub?: string }[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}

const TargetMultiSelect: React.FC<TargetMultiSelectProps> = ({
  label,
  options,
  selectedIds,
  onChange,
}) => {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sub && o.sub.toLowerCase().includes(q))
    );
  }, [options, query]);

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold">
          {label} ({selectedIds.length === 0 ? 'All Selected by Default' : `${selectedIds.length} chosen`})
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onChange(options.map((o) => o.id))}
            className="font-medium text-[var(--kv-accent,#e50914)] hover:underline"
          >
            Select All
          </button>
          <span className="text-zinc-400">·</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="font-medium text-zinc-500 hover:underline"
          >
            Clear (Target All)
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles or episodes..."
          className="w-full rounded-md border border-zinc-300 bg-transparent py-1.5 pl-8 pr-3 text-xs dark:border-zinc-700"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.slice(0, 6).map((id) => {
            const match = options.find((o) => o.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(selectedIds.filter((x) => x !== id))}
                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium dark:bg-zinc-800"
              >
                <span className="max-w-[140px] truncate">{match?.label || id}</span>
                <X className="h-3 w-3 text-zinc-400" />
              </button>
            );
          })}
          {selectedIds.length > 6 && (
            <span className="px-1.5 py-0.5 text-[11px] text-zinc-500">
              +{selectedIds.length - 6} more
            </span>
          )}
        </div>
      )}

      <div className="max-h-36 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-zinc-500">No matching items.</p>
        ) : (
          filtered.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center justify-between gap-2 py-1.5 px-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedSet.has(opt.id)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selectedIds, opt.id]);
                    else onChange(selectedIds.filter((x) => x !== opt.id));
                  }}
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                <span className="truncate font-medium">{opt.label}</span>
              </span>
              {opt.sub && <span className="shrink-0 text-[10px] text-zinc-400">{opt.sub}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
};

// =========================================================================
// CUSTOM IMAGE AD CREATE / EDIT MODAL
// =========================================================================

interface CustomAdFormModalProps {
  open: boolean;
  initialAd: CustomAdItem | null;
  movies: MovieItem[];
  episodes: EpisodeOption[];
  adminUid: string;
  onClose: () => void;
  onSave: (ad: CustomAdItem, isNew: boolean) => Promise<void>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ALL_DEVICES: AdDevice[] = ['desktop', 'mobile', 'tablet'];

export const CustomAdFormModal: React.FC<CustomAdFormModalProps> = ({
  open,
  initialAd,
  movies,
  episodes,
  adminUid,
  onClose,
  onSave,
  onNotify,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [placement, setPlacement] = useState<AdPlacementType>('home');
  const [imageUrl, setImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('https://');
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [targetContentType, setTargetContentType] = useState<AdTargetContentType>('all');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextMonth);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [priority, setPriority] = useState(5);
  const [weight, setWeight] = useState(50);
  const [dailyImpressionCap, setDailyImpressionCap] = useState(0);
  const [devices, setDevices] = useState<AdDevice[]>(ALL_DEVICES);
  const [audience, setAudience] = useState<AdAudience>('all');

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [mobileUploadPct, setMobileUploadPct] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialAd) {
      setName(initialAd.name);
      setPlacement(initialAd.placement);
      setImageUrl(initialAd.imageUrl);
      setMobileImageUrl(initialAd.mobileImageUrl || '');
      setAltText(initialAd.altText || '');
      setRedirectUrl(initialAd.redirectUrl);
      setOpenInNewTab(initialAd.openInNewTab);
      setTargetContentType(initialAd.targetContentType);
      setTargetIds(initialAd.targetIds || []);
      setStartDate(initialAd.startDate.slice(0, 10));
      setEndDate(initialAd.endDate.slice(0, 10));
      setStatus(initialAd.status);
      setPriority(initialAd.priority);
      setWeight(initialAd.weight);
      setDailyImpressionCap(initialAd.dailyImpressionCap);
      setDevices(initialAd.devices?.length ? initialAd.devices : ALL_DEVICES);
      setAudience(initialAd.audience || 'all');
    } else {
      setName('');
      setPlacement('home');
      setImageUrl('');
      setMobileImageUrl('');
      setAltText('');
      setRedirectUrl('https://');
      setOpenInNewTab(true);
      setTargetContentType('all');
      setTargetIds([]);
      setStartDate(today);
      setEndDate(nextMonth);
      setStatus('active');
      setPriority(5);
      setWeight(50);
      setDailyImpressionCap(0);
      setDevices(ALL_DEVICES);
      setAudience('all');
    }
    setErrors({});
  }, [open, initialAd, today, nextMonth]);

  const placementInfo = getPlacementDimensions(placement);

  const targetOptions = useMemo(() => {
    if (targetContentType === 'tvshow') {
      const seriesMovies = movies
        .filter((m) => m.type === 'series')
        .map((m) => ({ id: m.id, label: m.title, sub: `Series · ${m.releaseYear}` }));
      const epOpts = episodes.map((e) => ({
        id: e.id,
        label: e.label,
        sub: 'Episode',
      }));
      return [...seriesMovies, ...epOpts];
    }
    if (targetContentType === 'movie' || targetContentType === 'video') {
      return movies
        .filter((m) => m.type === 'movie')
        .map((m) => ({ id: m.id, label: m.title, sub: `Movie · ${m.releaseYear}` }));
    }
    return movies.map((m) => ({
      id: m.id,
      label: m.title,
      sub: `${m.type === 'series' ? 'Series' : 'Movie'} · ${m.releaseYear}`,
    }));
  }, [movies, episodes, targetContentType]);

  const handleImageUpload = async (file: File, isMobile: boolean) => {
    const check = validateAdImageFile(file);
    if (!check.valid) {
      onNotify(check.error || 'Invalid ad image.', 'error');
      return;
    }
    try {
      const path = `ads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const url = await uploadFileWithProgress(path, file, (pct) => {
        if (isMobile) setMobileUploadPct(pct);
        else setUploadPct(pct);
      });
      if (isMobile) setMobileImageUrl(url);
      else setImageUrl(url);
      onNotify('Ad image uploaded to Firebase Storage', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      if (isMobile) setMobileUploadPct(null);
      else setUploadPct(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const nextAd: CustomAdItem = {
      id: initialAd?.id || `cad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      type: 'image',
      placement,
      imageUrl: imageUrl.trim(),
      mobileImageUrl: mobileImageUrl.trim(),
      altText: altText.trim() || name.trim(),
      redirectUrl: redirectUrl.trim(),
      openInNewTab,
      targetContentType: placement === 'home' ? 'all' : targetContentType,
      targetIds: placement === 'home' ? [] : targetIds,
      startDate,
      endDate,
      status,
      priority: Number(priority),
      weight: Number(weight),
      dailyImpressionCap: Math.max(0, Number(dailyImpressionCap) || 0),
      devices: devices.length > 0 ? devices : ALL_DEVICES,
      audience,
      impressions: initialAd?.impressions ?? 0,
      clicks: initialAd?.clicks ?? 0,
      createdAt: initialAd?.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: initialAd?.createdBy || adminUid,
    };

    const nextErrors = validateCustomAdDraft(nextAd);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave(nextAd, !initialAd);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialAd ? `Edit Custom Ad — ${initialAd.name}` : 'Add Custom Image Ad'}
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Placement Radio Cards */}
        <div>
          <span className="mb-2 block text-xs font-semibold">Placement Slot</span>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {(['home', 'banner', 'player'] as AdPlacementType[]).map((p) => {
              const meta = getPlacementDimensions(p);
              const active = placement === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlacement(p)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)]/10'
                      : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{meta.title}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        active ? 'bg-[var(--kv-accent,#e50914)]' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-medium text-zinc-500">{meta.sizeHint}</p>
                  <p className="mt-1 text-[10px] text-zinc-400 leading-snug">{meta.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name + Status */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="cad-name" className="mb-1 block text-xs font-medium text-zinc-500">
              Campaign / Ad Name *
            </label>
            <input
              id="cad-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Festival Promo"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            {errors.name && <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="cad-status" className="mb-1 block text-xs font-medium text-zinc-500">
              Status
            </label>
            <select
              id="cad-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Image Upload + Live Mockup Preview */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="cad-img-url" className="block text-xs font-medium text-zinc-500">
              Desktop Creative Image URL * (max 1 MB · JPG/PNG/WebP/GIF)
            </label>
            <div className="flex gap-2">
              <input
                id="cad-img-url"
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... or upload"
                className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                <Upload className="h-3.5 w-3.5" />
                {uploadPct !== null ? `${uploadPct}%` : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f, false);
                  }}
                />
              </label>
            </div>
            {errors.imageUrl && <p className="text-[11px] text-rose-500">{errors.imageUrl}</p>}

            <label htmlFor="cad-mob-url" className="block pt-1 text-xs font-medium text-zinc-500">
              Optional Mobile Image URL (720 x 240px)
            </label>
            <div className="flex gap-2">
              <input
                id="cad-mob-url"
                type="text"
                value={mobileImageUrl}
                onChange={(e) => setMobileImageUrl(e.target.value)}
                placeholder="Optional mobile banner URL"
                className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                <Upload className="h-3.5 w-3.5" />
                {mobileUploadPct !== null ? `${mobileUploadPct}%` : 'Mobile'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f, true);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Live Placement Mockup ({placementInfo.title})</span>
              <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Ad
              </span>
            </div>
            <div className={`overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 dark:border-zinc-800 ${placementInfo.aspectClass}`}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={altText || name || 'Ad preview'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-zinc-500">
                  <ImageIcon className="h-6 w-6 opacity-50" />
                  <span className="mt-1 text-[10px]">{placementInfo.sizeHint}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Destination & Alt Text */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cad-redirect" className="mb-1 block text-xs font-medium text-zinc-500">
              Redirect URL * (https:// required)
            </label>
            <input
              id="cad-redirect"
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://advertiser.com/offer"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            {errors.redirectUrl && (
              <p className="mt-1 text-[11px] text-rose-500">{errors.redirectUrl}</p>
            )}
          </div>
          <div>
            <label htmlFor="cad-alt" className="mb-1 block text-xs font-medium text-zinc-500">
              Alt Text (Accessibility)
            </label>
            <input
              id="cad-alt"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Short description of sponsored banner"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
          </div>
        </div>

        {/* Conditional Content Targeting — hidden when placement === 'home' */}
        {placement !== 'home' ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cad-ctype" className="mb-1 block text-xs font-medium text-zinc-500">
                  Target Content Type
                </label>
                <select
                  id="cad-ctype"
                  value={targetContentType}
                  onChange={(e) => {
                    setTargetContentType(e.target.value as AdTargetContentType);
                    setTargetIds([]);
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="all">All Content Types</option>
                  <option value="movie">Movies</option>
                  <option value="video">Videos</option>
                  <option value="tvshow">TV Shows / Series &amp; Episodes</option>
                </select>
              </div>
              <div>
                <label htmlFor="cad-aud" className="mb-1 block text-xs font-medium text-zinc-500">
                  Audience Segment
                </label>
                <select
                  id="cad-aud"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as AdAudience)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="all">All Viewers</option>
                  <option value="free">Free Users Only</option>
                  <option value="guest">Guests Only</option>
                  <option value="premium">Premium Subscribers</option>
                </select>
              </div>
            </div>

            <TargetMultiSelect
              label="Target Titles &amp; Episodes"
              options={targetOptions}
              selectedIds={targetIds}
              onChange={setTargetIds}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              Home Page ads appear globally across the home feed between catalog rows.
            </div>
            <div>
              <label htmlFor="cad-aud-h" className="mb-1 block text-xs font-medium text-zinc-500">
                Audience Segment
              </label>
              <select
                id="cad-aud-h"
                value={audience}
                onChange={(e) => setAudience(e.target.value as AdAudience)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="all">All Viewers</option>
                <option value="free">Free Users Only</option>
                <option value="guest">Guests Only</option>
                <option value="premium">Premium Subscribers</option>
              </select>
            </div>
          </div>
        )}

        {/* Schedule, Priority, Weight, Cap */}
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <label htmlFor="cad-start" className="mb-1 block text-xs font-medium text-zinc-500">
              Start Date
            </label>
            <input
              id="cad-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 text-xs dark:border-zinc-700"
            />
            {errors.startDate && <p className="mt-1 text-[11px] text-rose-500">{errors.startDate}</p>}
          </div>
          <div>
            <label htmlFor="cad-end" className="mb-1 block text-xs font-medium text-zinc-500">
              End Date
            </label>
            <input
              id="cad-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 text-xs dark:border-zinc-700"
            />
            {errors.endDate && <p className="mt-1 text-[11px] text-rose-500">{errors.endDate}</p>}
          </div>
          <div>
            <label htmlFor="cad-prio" className="mb-1 block text-xs font-medium text-zinc-500">
              Priority (1–10)
            </label>
            <input
              id="cad-prio"
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 text-xs dark:border-zinc-700"
            />
          </div>
          <div>
            <label htmlFor="cad-weight" className="mb-1 block text-xs font-medium text-zinc-500">
              Weight (1–100)
            </label>
            <input
              id="cad-weight"
              type="number"
              min={1}
              max={100}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 text-xs dark:border-zinc-700"
            />
          </div>
          <div>
            <label htmlFor="cad-cap" className="mb-1 block text-xs font-medium text-zinc-500">
              Daily Cap (0=unlim)
            </label>
            <input
              id="cad-cap"
              type="number"
              min={0}
              value={dailyImpressionCap}
              onChange={(e) => setDailyImpressionCap(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 text-xs dark:border-zinc-700"
            />
          </div>
        </div>

        {/* Devices & Link Target */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-medium text-zinc-500">Devices:</span>
            {ALL_DEVICES.map((dev) => (
              <label key={dev} className="inline-flex cursor-pointer items-center gap-1.5 capitalize">
                <input
                  type="checkbox"
                  checked={devices.includes(dev)}
                  onChange={(e) => {
                    if (e.target.checked) setDevices([...devices, dev]);
                    else setDevices(devices.filter((d) => d !== dev));
                  }}
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                {dev}
              </label>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
              className="accent-[var(--kv-accent,#e50914)]"
            />
            Open destination in new tab
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--kv-accent,#e50914)] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : initialAd ? 'Update Custom Ad' : 'Create Custom Ad'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// =========================================================================
// VAST VIDEO AD CREATE / EDIT MODAL + VALIDATE & TEST PREVIEW
// =========================================================================

interface VastAdFormModalProps {
  open: boolean;
  initialAd: VastAdItem | null;
  movies: MovieItem[];
  episodes: EpisodeOption[];
  adminUid: string;
  onClose: () => void;
  onSave: (ad: VastAdItem, isNew: boolean) => Promise<void>;
}

export const VastAdFormModal: React.FC<VastAdFormModalProps> = ({
  open,
  initialAd,
  movies,
  episodes,
  adminUid,
  onClose,
  onSave,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [type, setType] = useState<VastAdType>('pre-roll');
  const [vastTagUrl, setVastTagUrl] = useState('');
  const [targetType, setTargetType] = useState<'movie' | 'video' | 'tvshow'>('movie');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [midRollInput, setMidRollInput] = useState('300, 900');
  const [overlayStartSeconds, setOverlayStartSeconds] = useState(12);
  const [overlayDurationSeconds, setOverlayDurationSeconds] = useState(15);
  const [skipAfterSeconds, setSkipAfterSeconds] = useState(5);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextMonth);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [priority, setPriority] = useState(5);
  const [audience, setAudience] = useState<AdAudience>('free');
  const [devices, setDevices] = useState<AdDevice[]>(ALL_DEVICES);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ParsedVastResult | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialAd) {
      setName(initialAd.name);
      setType(initialAd.type);
      setVastTagUrl(initialAd.vastTagUrl);
      setTargetType(initialAd.targetType);
      setTargetIds(initialAd.targetIds || []);
      setMidRollInput(
        initialAd.midRollAtSeconds?.length ? initialAd.midRollAtSeconds.join(', ') : '300, 900'
      );
      setOverlayStartSeconds(initialAd.overlayStartSeconds ?? 12);
      setOverlayDurationSeconds(initialAd.overlayDurationSeconds ?? 15);
      setSkipAfterSeconds(initialAd.skipAfterSeconds ?? 5);
      setStartDate(initialAd.startDate.slice(0, 10));
      setEndDate(initialAd.endDate.slice(0, 10));
      setStatus(initialAd.status);
      setPriority(initialAd.priority);
      setAudience(initialAd.audience || 'free');
      setDevices(initialAd.devices?.length ? initialAd.devices : ALL_DEVICES);
    } else {
      setName('');
      setType('pre-roll');
      setVastTagUrl('');
      setTargetType('movie');
      setTargetIds([]);
      setMidRollInput('300, 900');
      setOverlayStartSeconds(12);
      setOverlayDurationSeconds(15);
      setSkipAfterSeconds(5);
      setStartDate(today);
      setEndDate(nextMonth);
      setStatus('active');
      setPriority(5);
      setAudience('free');
      setDevices(ALL_DEVICES);
    }
    setValidationResult(null);
    setValidationNotice(null);
    setErrors({});
  }, [open, initialAd, today, nextMonth]);

  const targetOptions = useMemo(() => {
    if (targetType === 'tvshow') {
      const seriesMovies = movies
        .filter((m) => m.type === 'series')
        .map((m) => ({ id: m.id, label: m.title, sub: `Series · ${m.releaseYear}` }));
      const epOpts = episodes.map((e) => ({ id: e.id, label: e.label, sub: 'Episode' }));
      return [...seriesMovies, ...epOpts];
    }
    return movies
      .filter((m) => m.type === 'movie')
      .map((m) => ({ id: m.id, label: m.title, sub: `Movie · ${m.releaseYear}` }));
  }, [movies, episodes, targetType]);

  const handleValidateTag = async () => {
    setValidationResult(null);
    setValidationNotice(null);
    const trimmed = vastTagUrl.trim();
    if (!trimmed) {
      setErrors((e) => ({ ...e, vastTagUrl: 'Enter a VAST tag URL first.' }));
      return;
    }
    setValidating(true);
    try {
      const res = await fetch(trimmed);
      if (!res.ok) {
        setValidationResult({
          valid: false,
          error: `Server responded with HTTP ${res.status}.`,
        });
        return;
      }
      const xmlText = await res.text();
      setValidationResult(parseVastXmlSummary(xmlText));
    } catch {
      setValidationNotice(
        'Direct browser fetch blocked by the ad server’s CORS headers — this is normal for third-party ad networks. The Google IMA SDK will still fetch and play the tag inside the video player at runtime.'
      );
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCues = midRollInput
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const nowIso = new Date().toISOString();

    const nextAd: VastAdItem = {
      id: initialAd?.id || `vad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      type,
      vastTagUrl: vastTagUrl.trim(),
      targetType,
      targetIds,
      midRollAtSeconds: type === 'mid-roll' ? parsedCues : [],
      overlayStartSeconds: Number(overlayStartSeconds) || 12,
      overlayDurationSeconds: Math.max(3, Number(overlayDurationSeconds) || 15),
      skipAfterSeconds: Number(skipAfterSeconds),
      startDate,
      endDate,
      status,
      priority: Number(priority),
      audience,
      devices: devices.length > 0 ? devices : ALL_DEVICES,
      impressions: initialAd?.impressions ?? 0,
      completions: initialAd?.completions ?? 0,
      skips: initialAd?.skips ?? 0,
      clicks: initialAd?.clicks ?? 0,
      errors: initialAd?.errors ?? 0,
      createdAt: initialAd?.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: initialAd?.createdBy || adminUid,
    };

    const nextErrors = validateVastAdDraft(nextAd);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave(nextAd, !initialAd);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialAd ? `Edit VAST Ad — ${initialAd.name}` : 'Add VAST Video / Overlay Ad'}
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name, Type, Status */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="vad-name" className="mb-1 block text-xs font-medium text-zinc-500">
              VAST Campaign Name *
            </label>
            <input
              id="vad-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BigSale Pre-Roll"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            {errors.name && <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="vad-type" className="mb-1 block text-xs font-medium text-zinc-500">
              Ad Format / Slot
            </label>
            <select
              id="vad-type"
              value={type}
              onChange={(e) => setType(e.target.value as VastAdType)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="pre-roll">Pre-Roll (before video)</option>
              <option value="mid-roll">Mid-Roll (cue timestamps)</option>
              <option value="post-roll">Post-Roll (after video)</option>
              <option value="overlay">Overlay (non-linear bar)</option>
            </select>
          </div>

          <div>
            <label htmlFor="vad-status" className="mb-1 block text-xs font-medium text-zinc-500">
              Status
            </label>
            <select
              id="vad-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* VAST Tag URL + Validate button */}
        <div>
          <label htmlFor="vad-tag" className="mb-1 block text-xs font-medium text-zinc-500">
            VAST 2.0 / 3.0 / 4.0 XML Tag URL *
          </label>
          <div className="flex gap-2">
            <input
              id="vad-tag"
              type="url"
              value={vastTagUrl}
              onChange={(e) => setVastTagUrl(e.target.value)}
              placeholder="https://pubads.g.doubleclick.net/gampad/ads?..."
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-700"
            />
            <button
              type="button"
              disabled={validating}
              onClick={handleValidateTag}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {validating ? 'Validating...' : 'Validate Tag'}
            </button>
          </div>
          {errors.vastTagUrl && <p className="mt-1 text-[11px] text-rose-500">{errors.vastTagUrl}</p>}

          {validationResult && (
            <div
              className={`mt-2 rounded-lg border p-2.5 text-xs ${
                validationResult.valid
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {validationResult.valid ? (
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valid VAST ({validationResult.kind})
                    {validationResult.title ? ` — ${validationResult.title}` : ''}
                    {validationResult.durationSec ? ` (${validationResult.durationSec}s)` : ''}
                  </p>
                  {validationResult.mediaFileUrl && (
                    <p className="truncate font-mono text-[10px]">
                      MediaFile: {validationResult.mediaFileUrl}
                    </p>
                  )}
                  {validationResult.wrapperTagUrl && (
                    <p className="truncate font-mono text-[10px]">
                      Wrapper: {validationResult.wrapperTagUrl}
                    </p>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {validationResult.error}
                </p>
              )}
            </div>
          )}

          {validationNotice && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
              {validationNotice}
            </p>
          )}
        </div>

        {/* Conditional Timing Fields */}
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3">
          {type === 'mid-roll' && (
            <div className="sm:col-span-2">
              <label htmlFor="vad-midroll" className="mb-1 block text-xs font-medium text-zinc-500">
                Mid-Roll Cue Times (seconds, comma separated) *
              </label>
              <input
                id="vad-midroll"
                type="text"
                value={midRollInput}
                onChange={(e) => setMidRollInput(e.target.value)}
                placeholder="300, 900, 1800"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
              {errors.midRollAtSeconds && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.midRollAtSeconds}</p>
              )}
            </div>
          )}

          {type === 'overlay' && (
            <>
              <div>
                <label htmlFor="vad-ov-start" className="mb-1 block text-xs font-medium text-zinc-500">
                  Show Overlay After (sec)
                </label>
                <input
                  id="vad-ov-start"
                  type="number"
                  min={0}
                  value={overlayStartSeconds}
                  onChange={(e) => setOverlayStartSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label htmlFor="vad-ov-dur" className="mb-1 block text-xs font-medium text-zinc-500">
                  Overlay Duration (sec)
                </label>
                <input
                  id="vad-ov-dur"
                  type="number"
                  min={3}
                  max={60}
                  value={overlayDurationSeconds}
                  onChange={(e) => setOverlayDurationSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="vad-skip" className="mb-1 block text-xs font-medium text-zinc-500">
              Skip After (0 or 5–15s)
            </label>
            <input
              id="vad-skip"
              type="number"
              min={0}
              max={15}
              value={skipAfterSeconds}
              onChange={(e) => setSkipAfterSeconds(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
            {errors.skipAfterSeconds && (
              <p className="mt-1 text-[11px] text-rose-500">{errors.skipAfterSeconds}</p>
            )}
          </div>
        </div>

        {/* Target Selection */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vad-ttype" className="mb-1 block text-xs font-medium text-zinc-500">
              Target Content Type
            </label>
            <select
              id="vad-ttype"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as 'movie' | 'video' | 'tvshow');
                setTargetIds([]);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="movie">Movies</option>
              <option value="video">Videos</option>
              <option value="tvshow">TV Shows / Episodes</option>
            </select>
          </div>
          <div>
            <label htmlFor="vad-aud" className="mb-1 block text-xs font-medium text-zinc-500">
              Audience
            </label>
            <select
              id="vad-aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AdAudience)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="free">Free Users &amp; Guests</option>
              <option value="all">All Viewers</option>
              <option value="guest">Guests Only</option>
              <option value="premium">Premium Subscribers</option>
            </select>
          </div>
        </div>

        <TargetMultiSelect
          label={`Target ${targetType === 'tvshow' ? 'TV Shows & Episodes' : 'Titles'}`}
          options={targetOptions}
          selectedIds={targetIds}
          onChange={setTargetIds}
        />

        {/* Dates & Priority */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="vad-start" className="mb-1 block text-xs font-medium text-zinc-500">
              Start Date
            </label>
            <input
              id="vad-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
          </div>
          <div>
            <label htmlFor="vad-end" className="mb-1 block text-xs font-medium text-zinc-500">
              End Date
            </label>
            <input
              id="vad-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            {errors.endDate && <p className="mt-1 text-[11px] text-rose-500">{errors.endDate}</p>}
          </div>
          <div>
            <label htmlFor="vad-prio" className="mb-1 block text-xs font-medium text-zinc-500">
              Priority (1–10)
            </label>
            <input
              id="vad-prio"
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
          </div>
        </div>

        {/* Devices */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-zinc-500">Devices:</span>
          {ALL_DEVICES.map((dev) => (
            <label key={dev} className="inline-flex cursor-pointer items-center gap-1.5 capitalize">
              <input
                type="checkbox"
                checked={devices.includes(dev)}
                onChange={(e) => {
                  if (e.target.checked) setDevices([...devices, dev]);
                  else setDevices(devices.filter((d) => d !== dev));
                }}
                className="accent-[var(--kv-accent,#e50914)]"
              />
              {dev}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--kv-accent,#e50914)] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : initialAd ? 'Update VAST Ad' : 'Create VAST Ad'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// =========================================================================
// VAST "TEST THIS AD" NON-COUNTING PREVIEW MODAL
// =========================================================================

export const VastTestPreviewModal: React.FC<{
  ad: VastAdItem | null;
  onClose: () => void;
}> = ({ ad, onClose }) => {
  const [parsed, setParsed] = useState<ParsedVastResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ad) return;
    let active = true;
    setLoading(true);
    setParsed(null);
    fetch(ad.vastTagUrl)
      .then((r) => r.text())
      .then((xml) => {
        if (active) setParsed(parseVastXmlSummary(xml));
      })
      .catch(() => {
        if (active)
          setParsed({
            valid: false,
            error:
              'CORS blocked direct XML inspect; live playback on the User Portal uses the Google IMA SDK runtime.',
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ad]);

  return (
    <Modal
      open={Boolean(ad)}
      onClose={onClose}
      title={ad ? `Test Ad Preview — ${ad.name} (${ad.type})` : 'Test Ad'}
      maxWidthClass="max-w-2xl"
    >
      {ad && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Non-counting sandbox preview: impressions, clicks, and completions are paused in this test modal.
          </div>

          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                Inspecting VAST tag...
              </div>
            ) : parsed?.mediaFileUrl ? (
              <video
                src={parsed.mediaFileUrl}
                controls
                autoPlay
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
                <Film className="h-8 w-8 text-[var(--kv-accent,#e50914)]" />
                <p className="mt-2 font-display text-sm font-semibold">{ad.name}</p>
                <p className="mt-1 max-w-md text-xs text-zinc-400">
                  {parsed?.error || 'Preview slate for VAST tag'}
                </p>
                <a
                  href={ad.vastTagUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded-md border border-white/25 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  Open VAST Tag URL
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <span className="absolute left-3 top-3 rounded bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
              Ad · Skip after {ad.skipAfterSeconds === 0 ? 'None' : `${ad.skipAfterSeconds}s`}
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold dark:border-zinc-700"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
