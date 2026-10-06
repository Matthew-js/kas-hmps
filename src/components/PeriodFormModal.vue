<script setup>
import { reactive, ref, computed, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'
import { formatRupiah, formatDate } from '@/utils/format'

// `period` diisi → mode edit; kosong → tambah periode baru.
const props = defineProps({ open: Boolean, period: { type: Object, default: null } })
const emit = defineEmits(['close'])
const { state, savePeriod, closingBalanceOf } = useKas()

const form = reactive({ name: '', startDate: '', endDate: '', duesAmount: '', openingBalance: '' })
const errors = reactive({ name: '', startDate: '', endDate: '', duesAmount: '', openingBalance: '' })
const saving = ref(false)
const saveError = ref('')
const openingTouched = ref(false) // saldo awal sudah diubah manual → jangan ditimpa otomatis

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Periode sebelumnya = periode lain yang berakhir paling akhir sebelum tanggal mulai.
const previous = computed(() =>
  state.periods
    .filter((p) => p.id !== props.period?.id && form.startDate && p.endDate < form.startDate)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null,
)
const previousClosing = computed(() => (previous.value ? closingBalanceOf(previous.value) : null))

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(errors, { name: '', startDate: '', endDate: '', duesAmount: '', openingBalance: '' })
  saveError.value = ''
  const p = props.period
  if (p) {
    Object.assign(form, { name: p.name, startDate: p.startDate, endDate: p.endDate, duesAmount: String(p.duesAmount), openingBalance: String(p.openingBalance) })
    openingTouched.value = true
    return
  }
  // Usulan default: mulai sehari setelah periode terakhir, sampai akhir bulan tersebut.
  const last = [...state.periods].sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  const start = last ? new Date(`${last.endDate}T00:00:00`) : new Date()
  if (last) start.setDate(start.getDate() + 1)
  else start.setDate(1)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  Object.assign(form, { name: '', startDate: iso(start), endDate: iso(end), duesAmount: String(last?.duesAmount ?? ''), openingBalance: '' })
  openingTouched.value = false
  fillOpening()
}, { immediate: true })

function fillOpening() {
  if (!openingTouched.value) form.openingBalance = previousClosing.value === null ? '0' : String(previousClosing.value)
}
watch(previousClosing, fillOpening)

const isInt = (v) => v !== '' && Number.isInteger(Number(v))

async function submit() {
  errors.name = form.name.trim() ? '' : 'Nama periode wajib diisi.'
  errors.startDate = form.startDate ? '' : 'Tanggal mulai wajib diisi.'
  errors.endDate = !form.endDate ? 'Tanggal selesai wajib diisi.' : form.endDate < form.startDate ? 'Tanggal selesai tidak boleh sebelum tanggal mulai.' : ''
  errors.duesAmount = isInt(form.duesAmount) && Number(form.duesAmount) > 0 ? '' : 'Nominal iuran harus bilangan bulat lebih dari 0.'
  errors.openingBalance = isInt(form.openingBalance) ? '' : 'Saldo awal harus bilangan bulat.'
  if (Object.values(errors).some(Boolean)) return
  saving.value = true
  saveError.value = ''
  try {
    await savePeriod({
      id: props.period?.id,
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      duesAmount: Number(form.duesAmount),
      openingBalance: Number(form.openingBalance),
    })
    emit('close')
  } catch (e) {
    if (/tumpang tindih/.test(e.message)) errors.startDate = e.message
    else if (/Nama periode/.test(e.message)) errors.name = e.message
    else saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" :title="period ? 'Edit periode' : 'Tambah periode'" width="380px" @close="emit('close')">
    <form novalidate @submit.prevent="submit">
      <div class="f">
        <label for="per-name">Nama periode</label>
        <input id="per-name" v-model="form.name" type="text" placeholder="Contoh: November 2026" />
        <p v-if="errors.name" class="f__err">{{ errors.name }}</p>
      </div>
      <div class="f-row">
        <div class="f">
          <label for="per-start">Tanggal mulai</label>
          <input id="per-start" v-model="form.startDate" type="date" />
        </div>
        <div class="f">
          <label for="per-end">Tanggal selesai</label>
          <input id="per-end" v-model="form.endDate" type="date" :min="form.startDate || undefined" />
        </div>
      </div>
      <p v-if="errors.startDate" class="f__err" style="margin-top: 5px">{{ errors.startDate }}</p>
      <p v-if="errors.endDate" class="f__err" style="margin-top: 5px">{{ errors.endDate }}</p>
      <div class="f">
        <label for="per-dues">Nominal iuran per anggota (Rp)</label>
        <input id="per-dues" v-model="form.duesAmount" type="number" min="1" inputmode="numeric" />
        <p v-if="errors.duesAmount" class="f__err">{{ errors.duesAmount }}</p>
      </div>
      <div class="f">
        <label for="per-open">Saldo awal (Rp)</label>
        <input id="per-open" v-model="form.openingBalance" type="number" inputmode="numeric" @input="openingTouched = true" />
        <p v-if="errors.openingBalance" class="f__err">{{ errors.openingBalance }}</p>
        <p class="hint">
          <template v-if="previous">
            Saldo akhir {{ previous.name }} ({{ formatDate(previous.endDate) }}): <strong>{{ formatRupiah(previousClosing) }}</strong>{{ previousClosing < 0 ? ' (minus)' : '' }}.
            <button v-if="openingTouched && String(previousClosing) !== form.openingBalance" type="button" class="hint__link" @click="openingTouched = false; fillOpening()">Pakai nilai ini</button>
          </template>
          <template v-else>Tidak ada periode sebelum tanggal mulai; isi saldo kas saat ini.</template>
        </p>
      </div>
      <p v-if="saveError" class="f__err" role="alert" style="margin-top: 10px">{{ saveError }}</p>
      <div class="modal-actions">
        <button type="submit" class="btn-sm btn-sm--gold btn-sm--lg" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
        <button type="button" class="btn-sm btn-sm--lg" @click="emit('close')">Batal</button>
      </div>
    </form>
  </AppModal>
</template>

<style scoped>
.hint { margin: 0; font-size: 10px; line-height: 1.5; color: var(--color-muted); }
.hint strong { color: var(--color-ink); }
.hint__link { padding: 0; font: 600 10px var(--font-body); color: var(--color-gold-hover); background: none; border: 0; text-decoration: underline; cursor: pointer; }
@media (max-width: 768px) { .hint, .hint__link { font-size: 11px; } }
</style>
