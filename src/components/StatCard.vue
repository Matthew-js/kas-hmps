<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  note: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }, // 'neutral' | 'income' | 'expense'
})
</script>

<template>
  <article class="stat">
    <p class="stat__label">{{ label }}</p>
    <p class="stat__value" :class="`stat__value--${tone}`">{{ value }}</p>
    <p class="stat__note">{{ note }}</p>
  </article>
</template>

<style scoped>
.stat { padding: 16px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; }
.stat p { margin: 0; }
.stat__label { font-size: 9px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--color-muted); }
.stat__value { margin-top: 6px; font: 600 22px var(--font-mono); }
.stat__value--income { color: var(--color-income); }
.stat__value--expense { color: var(--color-expense); }
.stat__note { margin-top: 4px; font-size: 10px; color: var(--color-muted); }
@media (max-width: 768px) {
  .stat { padding: 14px 16px; }
  .stat__value { font-size: 24px; }
}
</style>
