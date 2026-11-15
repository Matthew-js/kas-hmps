// Edge Function `scan-nota`: membaca foto nota di bucket 'bukti' dan mengembalikan usulan isian
// transaksi. TIDAK pernah membuat transaksi; bendahara memeriksa & menyimpan sendiri di aplikasi.
//
// Request : POST { proof_path: string }  (header Authorization: Bearer <JWT pengguna>)
// Response: 200 { ok: true,  scan_id, data: { date, merchant, total, items, category, confidence } }
//           200 { ok: false, scan_id, code: 'timeout' | 'unreadable' | 'ai_error' | 'rate_limited' }   ← scan gagal, isi manual
//           4xx { ok: false, code, message }                                        ← permintaan ditolak
import { createClient } from '@supabase/supabase-js'
import { extractReceipt, MODEL, ScanError } from './provider.ts'
import { sniffImage, validate } from './validate.ts'

const MAX_BYTES = 2 * 1024 * 1024
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const reject = (status: number, code: string, message: string) => json(status, { ok: false, code, message })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reject(405, 'method', 'Gunakan POST.')

  // 1. Verifikasi JWT pemanggil. Client dibuat dengan JWT pengguna (bukan service role),
  //    sehingga semua query di bawah tetap tunduk pada RLS.
  const authHeader = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (!user) return reject(401, 'unauthorized', 'Sesi login tidak valid. Silakan login ulang.')

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'bendahara') return reject(403, 'forbidden', 'Hanya bendahara yang dapat memakai Scan Nota.')

  // 2. Validasi path berkas.
  let body: { proof_path?: unknown }
  try { body = await req.json() } catch { return reject(400, 'bad_request', 'Body harus JSON.') }
  const path = body.proof_path
  if (typeof path !== 'string' || !/^[\w-]+\/[\w-]+\.(jpe?g|png)$/i.test(path)) {
    return reject(400, 'bad_path', 'Path bukti tidak valid.')
  }

  // 3. Unduh gambar & batasi ukuran sebelum memanggil AI (batas biaya).
  const { data: blob, error: dlError } = await sb.storage.from('bukti').download(path)
  if (dlError || !blob) return reject(404, 'not_found', 'Berkas bukti tidak ditemukan.')
  if (blob.size > MAX_BYTES) return reject(413, 'too_large', 'Ukuran gambar maksimal 2MB.')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mime = sniffImage(bytes)
  if (!mime) return reject(415, 'bad_type', 'Format gambar harus JPG atau PNG.')

  // 4. Daftar kategori pengeluaran diambil dari database, bukan dari kiriman frontend.
  const { data: cats } = await sb.from('categories').select('name').eq('type', 'out').order('id')
  const categories = (cats ?? []).map((c) => c.name as string)

  // 5. Satu panggilan AI, lalu validasi & catat ke receipt_scans (berhasil maupun gagal).
  let status: 'ok' | 'failed' = 'ok'
  let code: string | null = null
  let raw_result: Record<string, unknown>
  let data: ReturnType<typeof validate> | null = null
  try {
    const { receipt, model, usage } = await extractReceipt(bytes, mime, categories)
    data = validate(receipt, categories)
    if (data.total === null && data.date === null && data.merchant === null && data.items.length === 0) {
      status = 'failed'; code = 'unreadable'
    }
    raw_result = { model, raw: receipt, validated: data, usage }
  } catch (e) {
    status = 'failed'
    code = e instanceof ScanError ? e.code : 'ai_error'
    raw_result = { model: MODEL, error: String((e as Error)?.message ?? e) }
    console.error('scan-nota gagal:', raw_result.error)
  }

  const { data: scan, error: insError } = await sb.from('receipt_scans')
    .insert({ proof_path: path, status, raw_result, created_by: user.id })
    .select('id').single()
  if (insError) console.error('insert receipt_scans gagal:', insError.message)

  return status === 'ok'
    ? json(200, { ok: true, scan_id: scan?.id ?? null, data })
    : json(200, { ok: false, scan_id: scan?.id ?? null, code })
})
