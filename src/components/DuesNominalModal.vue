<script setup>
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const { currentPeriod, setDuesAmount } = useKas()

const amount = ref('')
const error = ref('')
const saving = ref(false)
watch(() => props.open, (open) => { if (open) { amount.value = String(currentPeriod.value?.duesAmount ?? ''); error.value = '' } })

async function submit() {
  const n = Number(amount.value)
  if (!(Number.isInteger(n) && n > 0)) { error.value = 'Nominal harus bilangan bulat lebih dari 0.'; return }
  saving.value = true
  try {
    await setDuesAmount(n)
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="Atur nominal iuran" width="300px" @close="emit('close')">
    <form novalidate @submit.prevent="submit">
      <div class="f">
        <label for="due-period">Periode</label>
        <input id="due-period" :value="currentPeriod?.name" disabled />
      </div>
      <div class="f">
        <label for="due-amount">Nominal per anggota (Rp)</label>
        <input id="due-amount" v-model="amount" type="number" min="0" inputmode="numeric" />
        <p v-if="error" class="f__err">{{ error }}</p>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn-sm btn-sm--gold btn-sm--lg" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
        <button type="button" class="btn-sm btn-sm--lg" @click="emit('close')">Batal</button>
      </div>
    </form>
  </AppModal>
</template>
