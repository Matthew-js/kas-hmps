// Store sederhana (in-memory). TODO: ganti dengan Supabase — API fungsinya bisa dipertahankan.
import { reactive, computed } from 'vue'

let seq = 100

const state = reactive({
  period: 'Agustus 2026',
  openingBalance: 3000000,
  duesAmount: 20000,
  transactions: [
    { id: 1, date: '2026-08-05', type: 'out', category: 'Konsumsi', note: 'Konsumsi acara', amount: 490000 },
    { id: 2, date: '2026-08-10', type: 'in', category: 'Iuran mingguan', note: 'Iuran periode Agustus (batch)', amount: 700000 },
    { id: 3, date: '2026-08-18', type: 'out', category: 'ATK', note: 'Kertas & spidol rapat', amount: 45000 },
    { id: 4, date: '2026-08-22', type: 'in', category: 'Sponsorship', note: 'Dana sponsor lomba coding', amount: 1000000 },
    { id: 5, date: '2026-08-26', type: 'out', category: 'Konsumsi', note: 'Snack rapat mingguan', amount: 85000 },
    { id: 6, date: '2026-08-28', type: 'in', category: 'Iuran mingguan', note: 'Iuran kas minggu ke-8', amount: 150000 },
  ],
  members: [
    { id: 1, name: 'Ahmad Fadillah', nrp: '5025221001', year: '2022', active: true },
    { id: 2, name: 'Siti Nurhaliza', nrp: '5025221014', year: '2022', active: true },
    { id: 3, name: 'Budi Santoso', nrp: '5025231027', year: '2023', active: true },
    { id: 4, name: 'Rina Wijaya', nrp: '5025231033', year: '2023', active: true },
    { id: 5, name: 'Dimas Pratama', nrp: '5025241009', year: '2024', active: false },
    { id: 6, name: 'Putri Ayu', nrp: '5025241022', year: '2024', active: true },
  ],
  paidIds: [1, 2, 4], // anggota yang sudah lunas di periode ini
})

const categories = {
  in: ['Iuran mingguan', 'Sponsorship', 'Lainnya'],
  out: ['Konsumsi', 'ATK', 'Lainnya'],
}
const allCategories = [...new Set([...categories.in, ...categories.out])]

const signed = (t) => (t.type === 'in' ? t.amount : -t.amount)
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id - a.id

const sorted = computed(() => [...state.transactions].sort(byDateDesc))
const totalIn = computed(() => state.transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0))
const totalOut = computed(() => state.transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0))
const closingBalance = computed(() => state.openingBalance + totalIn.value - totalOut.value)

// Saldo berjalan: urut lama → baru, ditampilkan baru → lama
const ledger = computed(() => {
  let balance = state.openingBalance
  return [...state.transactions]
    .sort((a, b) => -byDateDesc(a, b))
    .map((t) => ({ ...t, balance: (balance += signed(t)) }))
    .reverse()
})

const isPaid = (id) => state.paidIds.includes(id)

export function useKas() {
  return {
    state, categories, allCategories, sorted, ledger, totalIn, totalOut, closingBalance, isPaid,
    addTransaction(t) {
      state.transactions.push({ id: ++seq, date: new Date().toISOString().slice(0, 10), ...t })
    },
    saveMember(m) {
      if (m.id) Object.assign(state.members.find((x) => x.id === m.id), m)
      else state.members.push({ ...m, id: ++seq })
    },
    removeMember(id) {
      state.members = state.members.filter((m) => m.id !== id)
      state.paidIds = state.paidIds.filter((x) => x !== id)
    },
    markPaid(id) {
      if (!isPaid(id)) state.paidIds.push(id)
    },
    setDuesAmount(n) {
      state.duesAmount = n
    },
  }
}
