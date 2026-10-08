import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(customUrl?: string, customKey?: string): SupabaseClient | null {
  const url = customUrl || (typeof window !== 'undefined' ? localStorage.getItem('vocat_supabase_url') : '') || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = customKey || (typeof window !== 'undefined' ? localStorage.getItem('vocat_supabase_anon_key') : '') || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !url.startsWith('http')) {
    return null;
  }

  const currentKey = `${url}:${key}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}
