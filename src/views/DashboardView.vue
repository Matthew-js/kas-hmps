<script setup>
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import StatCard from '@/components/StatCard.vue'
import BarChart from '@/components/BarChart.vue'
import ArrearsList from '@/components/ArrearsList.vue'

// TODO: ganti dengan data dari Supabase
const chartData = [
  { label: 'Mar', income: 3.2, expense: 2.1 },
  { label: 'Apr', income: 4.2, expense: 1.6 },
  { label: 'Mei', income: 2.7, expense: 2.9 },
  { label: 'Jun', income: 4.8, expense: 2.4 },
  { label: 'Jul', income: 3.7, expense: 1.8 },
  { label: 'Agu', income: 5.0, expense: 1.7 },
]
const arrears = ['Budi Santoso', 'Dimas Pratama', 'Putri Ayu']
</script>

<template>
  <DashboardLayout role="Bendahara">
    <header class="head">
      <h1 class="head__title">Dashboard</h1>
      <p class="head__sub">
        <span class="only-desktop">Ringkasan kas per 30 Agustus 2026</span>
        <span class="only-mobile">Ringkasan kas · 30 Agu 2026</span>
      </p>
    </header>

    <section class="stats">
      <StatCard label="Saldo saat ini" value="Rp 4.230.000" note="Terakhir diperbarui hari ini" tone="neutral" />
      <StatCard label="Pemasukan bulan ini" value="Rp 1.850.000" note="12 transaksi" tone="income" />
      <StatCard label="Pengeluaran bulan ini" value="Rp 620.000" note="5 transaksi" tone="expense" />
    </section>

    <section class="panels">
      <article class="panel">
        <h2 class="panel__title">
          <span class="only-desktop">Pemasukan vs pengeluaran (6 bulan)</span>
          <span class="only-mobile">Pemasukan vs pengeluaran</span>
        </h2>
        <BarChart :data="chartData" />
      </article>
      <article class="panel">
        <h2 class="panel__title">Tunggakan iuran</h2>
        <ArrearsList :members="arrears" />
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
