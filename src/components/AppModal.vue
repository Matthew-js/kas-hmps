<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, required: true },
  width: { type: String, default: '360px' },
})
const emit = defineEmits(['close'])

const onKey = (e) => { if (e.key === 'Escape' && props.open) emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('close')">
      <section class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width }">
        <h2 class="modal__title">{{ title }}</h2>
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(28 30 44 / 0.55); }
.modal { width: 100%; max-height: 92vh; overflow-y: auto; padding: 18px 20px 20px; background: var(--color-surface); border-radius: 12px; box-shadow: 0 20px 50px rgb(0 0 0 / 0.25); }
.modal__title { margin: 0 0 6px; padding-bottom: 8px; font: 700 14px var(--font-display); border-bottom: 1px solid var(--color-line); }
@media (max-width: 768px) {
  .overlay { align-items: flex-end; padding: 0; }
  .modal { max-width: none !important; border-radius: 16px 16px 0 0; padding: 20px 16px 24px; }
  .modal__title { font-size: 17px; }
}
</style>
