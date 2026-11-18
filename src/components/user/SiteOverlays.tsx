import React, { useEffect, useState } from 'react';
import { Cookie, Download, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import type {
  AdPlacementConfig,
  CookieConsentSettings,
  PopupSettings,
} from '../../types/streaming';
import { isWithinSchedule, sanitizeHtml } from '../../utils/customization';

const POPUP_STORAGE_KEY = 'kv_popup_seen_at';
const COOKIE_STORAGE_KEY = 'kv_cookie_accepted';

export const AdSlot: React.FC<{ config?: AdPlacementConfig; label?: string }> = ({
  config,
  label,
}) => {
  if (!config || !config.enabled || !config.snippet.trim()) return null;
  const clean = sanitizeHtml(config.snippet);
  if (!clean.trim()) return null;
  return (
    <div
      className="mx-auto my-4 max-w-7xl px-4 sm:px-6"
      aria-label={label || 'Sponsored section'}
    >
      <div
        className="kv-themed-surface kv-card-radius border p-3 text-center text-xs"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </div>
  );
};

export const SitePopupOverlay: React.FC<{
  popup?: PopupSettings;
  onNavigateHref: (href: string) => void;
}> = ({ popup, onNavigateHref }) => {
  const { canInstall, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!popup || !popup.enabled) {
      setVisible(false);
      return;
    }
    if (!isWithinSchedule(popup.startAt, popup.endAt)) {
      setVisible(false);
      return;
    }

    try {
      if (popup.frequency === 'session') {
        if (sessionStorage.getItem(POPUP_STORAGE_KEY)) return;
      } else {
        const raw = localStorage.getItem(POPUP_STORAGE_KEY);
        if (raw) {
          if (popup.frequency === 'once') return;
          if (popup.frequency === 'daily' && Date.now() - Number(raw) < 24 * 60 * 60 * 1000) {
            return;
          }
        }
      }
    } catch {
      // Ignore storage access restrictions
    }

    const timer = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!popup || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      if (popup.frequency === 'session') {
        sessionStorage.setItem(POPUP_STORAGE_KEY, String(Date.now()));
      } else {
        localStorage.setItem(POPUP_STORAGE_KEY, String(Date.now()));
      }
    } catch {}
  };

  const handleAction = async () => {
    if (popup.type === 'app-install' && canInstall) {
      await promptInstall();
      dismiss();
      return;
    }
    dismiss();
    if (popup.buttonHref) onNavigateHref(popup.buttonHref);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={popup.title}
    >
      <div className="kv-themed-surface kv-modal-radius relative w-full max-w-md overflow-hidden border shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close popup"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.imageUrl && (
          <div className="aspect-video w-full overflow-hidden bg-zinc-900">
            <img
              src={popup.imageUrl}
              alt={popup.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="space-y-3 p-6">
          <h2 className="font-display text-xl font-bold">{popup.title}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{popup.text}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleAction}
              className="kv-primary-btn inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              {popup.type === 'app-install' && <Download className="h-4 w-4" />}
              {popup.buttonLabel || 'Continue'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CookieConsentBar: React.FC<{
  cookie?: CookieConsentSettings;
  onNavigateHref: (href: string) => void;
}> = ({ cookie, onNavigateHref }) => {
  const [accepted, setAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COOKIE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!cookie || !cookie.enabled || accepted) return null;

  const accept = () => {
    setAccepted(true);
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, '1');
    } catch {}
  };

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 mx-auto max-w-3xl md:bottom-5">
      <div className="kv-themed-surface kv-card-radius flex flex-col justify-between gap-3 border p-4 shadow-2xl sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5 text-xs leading-relaxed">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kv-accent,#e50914)]" />
          <p>
            {cookie.text}{' '}
            {cookie.linkHref && (
              <button
                type="button"
                onClick={() => onNavigateHref(cookie.linkHref)}
                className="font-semibold underline hover:text-[var(--kv-accent,#e50914)]"
              >
                {cookie.linkLabel || 'Learn more'}
              </button>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={accept}
          className="kv-primary-btn shrink-0 px-4 py-2 text-xs font-semibold"
        >
          Accept
        </button>
      </div>
    </div>
  );
};
