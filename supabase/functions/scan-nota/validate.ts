// Validasi hasil AI di server. Field yang tidak valid dikembalikan null (confidence 0), tidak ditebak.
import type { RawReceipt } from './provider.ts'

// Kenali format dari isi berkas, bukan dari nama/Content-Type kiriman.
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  return null
}

// Tanggal hari ini di WIB (Edge Function berjalan di UTC).
const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

export function validDate(s: unknown): string | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null // tolak 2026-02-30
  const today = todayWIB()
  const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 366 * 86400_000).toISOString().slice(0, 10)
  return s <= today && s >= yearAgo ? s : null
}

const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

export function validate(r: RawReceipt, categories: string[]) {
  const total = Number.isInteger(r?.total) && (r.total as number) > 0 && (r.total as number) <= 1_000_000_000 ? r.total : null
  const date = validDate(r?.date)
  const category = typeof r?.category === 'string' && categories.includes(r.category) ? r.category : null
  const merchant = typeof r?.merchant === 'string' && r.merchant.trim() ? r.merchant.trim().slice(0, 80) : null
  const items = (Array.isArray(r?.items) ? r.items : [])
    .filter((i) => i && typeof i.name === 'string' && i.name.trim())
    .slice(0, 50)
    .map((i) => ({
      name: i.name.trim().slice(0, 80),
      qty: typeof i.qty === 'number' && i.qty > 0 ? i.qty : 1,
      price: Number.isInteger(i.price) && i.price > 0 ? i.price : null,
    }))
  return {
    date, merchant, total, items, category,
    confidence: {
      date: date ? clamp01(r?.confidence?.date) : 0,
      total: total ? clamp01(r?.confidence?.total) : 0,
      category: category ? clamp01(r?.confidence?.category) : 0,
    },
  }
}
