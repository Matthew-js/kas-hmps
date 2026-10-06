// State & logika kas. Sumber data lewat repository (memori atau Supabase).
import { reactive, computed } from 'vue'
import { repo } from '@/repositories'
import { friendlyError } from '@/lib/errors'
import { todayISO } from '@/utils/format'

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
const categories = reactive({ in: [], out: [] })

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
    categories.in = cats.filter((c) => c.type === 'in').map((c) => c.name)
    categories.out = cats.filter((c) => c.type === 'out').map((c) => c.name)
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

    addTransaction: (t, file) => run(async () => {
      const proof = file ? await repo.proofs.upload(file) : null
      try {
        const row = await repo.transactions.create({ ...t, proof })
        state.transactions.push(row)
      } catch (e) {
        if (proof) await repo.proofs.remove(proof).catch(() => {}) // jangan tinggalkan file yatim
        throw e
      }
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
