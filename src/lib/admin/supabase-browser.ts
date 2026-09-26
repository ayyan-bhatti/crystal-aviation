import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '../config';

let client: SupabaseClient | null = null;

/**
 * Browser client for the staff dashboard. Uses only the public publishable key;
 * every write is authorised by RLS against the signed-in staff member's session.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tca-staff-auth', detectSessionInUrl: false },
    });
  }
  return client;
}

export interface FriendlyError {
  message: string;
  kind: 'auth' | 'permission' | 'conflict' | 'validation' | 'network' | 'unknown';
}

/** Map Supabase/PostgREST/Storage errors to plain-language messages for staff. */
export function friendlyError(err: unknown): FriendlyError {
  const e = (err ?? {}) as { code?: string; message?: string; status?: number; statusCode?: string | number; name?: string };
  const msg = String(e.message ?? '');
  const code = String(e.code ?? '');
  const status = Number(e.status ?? e.statusCode ?? 0);

  if (code === 'PGRST301' || /jwt expired|invalid jwt|not authenticated/i.test(msg) || status === 401) {
    return { kind: 'auth', message: 'Your session has expired. Please sign in again. Your changes are kept.' };
  }
  if (code === '23505' || /duplicate key/i.test(msg)) {
    return { kind: 'conflict', message: 'That web address (slug) is already used by another offer. Choose a different one.' };
  }
  if (code === '42501' || status === 403 || /row-level security|permission denied|unauthorized/i.test(msg)) {
    return { kind: 'permission', message: 'You don’t have permission to do this. Your dashboard access may have been removed. Contact the owner.' };
  }
  if (code === '23514' || code === '22P02' || code === '22001') {
    return { kind: 'validation', message: 'Some details weren’t accepted. Please check the highlighted fields and try again.' };
  }
  if (/failed to fetch|network|load failed|timeout/i.test(msg) || e.name === 'TypeError') {
    return { kind: 'network', message: 'Couldn’t reach the server. Check your internet connection and try again.' };
  }
  return { kind: 'unknown', message: msg ? `Something went wrong: ${msg}` : 'Something went wrong. Please try again.' };
}
