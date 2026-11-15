// State & logika kas. Sumber data lewat repository (memori atau Supabase).
import { reactive, computed } from 'vue'
import { repo } from '@/repositories'
import { friendlyError } from '@/lib/errors'
import { todayISO } from '@/utils/format'
import { compressImage } from '@/utils/image'

const state = reactive({
  ready: false,       // data awal sudah dimuat
  loading: false,
  error: '',
  periods: [],
  periodId: null,     // periode yang sedang dilihat
  members: [],
  transactions: [],
  paidIds: [],        // anggota yang sudah lunas di periode terpilih
})
const categories = reactive({ in: [], out: [], rows: [] }) // rows: { id, name, type } untuk halaman Periode

const signed = (t) => (t.type === 'in' ? t.amount : -t.amount)
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id - a.id

const currentPeriod = computed(() => state.periods.find((p) => p.id === state.periodId) ?? null)
const allCategories = computed(() => [...new Set([...categories.in, ...categories.out])])
const sorted = computed(() => [...state.transactions].sort(byDateDesc))

// Transaksi di dalam rentang tanggal periode terpilih
const periodTransactions = computed(() => {
  const p = currentPeriod.value
  if (!p) return []
  return state.transactions.filter((t) => t.date >= p.startDate && t.date <= p.endDate)
})
const openingBalance = computed(() => currentPeriod.value?.openingBalance ?? 0)
const totalIn = computed(() => periodTransactions.value.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0))
const totalOut = computed(() => periodTransactions.value.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0))
const closingBalance = computed(() => openingBalance.value + totalIn.value - totalOut.value)

// Saldo berjalan: urut lama → baru, ditampilkan baru → lama
const ledger = computed(() => {
  let balance = openingBalance.value
  return [...periodTransactions.value]
    .sort((a, b) => -byDateDesc(a, b))
    .map((t) => ({ ...t, balance: (balance += signed(t)) }))
    .reverse()
})

const paidSet = computed(() => new Set(state.paidIds))
const isPaid = (id) => paidSet.value.has(id)
const activeMembers = computed(() => state.members.filter((m) => m.active))
const arrears = computed(() => activeMembers.value.filter((m) => !isPaid(m.id)))

// Pemasukan & pengeluaran per bulan, 6 bulan terakhir s.d. akhir periode terpilih (untuk grafik dashboard)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const monthlySeries = computed(() => {
  const end = new Date(`${currentPeriod.value?.endDate ?? todayISO()}T00:00:00`)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(end.getFullYear(), end.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rows = state.transactions.filter((t) => t.date.startsWith(key))
    const sum = (type) => rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
    return { label: MONTHS[d.getMonth()], income: sum('in'), expense: sum('out') }
  })
})

function setCategories(rows) {
  categories.rows = rows
  categories.in = rows.filter((c) => c.type === 'in').map((c) => c.name)
  categories.out = rows.filter((c) => c.type === 'out').map((c) => c.name)
}
const byStartDesc = (a, b) => b.startDate.localeCompare(a.startDate)

// Saldo akhir sembarang periode: saldo awal + pemasukan − pengeluaran di rentang tanggalnya.
function closingBalanceOf(p) {
  return state.transactions
    .filter((t) => t.date >= p.startDate && t.date <= p.endDate)
    .reduce((s, t) => s + signed(t), p.openingBalance)
}

// Hapus berkas bukti tanpa menggagalkan aksi utama (data sudah tersimpan).
const dropProof = (path) => (path ? repo.proofs.remove(path).catch(() => {}) : null)

async function refreshTransactions() { state.transactions = await repo.transactions.list() }
async function refreshPaid() { state.paidIds = state.periodId ? await repo.dues.paidMemberIds(state.periodId) : [] }

// Jalankan aksi; ubah error teknis menjadi pesan ramah lalu lempar ke komponen pemanggil.
async function run(fn) {
  try { return await fn() } catch (e) { throw new Error(friendlyError(e)) }
}

export async function loadKas() {
  state.loading = true
  state.error = ''
  try {
    const [cats, periods, members, transactions] = await Promise.all([
      repo.categories.list(), repo.periods.list(), repo.members.list(), repo.transactions.list(),
    ])
    setCategories(cats)
    state.periods = periods
    state.members = members
    state.transactions = transactions
    if (!periods.some((p) => p.id === state.periodId)) state.periodId = periods[0]?.id ?? null
    await refreshPaid()
    state.ready = true
  } catch (e) {
    state.error = friendlyError(e)
  } finally {
    state.loading = false
  }
}

export function resetKas() {
  Object.assign(state, { ready: false, loading: false, error: '', periods: [], periodId: null, members: [], transactions: [], paidIds: [] })
}

export function useKas() {
  return {
    state, categories, allCategories, currentPeriod, sorted, ledger, openingBalance,
    totalIn, totalOut, closingBalance, periodTransactions, isPaid, activeMembers, arrears, monthlySeries,
    load: loadKas,

    // opts.proofPath = bukti yang sudah diunggah sebelumnya (hasil Scan Nota);
    // opts.scanId = id receipt_scans yang ditautkan setelah transaksi tersimpan.
    addTransaction: (t, file, { proofPath = null, scanId = null } = {}) => run(async () => {
      const uploaded = file ? await repo.proofs.upload(file) : null
      const proof = uploaded ?? proofPath
      let row
      try {
        row = await repo.transactions.create({ ...t, proof })
        state.transactions.push(row)
      } catch (e) {
        await dropProof(uploaded) // jangan tinggalkan file yatim
        throw e
      }
      if (uploaded && proofPath) await dropProof(proofPath) // foto scan diganti berkas lain
      // Penautan scan hanya untuk statistik akurasi; kegagalannya tidak membatalkan transaksi.
      if (scanId) await repo.receipts.link(scanId, row.id).catch(() => {})
      return row
    }),
    // Kompres → unggah → baca nota. Tidak pernah menyimpan transaksi.
    // Hasil: { proof, scanId, result, error } — error berupa kode (lib/errors.js → scanErrorMessage).
    scanReceipt: (file) => run(async () => repo.receipts.scan(await compressImage(file))),
    discardProof: (path) => dropProof(path),
    // Transaksi lain dengan nominal & tanggal sama (peringatan duplikat sebelum Simpan).
    findDuplicates: (amount, date, exceptId = null) =>
      state.transactions.filter((t) => t.amount === amount && t.date === date && t.id !== exceptId),
    // opts.file = bukti baru (mengganti yang lama); opts.removeProof = hapus bukti tanpa pengganti.
    // Berkas lama baru dihapus dari Storage setelah update di database berhasil.
    updateTransaction: (id, t, { file = null, removeProof = false } = {}) => run(async () => {
      const old = state.transactions.find((x) => x.id === id)
      const uploaded = file ? await repo.proofs.upload(file) : null
      const proof = uploaded ?? (removeProof ? null : old?.proof ?? null)
      let row
      try {
        row = await repo.transactions.update(id, { ...t, proof })
      } catch (e) {
        await dropProof(uploaded)
        throw e
      }
      const i = state.transactions.findIndex((x) => x.id === id)
      if (i >= 0) state.transactions[i] = row
      if (old?.proof && old.proof !== proof) await dropProof(old.proof)
    }),
    removeTransaction: (id) => run(async () => {
      const old = state.transactions.find((x) => x.id === id)
      await repo.transactions.remove(id)
      state.transactions = state.transactions.filter((x) => x.id !== id)
      await dropProof(old?.proof)
    }),
    proofUrl: (path) => run(() => repo.proofs.url(path)),

    saveMember: (m) => run(async () => {
      const row = await repo.members.save(m)
      const i = state.members.findIndex((x) => x.id === row.id)
      if (i >= 0) state.members[i] = row
      else state.members.push(row)
    }),
    removeMember: (id) => run(async () => {
      await repo.members.remove(id)
      state.members = state.members.filter((m) => m.id !== id)
    }),

    closingBalanceOf,
    savePeriod: (p) => run(async () => {
      const row = await repo.periods.save(p)
      const i = state.periods.findIndex((x) => x.id === row.id)
      if (i >= 0) state.periods[i] = row
      else state.periods.push(row)
      state.periods.sort(byStartDesc)
      if (!state.periodId) { state.periodId = row.id; await refreshPaid() }
    }),
    removePeriod: (id) => run(async () => {
      await repo.periods.remove(id)
      state.periods = state.periods.filter((p) => p.id !== id)
      if (state.periodId === id) { state.periodId = state.periods[0]?.id ?? null; await refreshPaid() }
    }),

    // Ganti nama kategori ikut mengubah transaksi (FK on update cascade), jadi transaksi dimuat ulang.
    saveCategory: (c) => run(async () => {
      if (c.id) await repo.categories.rename(c.id, c.name)
      else await repo.categories.create(c)
      const [rows] = await Promise.all([repo.categories.list(), c.id ? refreshTransactions() : null])
      setCategories(rows)
    }),
    removeCategory: (id) => run(async () => {
      await repo.categories.remove(id)
      setCategories(categories.rows.filter((c) => c.id !== id))
    }),

    setPeriod: (id) => run(async () => { state.periodId = id; await refreshPaid() }),
    setDuesAmount: (amount) => run(async () => {
      const p = await repo.periods.setDuesAmount(state.periodId, amount)
      Object.assign(currentPeriod.value, p)
    }),
    // Tandai lunas → database otomatis mencatat pemasukan, jadi transaksi dimuat ulang.
    markPaid: (memberId) => run(async () => {
      await repo.dues.markPaid(memberId, state.periodId)
      await Promise.all([refreshPaid(), refreshTransactions()])
    }),
    unmarkPaid: (memberId) => run(async () => {
      await repo.dues.unmarkPaid(memberId, state.periodId)
      await Promise.all([refreshPaid(), refreshTransactions()])
    }),
  }
}
