// Adapter penyedia AI vision. Satu-satunya file yang tahu soal penyedia AI:
// untuk ganti penyedia, buat fungsi lain dengan signature `extractReceipt` yang sama.
// Saat ini: Google Gemini API (tier gratis) lewat endpoint REST generateContent.
// Catatan: pada tier gratis, Google dapat memakai data yang dikirim untuk meningkatkan produknya.
import { encodeBase64 } from '@std/encoding/base64'

// Urutan model gratis yang dicoba. Model berikutnya hanya dipakai jika model sebelumnya menolak
// karena sedang ramai (503) atau kuota habis (429) — permintaan itu tidak diproses, jadi tidak ada kerja ganda.
// Batas waktu per model (ms): model yang macet karena ramai dilewati agar cadangan masih sempat dicoba.
const ATTEMPTS: [model: string, timeoutMs: number][] = [
  ['gemini-3.8-flash', 9_000],
  ['gemini-3.5-flash', 6_000],
  ['gemini-3.5-flash-lite', 10_000],
]
export const MODEL = ATTEMPTS[0][0]
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
const AI_TIMEOUT_MS = 25_000 // total untuk semua percobaan; < 30 dtk batas frontend

export type RawReceipt = {
  date: string | null
  merchant: string | null
  total: number | null
  items: { name: string; qty: number; price: number }[]
  category: string | null
  confidence: { date: number; total: number; category: number }
}

export type ExtractResult = { receipt: RawReceipt; model: string; usage: unknown }

/** Kesalahan yang aman ditampilkan ke pengguna (kode dipetakan ke pesan Indonesia di frontend). */
export class ScanError extends Error {
  constructor(public code: 'timeout' | 'unreadable' | 'ai_error' | 'rate_limited', message: string) {
    super(message)
  }
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'merchant', 'total', 'items', 'category', 'confidence'],
  properties: {
    date: { type: ['string', 'null'], description: 'Tanggal transaksi YYYY-MM-DD' },
    merchant: { type: ['string', 'null'] },
    total: { type: ['integer', 'null'], description: 'Total akhir dibayar, rupiah' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'price'],
        properties: { name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'integer' } },
      },
    },
    category: { type: ['string', 'null'] },
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: ['date', 'total', 'category'],
      properties: { date: { type: 'number' }, total: { type: 'number' }, category: { type: 'number' } },
    },
  },
}

const SYSTEM = `Kamu membaca foto nota/struk belanja Indonesia untuk pencatatan kas organisasi mahasiswa.
Kembalikan hanya data yang benar-benar terbaca di gambar. Jangan menebak.
- date: tanggal transaksi format YYYY-MM-DD. Nota Indonesia biasanya DD/MM/YY atau DD-MM-YYYY. null jika tidak terbaca.
- merchant: nama toko/penjual. null jika tidak ada.
- total: jumlah AKHIR yang dibayar dalam rupiah, bilangan bulat tanpa titik/koma (setelah diskon, termasuk pajak). Bukan uang tunai yang diberikan dan bukan kembalian. null jika tidak terbaca.
- items: daftar barang; price = total harga baris itu dalam rupiah (bilangan bulat). Kosongkan jika tidak terbaca.
- category: pilih tepat satu nama dari daftar kategori yang diberikan, atau null jika tidak ada yang cocok.
- confidence: keyakinanmu 0 sampai 1 untuk date, total, category. Isi 0 untuk field yang null.
Jika gambar bukan nota atau terlalu buram, kembalikan semua field null, items kosong, dan confidence 0.`

export async function extractReceipt(bytes: Uint8Array, mime: 'image/jpeg' | 'image/png', categories: string[]): Promise<ExtractResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new ScanError('ai_error', 'Secret GEMINI_API_KEY belum diset (npx supabase secrets set GEMINI_API_KEY=...)')

  const overall = AbortSignal.timeout(AI_TIMEOUT_MS) // satu tenggat untuk seluruh rantai model
  const request = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: mime, data: encodeBase64(bytes) } },
            { text: `Daftar kategori pengeluaran: ${JSON.stringify(categories)}` },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseJsonSchema: SCHEMA,
        },
      })

  let res: Response | null = null
  let model = MODEL
  const busy: string[] = []
  for (const [m, ms] of ATTEMPTS) {
    model = m
    if (overall.aborted) break
    try {
      res = await fetch(endpoint(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.any([overall, AbortSignal.timeout(ms)]),
        body: request,
      })
    } catch (e) {
      if ((e as Error)?.name !== 'TimeoutError') throw new ScanError('ai_error', `Gagal menghubungi Gemini: ${(e as Error)?.message}`)
      res = null
      busy.push(`${model}=timeout`)
      continue
    }
    if (res.status !== 503 && res.status !== 429) break
    busy.push(`${model}=${res.status}`)
    await res.body?.cancel()
  }
  if (!res) throw new ScanError('timeout', `AI timeout (${busy.join(', ')})`)

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    if (res.status === 429) throw new ScanError('rate_limited', `Semua model sibuk/kuota habis: ${busy.join(', ')}`)
    if (res.status === 503) throw new ScanError('ai_error', `Semua model sedang ramai: ${busy.join(', ')}`)
    throw new ScanError('ai_error', `Gemini ${model} ${res.status}: ${detail}`)
  }

  const body = await res.json()
  const candidate = body?.candidates?.[0]
  if (body?.promptFeedback?.blockReason || !candidate || candidate.finishReason !== 'STOP') {
    throw new ScanError('unreadable', `blockReason=${body?.promptFeedback?.blockReason} finishReason=${candidate?.finishReason}`)
  }
  const text = (candidate.content?.parts ?? [])
    .filter((p: { text?: string; thought?: boolean }) => typeof p.text === 'string' && !p.thought)
    .map((p: { text: string }) => p.text)
    .join('')
  try {
    return { receipt: JSON.parse(text), model: body.modelVersion ?? model, usage: { ...body.usageMetadata, busy } }
  } catch {
    throw new ScanError('ai_error', 'Respons AI bukan JSON')
  }
}
