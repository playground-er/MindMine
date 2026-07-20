import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The client is created on first use, not at import time.
 *
 * Tahap 1 is pure canvas and runs before anyone has a Supabase project. If we
 * built the client eagerly, a missing .env.local would blank the whole app with
 * an import-time throw instead of the canvas people are trying to look at.
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase belum dikonfigurasi. Salin .env.example ke .env.local dan isi ' +
        'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY — lihat SETUP.md langkah 5.',
    )
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}

/** True when env vars are present. Lets the UI degrade instead of throwing. */
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}
