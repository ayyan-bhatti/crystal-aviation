import { defineMiddleware } from 'astro:middleware';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Security headers for on-demand responses. Static assets get the same via public/_headers.
export const onRequest = defineMiddleware(async (context, next) => {
  const original = await next();
  // Some responses (e.g. fetched assets) have immutable headers, so copy before editing.
  const res = new Response(original.body, original);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  if (context.url.pathname.startsWith('/admin')) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
});
