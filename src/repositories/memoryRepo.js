// Implementasi repository di memori (data contoh). Dipakai untuk demo offline & unit test.
// Perilakunya meniru aturan database: NRP unik, bayar iuran → transaksi pemasukan, dst.
import { todayISO as today } from '@/utils/format'

let seq = 100
const clone = (x) => JSON.parse(JSON.stringify(x))
const fail = (message) => { throw new Error(message) }
const NOT_FOUND = 'Data tidak ditemukan atau Anda tidak memiliki izin.'
const isLocked = (c) => c.name === 'Iuran anggota' && c.type === 'in'
// Sama dengan trigger transactions_guard_dues di database.
const guardDuesTx = (t) => {
  if (t.duesPaymentId) fail('Transaksi ini dibuat otomatis dari iuran. Ubah atau batalkan lewat menu Iuran.')
}
const findCategory = (id) => db.categories.find((c) => c.id === id) ?? fail(NOT_FOUND)

const db = {
  categories: [
    { id: 1, name: 'Iuran anggota', type: 'in' }, { id: 2, name: 'Iuran mingguan', type: 'in' },
    { id: 3, name: 'Sponsorship', type: 'in' }, { id: 4, name: 'Lainnya', type: 'in' },
    { id: 5, name: 'Konsumsi', type: 'out' }, { id: 6, name: 'ATK', type: 'out' }, { id: 7, name: 'Lainnya', type: 'out' },
  ],
  periods: [{ id: 1, name: 'Agustus 2026', startDate: '2026-08-01', endDate: '2026-08-31', openingBalance: 3000000, duesAmount: 20000 }],
  members: [
    { id: 1, name: 'Ahmad Fadillah', nrp: '5025221001', year: '2022', active: true },
    { id: 2, name: 'Siti Nurhaliza', nrp: '5025221014', year: '2022', active: true },
    { id: 3, name: 'Budi Santoso', nrp: '5025231027', year: '2023', active: true },
    { id: 4, name: 'Rina Wijaya', nrp: '5025231033', year: '2023', active: true },
    { id: 5, name: 'Dimas Pratama', nrp: '5025241009', year: '2024', active: false },
    { id: 6, name: 'Putri Ayu', nrp: '5025241022', year: '2024', active: true },
  ],
  transactions: [
    { id: 1, date: '2026-08-05', type: 'out', category: 'Konsumsi', note: 'Konsumsi acara', amount: 490000 },
    { id: 2, date: '2026-08-10', type: 'in', category: 'Iuran mingguan', note: 'Iuran periode Agustus (batch)', amount: 700000 },
    { id: 3, date: '2026-08-18', type: 'out', category: 'ATK', note: 'Kertas & spidol rapat', amount: 45000 },
    { id: 4, date: '2026-08-22', type: 'in', category: 'Sponsorship', note: 'Dana sponsor lomba coding', amount: 1000000 },
    { id: 5, date: '2026-08-26', type: 'out', category: 'Konsumsi', note: 'Snack rapat mingguan', amount: 85000 },
    { id: 6, date: '2026-08-28', type: 'in', category: 'Iuran mingguan', note: 'Iuran kas minggu ke-8', amount: 150000 },
  ],
  duesPayments: [], // { id, memberId, periodId, amount }
  receiptScans: [], // { id, proof, transactionId }
}

// Demo: tambahkan periode bulan berjalan agar pembayaran iuran hari ini terlihat di laporan.
{
  const t = today()
  const [y, m] = t.split('-').map(Number)
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const name = `${BULAN[m - 1]} ${y}`
  if (!db.periods.some((p) => p.name === name)) {
    const last = new Date(y, m, 0).getDate()
    db.periods.unshift({ id: 2, name, startDate: `${t.slice(0, 7)}-01`, endDate: `${t.slice(0, 7)}-${last}`, openingBalance: 4230000, duesAmount: 20000 })
  }
}

let user = null

export const memoryRepo = {
  auth: {
    async getUser() { return user },
    // Mode memori: tidak ada kata sandi sungguhan; peran dipilih dari tombol login.
    async signIn(email, _password, roleHint = 'bendahara') { user = { id: 'local', email, roleHint }; return user },
    async signOut() { user = null },
    onChange() {},
    async getProfile() { return { id: 'local', full_name: user?.email, role: user?.roleHint ?? 'bendahara' } },
  },

  categories: {
    async list() { return clone(db.categories) },
    async create(c) {
      if (db.categories.some((x) => x.name === c.name && x.type === c.type)) fail('Nama kategori sudah ada untuk jenis ini.')
      const row = { id: ++seq, name: c.name, type: c.type }
      db.categories.push(row)
      return clone(row)
    },
    async rename(id, name) {
      const c = findCategory(id)
      if (isLocked(c)) fail('Kategori "Iuran anggota" dikunci karena dipakai otomatis oleh menu Iuran.')
      if (db.categories.some((x) => x.id !== id && x.name === name && x.type === c.type)) fail('Nama kategori sudah ada untuk jenis ini.')
      // Meniru FK on update cascade: transaksi ikut berganti nama kategori.
      db.transactions.forEach((t) => { if (t.category === c.name && t.type === c.type) t.category = name })
      c.name = name
      return clone(c)
    },
    async remove(id) {
      const c = findCategory(id)
      if (isLocked(c)) fail('Kategori "Iuran anggota" dikunci karena dipakai otomatis oleh menu Iuran.')
      if (db.transactions.some((t) => t.category === c.name && t.type === c.type)) fail('Kategori sudah dipakai transaksi sehingga tidak bisa dihapus.')
      db.categories = db.categories.filter((x) => x !== c)
    },
  },

  periods: {
    async list() { return clone(db.periods).sort((a, b) => b.startDate.localeCompare(a.startDate)) },
    async setDuesAmount(id, amount) {
      const p = db.periods.find((x) => x.id === id) ?? fail('Periode tidak ditemukan.')
      p.duesAmount = amount
      return clone(p)
    },
    async save(p) {
      if (db.periods.some((x) => x.id !== p.id && x.name === p.name)) fail('Nama periode sudah dipakai.')
      // Meniru exclusion constraint periods_no_overlap (rentang inklusif).
      if (db.periods.some((x) => x.id !== p.id && x.startDate <= p.endDate && p.startDate <= x.endDate)) {
        fail('Rentang tanggal tumpang tindih dengan periode lain.')
      }
      if (p.id) {
        const row = db.periods.find((x) => x.id === p.id) ?? fail(NOT_FOUND)
        Object.assign(row, p)
        return clone(row)
      }
      const row = { ...p, id: ++seq }
      db.periods.push(row)
      return clone(row)
    },
    async remove(id) {
      if (!db.periods.some((x) => x.id === id)) fail(NOT_FOUND)
      if (db.duesPayments.some((d) => d.periodId === id)) fail('Periode sudah memiliki pembayaran iuran sehingga tidak bisa dihapus.')
      db.periods = db.periods.filter((x) => x.id !== id)
    },
  },

  members: {
    async list() { return clone(db.members).sort((a, b) => a.name.localeCompare(b.name)) },
    async save(m) {
      if (db.members.some((x) => x.nrp === m.nrp && x.id !== m.id)) fail('NRP sudah terdaftar.')
      if (m.id) { Object.assign(db.members.find((x) => x.id === m.id), m); return clone(m) }
      const row = { ...m, id: ++seq }
      db.members.push(row)
      return clone(row)
    },
    async remove(id) {
      if (db.duesPayments.some((d) => d.memberId === id)) {
        fail('Anggota memiliki riwayat iuran sehingga tidak bisa dihapus. Ubah statusnya menjadi Nonaktif.')
      }
      db.members = db.members.filter((m) => m.id !== id)
    },
  },

  transactions: {
    async list() { return clone(db.transactions).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id) },
    async create(t) {
      const row = { id: ++seq, date: today(), ...t }
      db.transactions.push(row)
      return clone(row)
    },
    async update(id, t) {
      const row = db.transactions.find((x) => x.id === id) ?? fail(NOT_FOUND)
      guardDuesTx(row)
      Object.assign(row, t)
      return clone(row)
    },
    async remove(id) {
      const row = db.transactions.find((x) => x.id === id) ?? fail(NOT_FOUND)
      guardDuesTx(row)
      db.transactions = db.transactions.filter((x) => x !== row)
    },
  },

  proofs: {
    async upload(file) { return `lokal/${file.name}` }, // tidak benar-benar diunggah
    async remove() {},
    async url() { return null },
  },

  receipts: {
    // Mode demo: tidak memanggil AI; kembalikan nota tiruan setelah jeda singkat.
    // Kategori sengaja ber-confidence rendah agar sorotan "wajib dicek" bisa dicoba.
    async scan(file) {
      await new Promise((r) => setTimeout(r, 1200))
      const proof = `lokal/${file.name}`
      if (/gagal|blur|buram/i.test(file.name)) return { proof, scanId: null, result: null, error: 'unreadable' }
      const scanId = ++seq
      db.receiptScans.push({ id: scanId, proof, transactionId: null })
      return {
        proof, scanId, error: null,
        result: {
          date: today(), merchant: 'Indomaret Keputih', total: 47500,
          items: [{ name: 'Air mineral 600ml', qty: 10, price: 35000 }, { name: 'Roti tawar', qty: 1, price: 12500 }],
          category: 'Konsumsi',
          confidence: { date: 0.95, total: 0.92, category: 0.55 },
        },
      }
    },
    async link(scanId, transactionId) {
      const s = db.receiptScans.find((x) => x.id === scanId)
      if (s) s.transactionId = transactionId
    },
  },

  dues: {
    async paidMemberIds(periodId) { return db.duesPayments.filter((d) => d.periodId === periodId).map((d) => d.memberId) },
    async markPaid(memberId, periodId) {
      const member = db.members.find((m) => m.id === memberId)
      const period = db.periods.find((p) => p.id === periodId)
      if (!member?.active) fail('Anggota nonaktif tidak dapat membayar iuran')
      if (db.duesPayments.some((d) => d.memberId === memberId && d.periodId === periodId)) fail('Anggota ini sudah lunas pada periode tersebut.')
      const pay = { id: ++seq, memberId, periodId, amount: period.duesAmount }
      db.duesPayments.push(pay)
      db.transactions.push({ id: ++seq, date: today(), type: 'in', category: 'Iuran anggota', note: `Iuran ${member.name} – ${period.name}`, amount: pay.amount, duesPaymentId: pay.id })
    },
    async unmarkPaid(memberId, periodId) {
      const pay = db.duesPayments.find((d) => d.memberId === memberId && d.periodId === periodId)
      if (!pay) return
      db.duesPayments = db.duesPayments.filter((d) => d !== pay)
      db.transactions = db.transactions.filter((t) => t.duesPaymentId !== pay.id)
    },
  },
}
