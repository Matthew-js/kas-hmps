<script setup>
import { computed } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import StatCard from '@/components/StatCard.vue'
import BarChart from '@/components/BarChart.vue'
import ArrearsList from '@/components/ArrearsList.vue'
import { useKas } from '@/stores/kas'
import { formatRupiah } from '@/utils/format'

const { currentPeriod, closingBalance, totalIn, totalOut, periodTransactions, arrears, monthlySeries } = useKas()
const countOf = (type) => periodTransactions.value.filter((t) => t.type === type).length
const arrearNames = computed(() => arrears.value.map((m) => m.name))
</script>

<template>
  <DashboardLayout>
    <header class="head">
      <h1 class="head__title">Dashboard</h1>
      <p class="head__sub">
        <span class="only-desktop">Ringkasan kas periode {{ currentPeriod?.name ?? '-' }}</span>
        <span class="only-mobile">Ringkasan · {{ currentPeriod?.name ?? '-' }}</span>
      </p>
    </header>

    <section class="stats">
      <StatCard label="Saldo akhir periode" :value="formatRupiah(closingBalance)" :note="`Saldo awal ${formatRupiah(currentPeriod?.openingBalance ?? 0)}`" tone="neutral" />
      <StatCard label="Pemasukan periode ini" :value="formatRupiah(totalIn)" :note="`${countOf('in')} transaksi`" tone="income" />
      <StatCard label="Pengeluaran periode ini" :value="formatRupiah(totalOut)" :note="`${countOf('out')} transaksi`" tone="expense" />
    </section>

    <section class="panels">
      <article class="panel">
        <h2 class="panel__title">
          <span class="only-desktop">Pemasukan vs pengeluaran (6 bulan)</span>
          <span class="only-mobile">Pemasukan vs pengeluaran</span>
        </h2>
        <BarChart :data="monthlySeries" />
      </article>
      <article class="panel">
        <h2 class="panel__title">Tunggakan iuran</h2>
        <ArrearsList :members="arrearNames" />
      </article>
    </section>
  </DashboardLayout>
</template>

<style scoped>
.head__title { margin: 0; font: 700 28px/1.2 var(--font-display); }
.head__sub { margin: 4px 0 0; font-size: 10px; color: var(--color-muted); }
.stats { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.panels { margin-top: 16px; display: grid; grid-template-columns: 2fr 1fr; gap: 12px; align-items: start; }
.panel { padding: 16px 18px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; }
.panel__title { margin: 0 0 12px; font: 700 12px var(--font-display); }
.only-mobile { display: none; }

@media (max-width: 768px) {
  .head__title { font-size: 22px; }
  .head__sub { font-size: 11px; }
  .stats { grid-template-columns: 1fr; gap: 12px; }
  .panels { grid-template-columns: 1fr; }
  .panel__title { font-size: 13px; }
  .only-desktop { display: none; }
  .only-mobile { display: inline; }
}
</style>
