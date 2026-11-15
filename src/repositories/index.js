// Satu-satunya titik pergantian sumber data (Repository Pattern).
// View & store hanya memanggil `repo.*`, tidak tahu datanya dari memori atau Supabase.
import { memoryRepo } from './memoryRepo'
import { supabaseRepo } from './supabaseRepo'

export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'supabase' ? 'supabase' : 'memory'
export const repo = DATA_SOURCE === 'supabase' ? supabaseRepo : memoryRepo
