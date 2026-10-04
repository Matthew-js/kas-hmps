<script setup>
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import StatCard from '@/components/StatCard.vue'
import { useKas } from '@/stores/kas'
import { formatRupiah, formatNumber, formatDate } from '@/utils/format'

const { state, ledger, totalIn, closingBalance } = useKas()

function exportExcel() {
  const lines = [['Tanggal', 'Uraian', 'Masuk', 'Keluar', 'Saldo']]
  ;[...ledger.value].reverse().forEach((t) =>
    lines.push([t.date, `"${t.note}"`, t.type === 'in' ? t.amount : '', t.type === 'out' ? t.amount : '', t.balance]),
  )
  const blob = new Blob(['\ufeff' + lines.map((l) => l.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'laporan-kas.csv' })
  a.click()
  URL.revokeObjectURL(a.href)
}
const exportPdf = () => window.print() // pilih "Simpan sebagai PDF" di dialog cetak
const signedNumber = (t) => `${t.type === 'in' ? '+' : '-'}${formatNumber(t.amount)}`
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Laporan Keuangan</h1>
        <p class="page-sub">Rekap periode {{ state.period }}</p>
      </div>
      <div class="actions export">
        <button class="btn-sm" @click="exportPdf">Export PDF</button>
        <button class="btn-sm" @click="exportExcel">Export Excel</button>
      </div>
    </header>

    <section class="stats">
      <StatCard label="Saldo awal" :value="formatRupiah(state.openingBalance)" />
      <StatCard label="Total pemasukan" :value="formatRupiah(totalIn)" tone="income" />
      <StatCard label="Saldo akhir" :value="formatRupiah(closingBalance)" />
    </section>

    <section class="panel-white ledger">
      <h2 class="ledger__title">Saldo berjalan</h2>

      <table class="table only-desktop">
        <thead><tr><th>Tanggal</th><th>Uraian</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          <tr v-for="t in ledger" :key="t.id">
            <td class="mono">{{ formatDate(t.date, true) }}</td>
            <td>{{ t.note }}</td>
            <td class="num mono in">{{ t.type === 'in' ? formatNumber(t.amount) : '—' }}</td>
            <td class="num mono out">{{ t.type === 'out' ? formatNumber(t.amount) : '—' }}</td>
            <td class="num mono">{{ formatNumber(t.balance) }}</td>
          </tr>
        </tbody>
      </table>

      <ul class="rows only-mobile">
        <li v-for="t in ledger" :key="t.id">
          <div>
            <p><span class="mono muted">{{ formatDate(t.date, true) }}</span>&nbsp; {{ t.note }}</p>
            <p class="muted small">Saldo: {{ formatNumber(t.balance) }}</p>
          </div>
          <span class="mono" :class="t.type">{{ signedNumber(t) }}</span>
        </li>
      </ul>
    </section>
  </DashboardLayout>
</template>

<style scoped>
.stats { margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.ledger { margin-top: 16px; padding-top: 14px; }
.ledger__title { margin: 0; font: 700 12px var(--font-display); }
.rows { margin: 8px 0 0; padding: 0; list-style: none; }
.rows li { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 11px; border-bottom: 1px solid var(--color-line); }
.rows li:last-child { border-bottom: 0; }
.rows p { margin: 0; }
.small { margin-top: 3px !important; font-size: 10px; }
@media (max-width: 768px) {
  .export { width: 100%; }
  .export .btn-sm { flex: 1; height: 40px; font-size: 13px; }
  .stats { grid-template-columns: 1fr; gap: 12px; margin-top: 14px; }
  .ledger__title { font-size: 14px; }
}
</style>
