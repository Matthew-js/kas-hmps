<script setup>
import { reactive, ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'

const props = defineProps({ open: Boolean, member: { type: Object, default: null } })
const emit = defineEmits(['close'])
const { saveMember } = useKas()

const form = reactive({ name: '', nrp: '', year: '', active: true })
const errors = reactive({ name: '', nrp: '', year: '' })
const saving = ref(false)
const saveError = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, props.member ?? { id: undefined, name: '', nrp: '', year: '', active: true })
  Object.assign(errors, { name: '', nrp: '', year: '' })
  saveError.value = ''
})

async function submit() {
  errors.name = form.name.trim() ? '' : 'Nama wajib diisi.'
  errors.nrp = /^\d{10}$/.test(form.nrp) ? '' : 'NRP harus 10 digit angka.'
  errors.year = /^\d{4}$/.test(form.year) ? '' : 'Angkatan harus 4 digit (mis. 2024).'
  if (errors.name || errors.nrp || errors.year) return
  saving.value = true
  saveError.value = ''
  try {
    await saveMember({ ...form, name: form.name.trim() })
    emit('close')
  } catch (e) {
    if (/NRP/.test(e.message)) errors.nrp = e.message
    else saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" :title="member ? 'Edit anggota' : 'Tambah anggota'" width="340px" @close="emit('close')">
    <form novalidate @submit.prevent="submit">
      <div class="f">
        <label for="m-name">Nama</label>
        <input id="m-name" v-model="form.name" type="text" />
        <p v-if="errors.name" class="f__err">{{ errors.name }}</p>
      </div>
      <div class="f-row">
        <div class="f">
          <label for="m-nrp">NRP</label>
          <input id="m-nrp" v-model="form.nrp" type="text" inputmode="numeric" maxlength="10" />
          <p v-if="errors.nrp" class="f__err">{{ errors.nrp }}</p>
        </div>
        <div class="f">
          <label for="m-year">Angkatan</label>
          <input id="m-year" v-model="form.year" type="text" inputmode="numeric" maxlength="4" />
          <p v-if="errors.year" class="f__err">{{ errors.year }}</p>
        </div>
      </div>
      <div class="f">
        <label for="m-status">Status</label>
        <select id="m-status" v-model="form.active">
          <option :value="true">Aktif</option>
          <option :value="false">Nonaktif</option>
        </select>
      </div>
      <p v-if="saveError" class="f__err" style="margin-top: 10px">{{ saveError }}</p>
      <div class="modal-actions">
        <button type="submit" class="btn-sm btn-sm--gold btn-sm--lg" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
        <button type="button" class="btn-sm btn-sm--lg" @click="emit('close')">Batal</button>
      </div>
    </form>
  </AppModal>
</template>
