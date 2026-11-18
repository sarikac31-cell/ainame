import React, { useEffect, useState } from 'react';
import { SkipForward } from 'lucide-react';
import type { BrandingSettings } from '../../types/streaming';

interface AnimeEntranceProps {
  open: boolean;
  siteName: string;
  branding?: BrandingSettings;
  reducedMotion?: boolean;
  onComplete: () => void;
}

const SPEED_RAYS = Array.from({ length: 28 }, (_, idx) => ({
  angle: idx * (360 / 28),
  length: idx % 3 === 0 ? 540 : idx % 2 === 0 ? 420 : 320,
  width: idx % 4 === 0 ? 2.5 : 1.3,
}));

const PETAL_PARTICLES = Array.from({ length: 18 }, (_, idx) => ({
  id: idx,
  left: `${(idx * 17 + 6) % 94}%`,
  top: `${(idx * 23 + 10) % 88}%`,
  size: 8 + (idx % 4) * 3,
  delay: `${(idx % 6) * 0.14}s`,
}));

export function AnimeEntrance({
  open,
  siteName,
  branding,
  reducedMotion = false,
  onComplete,
}: AnimeEntranceProps) {
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSplitting(false);
      return;
    }

    if (branding?.splashEnabled === false || reducedMotion) {
      onComplete();
      return;
    }

    const osReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (osReducedMotion) {
      onComplete();
      return;
    }

    const splitTimer = window.setTimeout(() => setSplitting(true), 2300);
    const doneTimer = window.setTimeout(() => onComplete(), 2950);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(splitTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onComplete, branding?.splashEnabled, reducedMotion]);

  if (!open || branding?.splashEnabled === false || reducedMotion) return null;

  const splashBg = branding?.splashBgColor || '#07070b';
  const splashAnim = branding?.splashAnimation || 'fade';

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden select-none transition-opacity duration-500 ${
        splitting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: splashBg }}
      role="dialog"
      aria-modal="true"
      aria-label="Opening cinema sequence"
      onClick={onComplete}
    >
      {/* Seamless Anime Backdrop + Twin Curtain Exit */}
      <div
        className={`absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${
          splitting ? 'scale-110' : 'scale-100'
        }`}
        style={{ backgroundColor: splashBg }}
      >
        <img
          src="/src/assets/images/anime_entrance_hero_1794831916481.jpg"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="kv-anime-backdrop h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/30 to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(7,7,11,0.82)_100%)]" />
      </div>

      {/* Radial Anime Speed Lines */}
      <svg
        viewBox="-600 -600 1200 1200"
        aria-hidden="true"
        className="kv-anime-rays pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-screen"
      >
        {SPEED_RAYS.map((ray, i) => (
          <line
            key={i}
            x1={Math.cos((ray.angle * Math.PI) / 180) * 145}
            y1={Math.sin((ray.angle * Math.PI) / 180) * 145}
            x2={Math.cos((ray.angle * Math.PI) / 180) * (145 + ray.length)}
            y2={Math.sin((ray.angle * Math.PI) / 180) * (145 + ray.length)}
            stroke={i % 3 === 0 ? '#ef4444' : '#ffffff'}
            strokeOpacity={i % 3 === 0 ? 0.72 : 0.36}
            strokeWidth={ray.width}
          />
        ))}
      </svg>

      {/* Floating Anime Sakura / Ember Petals */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {PETAL_PARTICLES.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size * 0.65,
              animationDelay: p.delay,
            }}
            className="kv-anime-petal absolute rounded-tl-full rounded-br-full bg-gradient-to-br from-rose-200 via-rose-400 to-red-600 shadow-[0_0_10px_rgba(244,63,94,0.65)]"
          />
        ))}
      </div>

      {/* Katana / Comet Energy Slash + Impact Shockwave */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="kv-anime-shockwave h-64 w-64 rounded-full border-2 border-rose-400/80 shadow-[0_0_45px_rgba(229,9,20,0.7)] sm:h-96 sm:w-96" />
        <div className="kv-anime-slash absolute h-1.5 w-[135vw] origin-center bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_26px_5px_rgba(229,9,20,0.95)]" />
      </div>

      {/* Center Title Kinetic Slam */}
      <div
        className={`kv-anime-title pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-white transition-transform duration-500 ${
          splitting ? 'scale-110' : 'scale-100'
        }`}
      >
        <p className="font-mono text-xs font-semibold tracking-[0.36em] text-rose-300 uppercase drop-shadow">
          Opening Premiere
        </p>

        {branding?.splashLogoUrl ? (
          <img
            src={branding.splashLogoUrl}
            alt={siteName}
            className={`mt-4 max-h-24 w-auto object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)] ${
              splashAnim === 'pulse' ? 'animate-pulse' : ''
            }`}
          />
        ) : (
          <h1
            className={`mt-3 font-display text-5xl font-bold tracking-tight drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)] sm:text-7xl ${
              splashAnim === 'pulse' ? 'animate-pulse' : ''
            }`}
          >
            {siteName}
          </h1>
        )}

        {splashAnim === 'spinner' && (
          <div className="mt-4 h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-[var(--kv-accent,#e50914)]" />
        )}

        <div className="kv-anime-rule mt-4 h-0.5 w-44 origin-center bg-gradient-to-r from-transparent via-[var(--kv-accent,#e50914)] to-transparent" />
        <p className="mt-3 text-xs font-medium text-zinc-100 drop-shadow sm:text-sm">
          {branding?.tagline || 'Curated films, series, and theatrical stories'}
        </p>
      </div>

      {/* Skip Intro Control */}
      {!splitting && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="absolute right-5 bottom-6 z-20 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/25 bg-black/65 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/15 sm:top-6 sm:bottom-auto"
        >
          <span>Skip Intro</span>
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
