import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Browser client using the PUBLIC anon key only. All authorization is enforced
 * by Row Level Security in the database. Never put the service_role key here.
 * Null when the project isn't configured — the app then offers demo mode only.
 */
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('YOUR-PROJECT') ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;
