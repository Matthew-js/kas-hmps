<script setup>
import AppModal from './AppModal.vue'

// Modal konfirmasi untuk aksi destruktif. Induk mengatur `busy` & `error` selama aksi berjalan.
defineProps({
  open: Boolean,
  title: { type: String, required: true },
  confirmLabel: { type: String, default: 'Hapus' },
  busyLabel: { type: String, default: 'Menghapus…' },
  busy: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'close'])
</script>

<template>
  <AppModal :open="open" :title="title" width="340px" @close="!busy && emit('close')">
    <div class="confirm__body"><slot /></div>
    <p v-if="error" class="f__err" role="alert" style="margin-top: 8px">{{ error }}</p>
    <div class="modal-actions">
      <button class="btn-sm btn-sm--gold btn-sm--lg" :disabled="busy" @click="emit('confirm')">{{ busy ? busyLabel : confirmLabel }}</button>
      <button class="btn-sm btn-sm--lg" :disabled="busy" @click="emit('close')">Batal</button>
    </div>
  </AppModal>
</template>

<style scoped>
.confirm__body { margin-top: 12px; font-size: 12px; line-height: 1.5; }
.confirm__body :deep(p) { margin: 0 0 8px; }
@media (max-width: 768px) { .confirm__body { font-size: 13px; } }
</style>
