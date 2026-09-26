import { isDemoMode, isSupabaseConfigured, POSTER_BUCKET, supabaseKey, supabaseUrl } from './config';
import { isActive } from './dates';
import { PUBLIC_COLUMNS, type Category, type PublicPromotion } from './types';

export type LoadResult<T> =
  | { status: 'ok'; data: T; demo?: boolean }
  | { status: 'error'; reason: 'not-configured' | 'timeout' | 'network' | 'http' };

export const MAX_PAGE_SIZE = 24;
const TIMEOUT_MS = 6000;
const POSTER_PATH_RE = /^posters\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

async function restGet<T>(pathAndQuery: string): Promise<LoadResult<T>> {
  if (!isSupabaseConfigured) return { status: 'error', reason: 'not-configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: supabaseKey, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'error', reason: 'http' };
    return { status: 'ok', data: (await res.json()) as T };
  } catch (e) {
    return { status: 'error', reason: (e as Error)?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function demoData(): Promise<PublicPromotion[]> {
  // Written with build-time constants so production builds drop the fixtures chunk entirely.
  if (import.meta.env.DEV || import.meta.env.PUBLIC_DEMO_MODE === 'true') {
    if (!isDemoMode) return [];
    const mod = await import('./demo-fixtures');
    return mod.demoPromotions;
  }
  return [];
}

export interface ListOptions {
  category?: Category | Category[];
  featuredOnly?: boolean;
  limit?: number;
}

export async function fetchActivePromotions(opts: ListOptions = {}): Promise<LoadResult<PublicPromotion[]>> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), MAX_PAGE_SIZE);
  const cats = opts.category ? (Array.isArray(opts.category) ? opts.category : [opts.category]) : [];

  if (isDemoMode) {
    const all = await demoData();
    const data = all
      .filter((p) => (cats.length ? cats.includes(p.category) : true))
      .filter((p) => (opts.featuredOnly ? p.featured : true))
      .slice(0, limit);
    return { status: 'ok', data, demo: true };
  }

  const q = new URLSearchParams({
    select: PUBLIC_COLUMNS,
    order: 'featured.desc,sort_order.asc,updated_at.desc',
    limit: String(limit),
  });
  if (cats.length) q.set('category', `in.(${cats.join(',')})`);
  if (opts.featuredOnly) q.set('featured', 'eq.true');

  const res = await restGet<PublicPromotion[]>(`public_promotions?${q}`);
  if (res.status === 'ok') res.data = res.data.filter((p) => isActive(p));
  return res;
}

export async function fetchPromotionBySlug(slug: string): Promise<LoadResult<PublicPromotion | null>> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { status: 'ok', data: null };

  if (isDemoMode) {
    const all = await demoData();
    return { status: 'ok', data: all.find((p) => p.slug === slug) ?? null, demo: true };
  }

  const q = new URLSearchParams({ select: PUBLIC_COLUMNS, slug: `eq.${slug}`, limit: '1' });
  const res = await restGet<PublicPromotion[]>(`public_promotions?${q}`);
  if (res.status !== 'ok') return res;
  const item = res.data[0];
  return { status: 'ok', data: item && isActive(item) ? item : null };
}

/** Slugs for the sitemap. */
export async function fetchActiveSlugs(): Promise<LoadResult<{ slug: string; updated_at: string }[]>> {
  if (isDemoMode) return { status: 'ok', data: [], demo: true };
  const q = new URLSearchParams({ select: 'slug,updated_at', order: 'updated_at.desc', limit: '200' });
  return restGet(`public_promotions?${q}`);
}

/** Public URL for a stored poster, or null if the path is not a valid poster path. */
export function posterUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (isDemoMode && path.startsWith('data:image/svg+xml,')) return path; // demo fixtures only
  if (!POSTER_PATH_RE.test(path) || !supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${POSTER_BUCKET}/${path}`;
}
