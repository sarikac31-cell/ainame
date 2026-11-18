import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type {
  AdGlobalSettings,
  AdPlacementType,
  AdTargetContentType,
  CustomAdItem,
  UserProfile,
} from '../../types/streaming';
import {
  detectCurrentDevice,
  isValidAdRedirectUrl,
  pickEligibleCustomAds,
  pickWeightedAd,
} from '../../utils/adEngine';
import { getDailyImpressionCounts, trackAdEvent } from '../../lib/adsFirebase';

interface CustomAdSlotProps {
  placement: AdPlacementType;
  customAds: CustomAdItem[];
  adSettings: AdGlobalSettings;
  user: UserProfile | null;
  contentType?: AdTargetContentType;
  contentId?: string;
  episodeId?: string;
  variant?: 'default' | 'pause-overlay';
  onDismiss?: () => void;
  className?: string;
}

export const CustomAdSlot: React.FC<CustomAdSlotProps> = ({
  placement,
  customAds,
  adSettings,
  user,
  contentType = 'all',
  contentId,
  episodeId,
  variant = 'default',
  onDismiss,
  className = '',
}) => {
  const [device, setDevice] = useState(() => detectCurrentDevice());
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionTrackedRef = useRef<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const onResize = () => setDevice(detectCurrentDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectedAd = useMemo(() => {
    const dailyCounts = getDailyImpressionCounts();
    const eligible = pickEligibleCustomAds(
      customAds,
      adSettings,
      {
        placement,
        contentType,
        contentId,
        episodeId,
        device,
        user,
      },
      dailyCounts
    );
    return pickWeightedAd(eligible);
  }, [customAds, adSettings, placement, contentType, contentId, episodeId, device, user]);

  useEffect(() => {
    setImageError(false);
  }, [selectedAd?.id]);

  // Track impression only once when >=50% of slot stays visible for 1 full second
  useEffect(() => {
    if (!selectedAd || !containerRef.current) return;
    if (impressionTrackedRef.current === selectedAd.id) return;

    let timer: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer === null) {
            timer = window.setTimeout(() => {
              if (impressionTrackedRef.current !== selectedAd.id) {
                impressionTrackedRef.current = selectedAd.id;
                trackAdEvent(
                  {
                    adId: selectedAd.id,
                    adKind: 'custom',
                    event: 'impression',
                    contentId: contentId || '',
                    contentType: contentType || 'all',
                    placement,
                    uid: user?.uid || 'guest',
                    device,
                  },
                  adSettings.testMode
                );
              }
            }, 1000);
          }
        } else if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0.5] }
    );

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [selectedAd, contentId, contentType, placement, user?.uid, device, adSettings.testMode]);

  if (!selectedAd) return null;

  const urlCheck = isValidAdRedirectUrl(selectedAd.redirectUrl);
  const safeHref = urlCheck.valid ? selectedAd.redirectUrl : undefined;
  const srcUrl =
    device === 'mobile' && selectedAd.mobileImageUrl
      ? selectedAd.mobileImageUrl
      : selectedAd.imageUrl;

  const handleClick = () => {
    trackAdEvent(
      {
        adId: selectedAd.id,
        adKind: 'custom',
        event: 'click',
        contentId: contentId || '',
        contentType: contentType || 'all',
        placement,
        uid: user?.uid || 'guest',
        device,
      },
      adSettings.testMode
    );
  };

  if (variant === 'pause-overlay') {
    return (
      <div
        ref={containerRef}
        className={`relative w-full max-w-md overflow-hidden rounded-xl border border-white/20 bg-zinc-950/95 shadow-2xl ${className}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-zinc-300">
          <span>
            {adSettings.showAdLabel ? adSettings.adLabelText || 'Ad' : 'Sponsored'}
            {adSettings.testMode ? ' · Test Mode' : ''}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss paused ad"
              className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <a
          href={safeHref}
          target={selectedAd.openInNewTab ? '_blank' : undefined}
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="group relative block aspect-[16/6] w-full overflow-hidden bg-zinc-900"
        >
          {!imageError ? (
            <img
              src={srcUrl}
              alt={selectedAd.altText || selectedAd.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
              {selectedAd.name}
            </div>
          )}
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
            Learn More <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm dark:border-zinc-800">
        {adSettings.showAdLabel && (
          <span className="pointer-events-none absolute left-2.5 top-2 z-10 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur-sm">
            {adSettings.adLabelText || 'Ad'}
            {adSettings.testMode ? ' · TEST' : ''}
          </span>
        )}
        <a
          href={safeHref}
          target={selectedAd.openInNewTab ? '_blank' : undefined}
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          aria-label={selectedAd.altText || `Sponsored: ${selectedAd.name}`}
          className={`group relative block w-full overflow-hidden ${
            placement === 'banner'
              ? 'aspect-[4/1] max-h-[160px] sm:aspect-[6/1]'
              : 'aspect-[4/1] max-h-[210px]'
          }`}
        >
          {!imageError ? (
            <img
              src={srcUrl}
              alt={selectedAd.altText || selectedAd.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-r from-zinc-900 to-zinc-800 px-4 text-center text-white">
              <span className="text-xs font-semibold">{selectedAd.name}</span>
              <span className="text-[11px] text-zinc-400">{selectedAd.altText}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="pointer-events-none absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {selectedAd.altText || selectedAd.name}
            <ExternalLink className="h-3 w-3 opacity-80" />
          </span>
        </a>
      </div>
    </div>
  );
};
