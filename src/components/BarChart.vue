<script setup>
import { computed } from 'vue'

// data: [{ label, income, expense }]
const props = defineProps({ data: { type: Array, required: true } })
const max = computed(() => Math.max(...props.data.flatMap((d) => [d.income, d.expense])))
const pct = (v) => `${(v / max.value) * 100}%`
</script>

<template>
  <div class="chart">
    <div class="chart__plot" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir">
      <div v-for="d in data" :key="d.label" class="group">
        <div class="group__bars">
          <span class="bar bar--income" :style="{ height: pct(d.income) }"></span>
          <span class="bar bar--expense" :style="{ height: pct(d.expense) }"></span>
        </div>
        <span class="group__label">{{ d.label }}</span>
      </div>
    </div>
    <ul class="legend">
      <li><i class="dot dot--income"></i>Pemasukan</li>
      <li><i class="dot dot--expense"></i>Pengeluaran</li>
    </ul>
  </div>
</template>

<style scoped>
.chart__plot { height: 150px; display: flex; justify-content: space-around; align-items: flex-end; padding-top: 12px; }
.group { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.group__bars { flex: 1; display: flex; align-items: flex-end; gap: 3px; }
.bar { width: 9px; border-radius: 2px; }
.bar--income { background: var(--color-income); }
.bar--expense { background: var(--color-expense); }
.group__label { font-size: 8px; color: var(--color-muted); }
.legend { margin: 18px 0 0; padding: 0; display: flex; gap: 20px; list-style: none; font-size: 8px; color: var(--color-muted); }
.legend li { display: flex; align-items: center; gap: 5px; }
.dot { width: 5px; height: 5px; border-radius: 50%; }
.dot--income { background: var(--color-income); }
.dot--expense { background: var(--color-expense); }
@media (max-width: 768px) {
  .chart__plot { height: 90px; }
  .bar { width: 6px; }
  .legend { display: none; }
}
</style>
