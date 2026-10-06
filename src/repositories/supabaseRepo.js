// Implementasi repository memakai Supabase (PostgreSQL + Auth + Storage).
import { getSupabase } from '@/lib/supabase'
import { rethrow } from '@/lib/errors'
import { todayISO } from '@/utils/format'

const sb = () => getSupabase()
const check = ({ data, error }, overrides) => { if (error) rethrow(error, overrides); return data }

const DUP_CATEGORY = { 23505: 'Nama kategori sudah ada untuk jenis ini.' }
// DELETE yang diblokir RLS tidak mengembalikan error, hanya 0 baris; jangan anggap berhasil.
const mustAffect = (rows) => { if (!rows?.length) rethrow({ code: 'PGRST116' }) }

const SCAN_TIMEOUT_MS = 30_000
// Ambil kode error dari respons Edge Function non-2xx (401/403/413/…).
async function scanErrorCode(error) {
  if (/abort|timeout/i.test(`${error?.name} ${error?.message}`)) return 'timeout'
  try {
    const body = await error.context?.json()
    // 404 dari gateway Supabase (bukan dari function kita) = function belum di-deploy.
    if (body?.code === 'NOT_FOUND') return 'not_deployed'
    return body?.code ?? 'ai_error'
  } catch { return 'ai_error' }
}

const toTx = (r) => ({
  id: r.id, date: r.date, type: r.type, category: r.category, note: r.note,
  amount: Number(r.amount), proof: r.proof_path, duesPaymentId: r.dues_payment_id,
})
const toMember = (r) => ({ id: r.id, name: r.name, nrp: r.nrp, year: String(r.year), active: r.active })
const toPeriod = (r) => ({
  id: r.id, name: r.name, startDate: r.start_date, endDate: r.end_date,
  openingBalance: Number(r.opening_balance), duesAmount: Number(r.dues_amount),
})

export const supabaseRepo = {
  auth: {
    async getUser() {
      const { data } = await sb().auth.getSession()
      return data.session?.user ?? null
    },
    async signIn(email, password) {
      const data = check(await sb().auth.signInWithPassword({ email, password }))
      return data.user
    },
    async signOut() { check(await sb().auth.signOut()) },
    onChange(cb) { sb().auth.onAuthStateChange((_event, session) => cb(session?.user ?? null)) },
    async getProfile(userId) {
      return check(await sb().from('profiles').select('id, full_name, role').eq('id', userId).single())
    },
  },

  categories: {
    async list() { return check(await sb().from('categories').select('id, name, type').order('id')) },
    async create(c) {
      return check(await sb().from('categories').insert({ name: c.name, type: c.type }).select('id, name, type').single(), DUP_CATEGORY)
    },
    // Transaksi ikut berganti nama karena FK on update cascade.
    async rename(id, name) {
      return check(await sb().from('categories').update({ name }).eq('id', id).select('id, name, type').single(), DUP_CATEGORY)
    },
    async remove(id) {
      mustAffect(check(await sb().from('categories').delete().eq('id', id).select('id'), {
        23503: 'Kategori sudah dipakai transaksi sehingga tidak bisa dihapus.',
      }))
    },
  },

  periods: {
    async list() {
      return check(await sb().from('periods').select('*').order('start_date', { ascending: false })).map(toPeriod)
    },
    async setDuesAmount(id, amount) {
      return toPeriod(check(await sb().from('periods').update({ dues_amount: amount }).eq('id', id).select().single()))
    },
    async save(p) {
      const row = {
        name: p.name, start_date: p.startDate, end_date: p.endDate,
        opening_balance: p.openingBalance, dues_amount: p.duesAmount,
      }
      const q = p.id ? sb().from('periods').update(row).eq('id', p.id) : sb().from('periods').insert(row)
      return toPeriod(check(await q.select().single(), { 23505: 'Nama periode sudah dipakai.' }))
    },
    async remove(id) {
      mustAffect(check(await sb().from('periods').delete().eq('id', id).select('id'), {
        23503: 'Periode sudah memiliki pembayaran iuran sehingga tidak bisa dihapus.',
      }))
    },
  },

  members: {
    async list() { return check(await sb().from('members').select('*').order('name')).map(toMember) },
    async save(m) {
      const row = { name: m.name, nrp: m.nrp, year: Number(m.year), active: m.active }
      const q = m.id ? sb().from('members').update(row).eq('id', m.id) : sb().from('members').insert(row)
      return toMember(check(await q.select().single(), { 23505: 'NRP sudah terdaftar.' }))
    },
    async remove(id) {
      check(await sb().from('members').delete().eq('id', id), {
        23503: 'Anggota memiliki riwayat iuran sehingga tidak bisa dihapus. Ubah statusnya menjadi Nonaktif.',
      })
    },
  },

  transactions: {
    async list() {
      return check(await sb().from('transactions').select('*').order('date', { ascending: false }).order('id', { ascending: false })).map(toTx)
    },
    async create(t) {
      const row = { date: t.date, type: t.type, category: t.category, note: t.note, amount: t.amount, proof_path: t.proof ?? null }
      return toTx(check(await sb().from('transactions').insert(row).select().single()))
    },
    // Trigger transactions_guard_dues menolak perubahan transaksi otomatis dari iuran.
    async update(id, t) {
      const row = { date: t.date, type: t.type, category: t.category, note: t.note, amount: t.amount, proof_path: t.proof ?? null }
      return toTx(check(await sb().from('transactions').update(row).eq('id', id).select().single()))
    },
    async remove(id) {
      mustAffect(check(await sb().from('transactions').delete().eq('id', id).select('id')))
    },
  },

  proofs: {
    // Unggah berkas bukti ke bucket privat 'bukti'; yang disimpan di tabel hanya path-nya.
    async upload(file) {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`
      check(await sb().storage.from('bukti').upload(path, file, { contentType: file.type }))
      return path
    },
    async remove(path) { check(await sb().storage.from('bukti').remove([path])) },
    // URL sementara (1 jam) untuk melihat bukti, karena bucket tidak publik.
    async url(path) {
      return check(await sb().storage.from('bukti').createSignedUrl(path, 3600)).signedUrl
    },
  },

  receipts: {
    // Unggah foto nota lalu minta Edge Function `scan-nota` membacanya.
    // Setelah upload berhasil fungsi ini TIDAK melempar error, supaya bukti tetap bisa dipakai
    // untuk input manual: kegagalan scan dikembalikan sebagai `error` (kode, lihat lib/errors.js).
    async scan(file) {
      const proof = await supabaseRepo.proofs.upload(file)
      try {
        const { data, error } = await sb().functions.invoke('scan-nota', { body: { proof_path: proof }, timeout: SCAN_TIMEOUT_MS })
        if (error) return { proof, scanId: null, result: null, error: await scanErrorCode(error) }
        if (!data?.ok) return { proof, scanId: data?.scan_id ?? null, result: null, error: data?.code ?? 'ai_error' }
        return { proof, scanId: data.scan_id, result: data.data, error: null }
      } catch (e) {
        return { proof, scanId: null, result: null, error: /abort|timeout/i.test(String(e?.name || e?.message)) ? 'timeout' : 'network' }
      }
    },
    // Tautkan hasil scan ke transaksi yang akhirnya disimpan (untuk mengukur akurasi scan).
    async link(scanId, transactionId) {
      check(await sb().from('receipt_scans').update({ transaction_id: transactionId }).eq('id', scanId))
    },
  },

  dues: {
    async paidMemberIds(periodId) {
      return check(await sb().from('dues_payments').select('member_id').eq('period_id', periodId)).map((r) => r.member_id)
    },
    // Trigger di database otomatis membuat transaksi pemasukan 'Iuran anggota'.
    async markPaid(memberId, periodId) {
      check(await sb().from('dues_payments').insert({ member_id: memberId, period_id: periodId, paid_at: todayISO() }), {
        23505: 'Anggota ini sudah lunas pada periode tersebut.',
      })
    },
    // Membatalkan pembayaran juga menghapus transaksi pemasukannya (ON DELETE CASCADE).
    async unmarkPaid(memberId, periodId) {
      check(await sb().from('dues_payments').delete().eq('member_id', memberId).eq('period_id', periodId))
    },
  },
}
