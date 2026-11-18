import type { CustomPage, MovieItem } from '../types/streaming';

function escapeXml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatMetaTitle(template: string, pageTitle: string, siteName: string): string {
  const safeTemplate = template?.trim() || '{title} | {siteName}';
  if (!pageTitle.trim() || pageTitle.trim() === siteName.trim()) {
    return siteName;
  }
  return safeTemplate
    .replace(/\{title\}/gi, pageTitle.trim())
    .replace(/\{siteName\}/gi, siteName.trim());
}

export function generateSitemapXml(
  baseUrl: string,
  movies: MovieItem[],
  pages: CustomPage[]
): string {
  const cleanBase = (baseUrl || 'https://example.com').replace(/\/+$/, '');
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: `${cleanBase}/#/home`, priority: '1.0' },
    { loc: `${cleanBase}/#/movies`, priority: '0.8' },
    { loc: `${cleanBase}/#/series`, priority: '0.8' },
    { loc: `${cleanBase}/#/plans`, priority: '0.7' },
  ];

  movies
    .filter((m) => m.status === 'published')
    .forEach((m) => {
      urls.push({
        loc: `${cleanBase}/#/movie/${encodeURIComponent(m.slug || m.id)}`,
        lastmod: (m.updatedAt || m.createdAt || '').slice(0, 10) || undefined,
        priority: '0.7',
      });
    });

  pages
    .filter((p) => p.status === 'published')
    .forEach((p) => {
      urls.push({
        loc: `${cleanBase}/#/page/${encodeURIComponent(p.slug)}`,
        lastmod: (p.updatedAt || '').slice(0, 10) || undefined,
        priority: '0.5',
      });
    });

  const rows = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${
          u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ''
        }\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export function generateRobotsTxt(baseUrl: string): string {
  const cleanBase = (baseUrl || 'https://example.com').replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    `Sitemap: ${cleanBase}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildMovieJsonLd(movie: MovieItem, siteName: string, baseUrl: string): string {
  const cleanBase = (baseUrl || '').replace(/\/+$/, '');
  const schemaType = movie.type === 'series' ? 'TVSeries' : 'Movie';
  const payload = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: movie.title,
    description: movie.description,
    image: movie.posterUrl || movie.bannerUrl || undefined,
    datePublished: String(movie.releaseYear),
    genre: movie.genres,
    director: movie.director ? { '@type': 'Person', name: movie.director } : undefined,
    actor: movie.cast.slice(0, 8).map((name) => ({ '@type': 'Person', name })),
    publisher: { '@type': 'Organization', name: siteName },
    url: cleanBase ? `${cleanBase}/#/movie/${movie.slug}` : undefined,
    aggregateRating:
      movie.rating > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: movie.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount: Math.max(1, movie.likesCount || 1),
          }
        : undefined,
  };
  return JSON.stringify(payload);
}
