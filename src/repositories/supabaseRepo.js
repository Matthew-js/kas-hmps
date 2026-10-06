// Implementasi repository memakai Supabase (PostgreSQL + Auth + Storage).
import { getSupabase } from '@/lib/supabase'
import { rethrow } from '@/lib/errors'
import { todayISO } from '@/utils/format'

const sb = () => getSupabase()
const check = ({ data, error }, overrides) => { if (error) rethrow(error, overrides); return data }

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
    async list() { return check(await sb().from('categories').select('name, type').order('id')) },
  },

  periods: {
    async list() {
      return check(await sb().from('periods').select('*').order('start_date', { ascending: false })).map(toPeriod)
    },
    async setDuesAmount(id, amount) {
      return toPeriod(check(await sb().from('periods').update({ dues_amount: amount }).eq('id', id).select().single()))
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
