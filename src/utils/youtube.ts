import type { VideoSourceType } from '../types/streaming';

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;

/**
 * Extracts a YouTube video ID from watch, youtu.be, shorts, live, or embed URLs.
 */
export function extractYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();

  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.pathname === '/watch' || parsed.searchParams.has('v')) {
      candidate = parsed.searchParams.get('v');
    } else if (
      pathParts[0] === 'embed' ||
      pathParts[0] === 'shorts' ||
      pathParts[0] === 'live' ||
      pathParts[0] === 'v'
    ) {
      candidate = pathParts[1] ?? null;
    }
  }

  if (candidate && YOUTUBE_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return null;
}

/**
 * Builds a privacy-enhanced youtube-nocookie embed URL with YouTube controls,
 * annotations, fullscreen chrome, keyboard shortcuts, and external suggestions minimized.
 */
export function buildCleanYouTubeEmbedUrl(videoId: string, origin?: string): string {
  const params = new URLSearchParams({
    controls: '0',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    fs: '0',
    disablekb: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  if (origin && /^https?:\/\//i.test(origin)) {
    params.set('origin', origin);
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

/**
 * Infers the appropriate VideoSourceType when a URL is pasted into Admin forms.
 */
export function detectVideoSourceType(
  url: string,
  fallback: VideoSourceType = 'mp4'
): VideoSourceType {
  if (extractYouTubeVideoId(url)) return 'embed';
  const lower = url.trim().toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  return fallback;
}
