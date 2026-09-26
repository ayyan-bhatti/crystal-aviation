import type { APIRoute } from 'astro';
import { site } from '../config/site';
import { fetchActiveSlugs } from '../lib/promotions-api';

export const prerender = false;

const STATIC_PATHS = ['/', '/umrah', '/tours', '/visa', '/promotions', '/about', '/contact'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  // Only currently active offers (the public view applies the same rule as the site).
  const res = await fetchActiveSlugs();
  const offers = res.status === 'ok' ? res.data : [];

  const urls = [
    ...STATIC_PATHS.map((p) => `<url><loc>${esc(site.url + p)}</loc></url>`),
    ...offers.map(
      (o) => `<url><loc>${esc(`${site.url}/promotions/${o.slug}`)}</loc><lastmod>${esc(o.updated_at)}</lastmod></url>`,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
