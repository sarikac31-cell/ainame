import React, { useState } from 'react';
import { Camera, Crown, History, KeyRound, Trash2, UserCheck } from 'lucide-react';
import type { MovieItem, UserProfile, WatchHistoryItem } from '../../types/streaming';
import { formatRelativeTime, formatTimecode, sanitizeText } from '../../utils/catalog';
import { ConfirmDialog } from '../ui/Modal';

interface ProfileViewProps {
  user: UserProfile | null;
  history: WatchHistoryItem[];
  moviesMap: Record<string, MovieItem>;
  onOpenAuth: () => void;
  onUpdateProfile: (displayName: string, photoURL: string) => Promise<void>;
  onUploadAvatar: (file: File, onProgress: (pct: number) => void) => Promise<string>;
  onChangePassword: (newPassword: string) => Promise<void>;
  onRemoveHistoryItem: (movieId: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onPlayMovie: (movie: MovieItem) => void;
  onManagePlans: () => void;
}

export function ProfileView({
  user,
  history,
  moviesMap,
  onOpenAuth,
  onUpdateProfile,
  onUploadAvatar,
  onChangePassword,
  onRemoveHistoryItem,
  onClearHistory,
  onDeleteAccount,
  onPlayMovie,
  onManagePlans,
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? '');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 dark:border-zinc-800 dark:bg-[#13131c]">
          <UserCheck className="mx-auto h-10 w-10 text-zinc-400" />
          <h1 className="mt-4 font-display text-2xl font-bold">Sign in to view your profile</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Sync your watchlist, playback progress, ratings, and preferences across devices.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 rounded-lg bg-[var(--kv-accent,#e50914)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(0);
    try {
      const url = await onUploadAvatar(file, (pct) => setUploadPct(pct));
      setPhotoURL(url);
      await onUpdateProfile(sanitizeText(displayName, 100) || user.displayName, url);
    } finally {
      setUploadPct(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeText(displayName, 100);
    if (!clean) return;
    setSaving(true);
    try {
      await onUpdateProfile(clean, photoURL.trim());
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setPwSaving(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Account &amp; Profile</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-[#13131c]">
            <Crown
              className={`h-4 w-4 ${
                user.plan === 'premium' ? 'text-amber-400' : 'text-zinc-400'
              }`}
            />
            <span className="font-semibold">
              {user.plan === 'premium'
                ? user.subscriptionPlanName || 'Premium Plan'
                : 'Free Tier'}
            </span>
            {user.planExpiresAt && (
              <span className="text-xs text-zinc-500 tabular-nums">
                · Expires {user.planExpiresAt.slice(0, 10)}
              </span>
            )}
            <button
              type="button"
              onClick={onManagePlans}
              className="ml-2 text-xs font-semibold text-[var(--kv-accent,#e50914)] hover:underline whitespace-nowrap"
            >
              Manage Plans
            </button>
          </div>
          {user.role === 'admin' && (
            <a
              href="/admin.html"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            >
              Open Admin Console
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Profile Form */}
        <section className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#13131c] lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Profile Details</h2>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={user.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-lg font-bold">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                <Camera className="h-3.5 w-3.5" />
                Upload Avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
              {uploadPct !== null && (
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  Uploading: {uploadPct}%
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="prof-name" className="mb-1.5 block text-xs font-medium text-zinc-500">
                Display Name
              </label>
              <input
                id="prof-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3.5 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label htmlFor="prof-photo" className="mb-1.5 block text-xs font-medium text-zinc-500">
                Avatar URL
              </label>
              <input
                id="prof-photo"
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3.5 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--kv-accent,#e50914)] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Security & Account */}
        <section className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#13131c]">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <KeyRound className="h-4 w-4 text-zinc-400" />
            Security
          </h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label htmlFor="new-pw" className="mb-1 block text-xs text-zinc-500">
                New Password
              </label>
              <input
                id="new-pw"
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving || newPassword.length < 6}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Permanently remove your profile and personal watch data.
            </p>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="mt-3 w-full rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
            >
              Delete Account
            </button>
          </div>
        </section>
      </div>

      {/* Watch History */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#13131c]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-4 w-4 text-zinc-400" />
            Watch History ({history.length})
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs font-medium text-rose-500 hover:underline"
            >
              Clear All History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Titles you watch will appear here so you can resume anytime.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {history.map((item) => {
              const m = moviesMap[item.movieId];
              if (!m) return null;
              return (
                <div key={item.movieId} className="flex items-center justify-between gap-4 py-3">
                  <button
                    type="button"
                    onClick={() => onPlayMovie(m)}
                    className="flex items-center gap-3 text-left min-w-0"
                  >
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="h-14 w-10 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold">{m.title}</p>
                      <p className="font-mono-tabular text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTimecode(item.progressSeconds)} / {formatTimecode(item.durationSeconds)} ·{' '}
                        {formatRelativeTime(item.updatedAt)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveHistoryItem(item.movieId)}
                    aria-label={`Remove ${m.title} from watch history`}
                    className="rounded p-1.5 text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Account"
        message="This permanently deletes your KinoVault account and personal watchlist. This action cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        loading={deleting}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await onDeleteAccount();
            setConfirmDeleteOpen(false);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
