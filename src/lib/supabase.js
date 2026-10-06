import { createClient } from '@supabase/supabase-js'

let client = null

// Client dibuat saat pertama dipakai, sehingga mode 'memory' tetap jalan tanpa .env.local.
export function getSupabase() {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi di .env.local')
  }
  client = createClient(url, key)
  return client
}
