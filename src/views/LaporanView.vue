<script setup>
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import StatCard from '@/components/StatCard.vue'
import { useKas } from '@/stores/kas'
import { formatRupiah, formatNumber, formatDate } from '@/utils/format'

const { currentPeriod, openingBalance, ledger, totalIn, totalOut, closingBalance } = useKas()

// Nilai CSV di-escape: tanda kutip digandakan dan selalu diapit kutip (aman untuk koma/kutip di keterangan).
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportExcel() {
  const lines = [['Tanggal', 'Kategori', 'Uraian', 'Masuk', 'Keluar', 'Saldo']]
  lines.push(['', '', 'Saldo awal', '', '', openingBalance.value])
  ;[...ledger.value].reverse().forEach((t) =>
    lines.push([t.date, t.category, t.note, t.type === 'in' ? t.amount : '', t.type === 'out' ? t.amount : '', t.balance]),
  )
  lines.push(['', '', 'Total', totalIn.value, totalOut.value, closingBalance.value])
  const blob = new Blob(['\ufeff' + lines.map((l) => l.map(csv).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const name = `laporan-kas-${(currentPeriod.value?.name ?? 'periode').toLowerCase().replace(/\s+/g, '-')}.csv`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
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
        <p class="page-sub">Rekap periode {{ currentPeriod?.name ?? '-' }}</p>
      </div>
      <div class="actions export">
        <button class="btn-sm" @click="exportPdf">Export PDF</button>
        <button class="btn-sm" @click="exportExcel">Export Excel</button>
      </div>
    </header>

    <section class="stats">
      <StatCard label="Saldo awal" :value="formatRupiah(openingBalance)" />
      <StatCard label="Total pemasukan" :value="formatRupiah(totalIn)" tone="income" />
      <StatCard label="Total pengeluaran" :value="formatRupiah(totalOut)" tone="expense" />
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
.stats { margin-top: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
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
