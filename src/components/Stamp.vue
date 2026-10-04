<script setup>
defineProps({
  text: { type: String, required: true },
  tone: { type: String, default: 'unpaid' }, // 'paid' | 'unpaid'
})
</script>

<template>
  <span class="stamp" :class="`stamp--${tone}`" :aria-label="text">{{ text }}</span>
</template>

<style scoped>
.stamp { display: inline-grid; place-items: center; width: 26px; height: 26px; border: 1.5px solid currentColor; border-radius: 50%; outline: 1px dotted currentColor; outline-offset: -4px; font: 700 5px var(--font-body); transform: rotate(-12deg); }
.stamp--paid { color: var(--color-income); }
.stamp--unpaid { color: var(--color-expense); }
@media (max-width: 768px) { .stamp { width: 28px; height: 28px; } }
</style>
