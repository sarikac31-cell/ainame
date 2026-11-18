import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdTargetContentType,
  VastAdItem,
} from '../../types/streaming';
import {
  detectCurrentDevice,
  parseVastXmlSummary,
  type ParsedVastResult,
} from '../../utils/adEngine';
import { trackAdEvent } from '../../lib/adsFirebase';

declare global {
  interface Window {
    google?: {
      ima?: {
        AdDisplayContainer: new (container: HTMLElement, videoEl?: HTMLVideoElement) => {
          initialize: () => void;
        };
        AdsLoader: new (container: unknown) => {
          addEventListener: (event: string, cb: (ev: any) => void) => void;
          requestAds: (req: unknown) => void;
          destroy: () => void;
        };
        AdsRequest: new () => {
          adTagUrl: string;
          linearAdSlotWidth: number;
          linearAdSlotHeight: number;
        };
        AdsRenderingSettings: new () => unknown;
        ViewMode: { NORMAL: string };
        AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
        AdErrorEvent: { Type: { AD_ERROR: string } };
        AdEvent: {
          Type: {
            CONTENT_PAUSE_REQUESTED: string;
            CONTENT_RESUME_REQUESTED: string;
            ALL_ADS_COMPLETED: string;
            COMPLETE: string;
            SKIPPED: string;
            CLICK: string;
            IMPRESSION: string;
          };
        };
      };
    };
  }
}

let imaScriptPromise: Promise<boolean> | null = null;

function loadImaSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.ima) return Promise.resolve(true);
  if (imaScriptPromise) return imaScriptPromise;

  imaScriptPromise = new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 3500);
    const script = document.createElement('script');
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve(Boolean(window.google?.ima));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return imaScriptPromise;
}

interface VastPlayerOverlayProps {
  ad: VastAdItem;
  adSettings: AdGlobalSettings;
  userId?: string;
  contentId: string;
  contentType: AdTargetContentType;
  nonSkippable?: boolean;
  adStepIndex?: number;
  adStepTotal?: number;
  onCancelEarly?: () => void;
  onFinish: (outcome: 'complete' | 'skip' | 'error') => void;
}

export const VastPlayerOverlay: React.FC<VastPlayerOverlayProps> = ({
  ad,
  adSettings,
  userId,
  contentId,
  contentType,
  nonSkippable = false,
  adStepIndex = 1,
  adStepTotal = 1,
  onCancelEarly,
  onFinish,
}) => {
  const imaContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishOnceRef = useRef(false);

  const [mode, setMode] = useState<'loading' | 'ima' | 'fallback_video' | 'test_slate'>('loading');
  const modeRef = useRef<'loading' | 'ima' | 'fallback_video' | 'test_slate'>('loading');
  modeRef.current = mode;
  const [parsed, setParsed] = useState<ParsedVastResult | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalSec, setTotalSec] = useState(15);
  const [muted, setMuted] = useState(false);

  const device = detectCurrentDevice();

  const emitFinish = (outcome: 'complete' | 'skip' | 'error') => {
    if (finishOnceRef.current) return;
    finishOnceRef.current = true;
    if (outcome !== 'error' || parsed?.valid) {
      trackAdEvent(
        {
          adId: ad.id,
          adKind: 'vast',
          event: outcome,
          contentId,
          contentType,
          placement: ad.type,
          uid: userId || 'guest',
          device,
        },
        adSettings.testMode
      );
    } else {
      trackAdEvent(
        {
          adId: ad.id,
          adKind: 'vast',
          event: 'error',
          contentId,
          contentType,
          placement: ad.type,
          uid: userId || 'guest',
          device,
        },
        adSettings.testMode
      );
    }
    onFinish(outcome);
  };

  useEffect(() => {
    finishOnceRef.current = false;
    setElapsedSec(0);
    setTotalSec(ad.type === 'overlay' ? ad.overlayDurationSeconds || 15 : 15);

    if (ad.type === 'overlay') {
      trackAdEvent(
        {
          adId: ad.id,
          adKind: 'vast',
          event: 'impression',
          contentId,
          contentType,
          placement: 'overlay',
          uid: userId || 'guest',
          device,
        },
        adSettings.testMode
      );
      fetch(ad.vastTagUrl)
        .then((r) => r.text())
        .then((xml) => setParsed(parseVastXmlSummary(xml)))
        .catch(() => undefined);
      return;
    }

    if (adSettings.testMode) {
      setMode('test_slate');
      setTotalSec(8);
      return;
    }

    let cancelled = false;
    let adsManager: any = null;
    setMode('loading');
    modeRef.current = 'loading';
    const hardTimeout = window.setTimeout(() => {
      if (!cancelled && modeRef.current === 'loading') {
        emitFinish('error');
      }
    }, 8000);

    (async () => {
      const imaReady = await loadImaSdk();
      if (cancelled) return;

      if (imaReady && window.google?.ima && imaContainerRef.current && videoRef.current) {
        try {
          const ima = window.google.ima;
          const displayContainer = new ima.AdDisplayContainer(
            imaContainerRef.current,
            videoRef.current
          );
          displayContainer.initialize();
          const adsLoader = new ima.AdsLoader(displayContainer);
          const req = new ima.AdsRequest();
          req.adTagUrl = ad.vastTagUrl;
          req.linearAdSlotWidth = imaContainerRef.current.clientWidth || 640;
          req.linearAdSlotHeight = imaContainerRef.current.clientHeight || 360;

          adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (ev: any) => {
            if (cancelled) return;
            window.clearTimeout(hardTimeout);
            try {
              adsManager = ev.getAdsManager(videoRef.current, new ima.AdsRenderingSettings());
              adsManager.addEventListener(ima.AdEvent.Type.IMPRESSION, () => {
                trackAdEvent(
                  {
                    adId: ad.id,
                    adKind: 'vast',
                    event: 'impression',
                    contentId,
                    contentType,
                    placement: ad.type,
                    uid: userId || 'guest',
                    device,
                  },
                  adSettings.testMode
                );
              });
              adsManager.addEventListener(ima.AdEvent.Type.CLICK, () => {
                trackAdEvent(
                  {
                    adId: ad.id,
                    adKind: 'vast',
                    event: 'click',
                    contentId,
                    contentType,
                    placement: ad.type,
                    uid: userId || 'guest',
                    device,
                  },
                  adSettings.testMode
                );
              });
              adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
                emitFinish('complete');
              });
              adsManager.addEventListener(ima.AdEvent.Type.SKIPPED, () => {
                emitFinish('skip');
              });
              adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => {
                emitFinish('error');
              });
              setMode('ima');
              adsManager.init(
                imaContainerRef.current?.clientWidth || 640,
                imaContainerRef.current?.clientHeight || 360,
                ima.ViewMode.NORMAL
              );
              adsManager.start();
            } catch {
              emitFinish('error');
            }
          });

          adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, async () => {
            // Try clean XML MediaFile HTML5 fallback before skipping ad gracefully
            try {
              const res = await fetch(ad.vastTagUrl);
              const xml = await res.text();
              const summary = parseVastXmlSummary(xml);
              if (!cancelled && summary.mediaFileUrl) {
                window.clearTimeout(hardTimeout);
                setParsed(summary);
                setTotalSec(summary.durationSec || 15);
                setMode('fallback_video');
                trackAdEvent(
                  {
                    adId: ad.id,
                    adKind: 'vast',
                    event: 'impression',
                    contentId,
                    contentType,
                    placement: ad.type,
                    uid: userId || 'guest',
                    device,
                  },
                  adSettings.testMode
                );
                return;
              }
            } catch {
              // Fall through
            }
            emitFinish('error');
          });

          adsLoader.requestAds(req);
          return;
        } catch {
          // Fall back cleanly below
        }
      }

      // Direct XML MediaFile fallback when IMA SDK is blocked by ad blocker
      try {
        const res = await fetch(ad.vastTagUrl);
        const xml = await res.text();
        const summary = parseVastXmlSummary(xml);
        if (!cancelled && summary.mediaFileUrl) {
          window.clearTimeout(hardTimeout);
          setParsed(summary);
          setTotalSec(summary.durationSec || 15);
          setMode('fallback_video');
          trackAdEvent(
            {
              adId: ad.id,
              adKind: 'vast',
              event: 'impression',
              contentId,
              contentType,
              placement: ad.type,
              uid: userId || 'guest',
              device,
            },
            adSettings.testMode
          );
          return;
        }
      } catch {
        // Ignore CORS / adblocker
      }
      window.clearTimeout(hardTimeout);
      emitFinish('error');
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      try {
        adsManager?.destroy?.();
      } catch {}
    };
  }, [ad.id, ad.type, ad.vastTagUrl]);

  // Countdown tick for fallback video, test_slate, and auto-dismissing overlay
  useEffect(() => {
    if (mode !== 'fallback_video' && mode !== 'test_slate' && ad.type !== 'overlay') return;
    const t = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= totalSec) {
          emitFinish('complete');
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [mode, ad.type, totalSec]);

  // Overlay Non-Linear Banner at bottom above controls
  if (ad.type === 'overlay') {
    return (
      <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 flex w-[92%] max-w-lg -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-white/20 bg-zinc-950/90 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400">
            <span>{adSettings.showAdLabel ? adSettings.adLabelText || 'Ad' : 'Sponsor'}</span>
            {adSettings.testMode && <span>· TEST MODE</span>}
            <span>· {Math.max(0, totalSec - elapsedSec)}s</span>
          </div>
          <p className="truncate text-xs font-semibold">
            {parsed?.title || ad.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(parsed?.clickThroughUrl || ad.vastTagUrl) && (
            <a
              href={parsed?.clickThroughUrl || ad.vastTagUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() =>
                trackAdEvent(
                  {
                    adId: ad.id,
                    adKind: 'vast',
                    event: 'click',
                    contentId,
                    contentType,
                    placement: 'overlay',
                    uid: userId || 'guest',
                    device,
                  },
                  adSettings.testMode
                )
              }
              className="inline-flex items-center gap-1 rounded-md bg-[var(--kv-accent,#e50914)] px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Visit Advertiser <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => emitFinish('skip')}
            aria-label="Close overlay ad"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, totalSec - elapsedSec);
  const effectiveSkipSec = nonSkippable ? 0 : ad.skipAfterSeconds;
  const canSkip =
    effectiveSkipSec > 0 && elapsedSec >= effectiveSkipSec;
  const skipCountdown =
    effectiveSkipSec > 0 ? Math.max(0, effectiveSkipSec - elapsedSec) : null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between bg-black text-white">
      <video
        ref={videoRef}
        src={mode === 'fallback_video' ? parsed?.mediaFileUrl : undefined}
        autoPlay
        muted={muted}
        playsInline
        onEnded={() => emitFinish('complete')}
        onError={() => emitFinish('error')}
        className={`absolute inset-0 h-full w-full object-contain ${
          mode === 'fallback_video' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <div
        ref={imaContainerRef}
        className={`absolute inset-0 h-full w-full ${mode === 'ima' ? 'z-10' : 'pointer-events-none'}`}
      />

      {mode === 'loading' && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-[var(--kv-accent,#e50914)]" />
          <p className="mt-2 text-xs text-zinc-400">Loading sponsor message...</p>
        </div>
      )}

      {mode === 'test_slate' && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black px-6 text-center">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Test Mode VAST Slate · Zero Analytics Recorded
          </span>
          <h3 className="mt-2 font-display text-xl font-bold">{ad.name}</h3>
          <p className="mt-1 text-xs text-zinc-400 capitalize">
            {ad.type} slot · Skip after {ad.skipAfterSeconds}s
          </p>
        </div>
      )}

      {/* Top Overlay Badges */}
      <div className="relative z-20 flex items-center justify-between p-4">
        <span className="rounded bg-black/75 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
          {adSettings.showAdLabel ? adSettings.adLabelText || 'Ad' : 'Sponsored'} · Ad {adStepIndex} of {adStepTotal} · 0:
          {String(remaining).padStart(2, '0')}
        </span>
        <div className="flex items-center gap-2">
          {mode !== 'ima' && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute ad' : 'Mute ad'}
              className="rounded-lg bg-black/70 p-2 hover:bg-black"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          {onCancelEarly && (
            <button
              type="button"
              onClick={onCancelEarly}
              title="Close ad without unlocking"
              aria-label="Close ad"
              className="inline-flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-black"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="relative z-20 flex items-center justify-between p-4">
        {parsed?.clickThroughUrl ? (
          <a
            href={parsed.clickThroughUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() =>
              trackAdEvent(
                {
                  adId: ad.id,
                  adKind: 'vast',
                  event: 'click',
                  contentId,
                  contentType,
                  placement: ad.type,
                  uid: userId || 'guest',
                  device,
                },
                adSettings.testMode
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-black/75 px-3 py-1.5 text-xs font-semibold hover:bg-black"
          >
            Visit Advertiser <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span />
        )}

        {nonSkippable ? (
          <span className="rounded-lg border border-white/25 bg-black/75 px-3 py-1.5 text-xs text-zinc-200">
            Reward unlocks when ad finishes
          </span>
        ) : mode !== 'ima' && skipCountdown !== null ? (
          canSkip ? (
            <button
              type="button"
              onClick={() => emitFinish('skip')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg hover:bg-zinc-200"
            >
              Skip Ad <SkipForward className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="rounded-lg border border-white/25 bg-black/75 px-3 py-1.5 text-xs text-zinc-300">
              Skip in {skipCountdown}s
            </span>
          )
        ) : null}
      </div>
    </div>
  );
};
