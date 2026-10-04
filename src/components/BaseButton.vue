<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // 'primary' | 'secondary'
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <button class="btn" :class="`btn--${variant}`" :type="type" :disabled="loading">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  width: 100%;
  height: 44px;
  font: 600 14px var(--font-body);
  color: var(--color-ink);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: background-color 0.15s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--primary { background: var(--color-gold); border-color: var(--color-gold); }
.btn--primary:hover:not(:disabled) { background: var(--color-gold-hover); }
.btn--secondary { background: var(--color-surface); border-color: var(--color-border); }
.btn--secondary:hover:not(:disabled) { background: #faf7f0; }
</style>
