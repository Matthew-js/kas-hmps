<script setup>
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const { state, setDuesAmount } = useKas()

const amount = ref('')
const error = ref('')
watch(() => props.open, (open) => { if (open) { amount.value = String(state.duesAmount); error.value = '' } })

function submit() {
  if (!(Number(amount.value) > 0)) { error.value = 'Nominal harus lebih dari 0.'; return }
  setDuesAmount(Number(amount.value))
  emit('close')
}
</script>

<template>
  <AppModal :open="open" title="Atur nominal iuran" width="300px" @close="emit('close')">
    <form novalidate @submit.prevent="submit">
      <div class="f">
        <label for="due-period">Periode</label>
        <select id="due-period"><option>{{ state.period }}</option></select>
      </div>
      <div class="f">
        <label for="due-amount">Nominal per anggota (Rp)</label>
        <input id="due-amount" v-model="amount" type="number" min="0" inputmode="numeric" />
        <p v-if="error" class="f__err">{{ error }}</p>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn-sm btn-sm--gold btn-sm--lg">Simpan</button>
        <button type="button" class="btn-sm btn-sm--lg" @click="emit('close')">Batal</button>
      </div>
    </form>
  </AppModal>
</template>
