<script setup>
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'

// `category` diisi → ganti nama; kosong → tambah kategori baru dengan jenis `type`.
const props = defineProps({
  open: Boolean,
  category: { type: Object, default: null },
  type: { type: String, default: 'in' },
})
const emit = defineEmits(['close'])
const { saveCategory } = useKas()

const name = ref('')
const error = ref('')
const saving = ref(false)
const typeLabel = (t) => (t === 'in' ? 'Pemasukan' : 'Pengeluaran')

watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.category?.name ?? ''
  error.value = ''
})

async function submit() {
  const n = name.value.trim()
  if (!n) { error.value = 'Nama kategori wajib diisi.'; return }
  if (props.category && n === props.category.name) { emit('close'); return }
  saving.value = true
  error.value = ''
  try {
    await saveCategory({ id: props.category?.id, name: n, type: props.category?.type ?? props.type })
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" :title="category ? 'Ganti nama kategori' : 'Tambah kategori'" width="320px" @close="emit('close')">
    <form novalidate @submit.prevent="submit">
      <div class="f">
        <label for="cat-type">Jenis</label>
        <input id="cat-type" :value="typeLabel(category?.type ?? type)" disabled />
      </div>
      <div class="f">
        <label for="cat-name">Nama kategori</label>
        <input id="cat-name" v-model="name" type="text" maxlength="40" placeholder="Contoh: Transportasi" />
        <p v-if="error" class="f__err" role="alert">{{ error }}</p>
      </div>
      <p v-if="category" class="hint">Transaksi yang memakai kategori ini ikut berganti nama.</p>
      <div class="modal-actions">
        <button type="submit" class="btn-sm btn-sm--gold btn-sm--lg" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
        <button type="button" class="btn-sm btn-sm--lg" @click="emit('close')">Batal</button>
      </div>
    </form>
  </AppModal>
</template>

<style scoped>
.hint { margin: 8px 0 0; font-size: 10px; color: var(--color-muted); }
@media (max-width: 768px) { .hint { font-size: 11px; } }
</style>
