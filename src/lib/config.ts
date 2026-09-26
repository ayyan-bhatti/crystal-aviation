const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const key = (import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export const supabaseUrl = url;
export const supabaseKey = key;
export const isSupabaseConfigured = /^https?:\/\/.+/.test(url) && key.length > 20;

/**
 * Demo mode shows clearly-labelled sample offers. It is only ever on when
 * explicitly requested (PUBLIC_DEMO_MODE=true) or in `astro dev` without
 * credentials. A production build with missing config shows an error state,
 * never invented offers.
 */
export const isDemoMode =
  import.meta.env.PUBLIC_DEMO_MODE === 'true' || (import.meta.env.DEV && !isSupabaseConfigured);

export const POSTER_BUCKET = 'promotion-posters';
