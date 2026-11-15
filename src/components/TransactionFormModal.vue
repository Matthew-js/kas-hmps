<script setup>
import { reactive, ref, computed, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useKas } from '@/stores/kas'
import { scanErrorMessage } from '@/lib/errors'
import { formatRupiah, formatDate, todayISO as today } from '@/utils/format'

// `transaction` diisi → mode edit; kosong → catat transaksi baru.
// `scan` diisi ({ proof, scanId, result, error } dari scanReceipt) → form terisi dari hasil Scan Nota.
// Form ini tidak pernah menyimpan sendiri: transaksi baru dibuat hanya saat pengguna menekan Simpan.
const props = defineProps({
  open: Boolean,
  transaction: { type: Object, default: null },
  scan: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])
const { categories, addTransaction, updateTransaction, proofUrl, findDuplicates, discardProof, closingBalance, currentPeriod } = useKas()
const isEdit = computed(() => !!props.transaction)

const LOW_CONFIDENCE = 0.7
const needsCheck = reactive({ amount: false, date: false, category: false }) // sorotan kuning "wajib dicek"
const duplicates = ref([]) // transaksi lain dengan nominal & tanggal sama; ditampilkan sebelum Simpan
const scanProofUsed = ref(false) // foto scan dipakai sebagai bukti transaksi yang tersimpan

const blank = () => ({ type: 'in', category: '', amount: '', date: today(), note: '', proof: null })
const form = reactive(blank())
const errors = reactive({ category: '', amount: '', date: '', note: '', proof: '' })
const proofFile = ref(null) // objek File asli, diunggah saat Simpan
const saving = ref(false)
const saveError = ref('')
const proofSize = ref(0)
const dragging = ref(false)
const fileInput = ref(null)
const keptProof = ref(null) // path bukti lama di Storage (mode edit) selama tidak dihapus/diganti

// 'Iuran anggota' dicatat otomatis dari menu Iuran, jadi tidak ditawarkan di form manual.
const categoryOptions = computed(() => categories[form.type].filter((c) => c !== 'Iuran anggota'))
// Saldo akhir periode berjalan seandainya transaksi ini disimpan (hanya untuk peringatan, tidak memblokir).
// Mode edit: efek nominal lama dikeluarkan dulu agar tidak terhitung dua kali.
const projectedBalance = computed(() => {
  const amount = Number(form.amount)
  if (form.type !== 'out' || !(amount > 0)) return null
  const p = currentPeriod.value
  const inPeriod = (d) => p && d >= p.startDate && d <= p.endDate
  const old = props.transaction
  const oldEffect = old && inPeriod(old.date) ? (old.type === 'in' ? old.amount : -old.amount) : 0
  return closingBalance.value - oldEffect - amount
})
const amountPreview = computed(() => (Number(form.amount) > 0 ? formatRupiah(Number(form.amount)) : ''))
const proofSizeText = computed(() =>
  proofSize.value < 1024 * 1024
    ? `${Math.max(1, Math.round(proofSize.value / 1024))} KB`
    : `${(proofSize.value / 1024 / 1024).toFixed(1)} MB`,
)

// "Indomaret – Air mineral, Roti tawar +2 lainnya"
function scanNote({ merchant, items }) {
  const names = (items ?? []).map((i) => i.name)
  const list = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} lainnya` : '')
  return [merchant, list].filter(Boolean).join(' – ')
}

watch(() => props.open, (open) => {
  if (!open) return
  const t = props.transaction
  const r = props.scan?.result
  if (t) Object.assign(form, { type: t.type, category: t.category, amount: String(t.amount), date: t.date, note: t.note, proof: null })
  else if (r) Object.assign(form, { type: 'out', category: r.category ?? '', amount: r.total ? String(r.total) : '', date: r.date ?? today(), note: scanNote(r), proof: null })
  else Object.assign(form, { ...blank(), type: props.scan ? 'out' : 'in' })
  keptProof.value = t?.proof ?? props.scan?.proof ?? null
  const low = (field, conf) => !!r && (r[field] === null || (conf ?? 0) < LOW_CONFIDENCE)
  Object.assign(needsCheck, { amount: low('total', r?.confidence?.total), date: low('date', r?.confidence?.date), category: low('category', r?.confidence?.category) })
  duplicates.value = []
  scanProofUsed.value = false
  Object.assign(errors, { category: '', amount: '', date: '', note: '', proof: '' })
  proofSize.value = 0
  proofFile.value = null
  saveError.value = ''
})
// Kosongkan kategori hanya jika tidak tersedia di jenis yang baru (agar mode edit tidak kehilangan kategorinya).
watch(() => form.type, () => { if (!categoryOptions.value.includes(form.category)) form.category = '' })

function pickFile(file) {
  errors.proof = ''
  dragging.value = false
  if (!file) return
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) errors.proof = 'Format harus JPG, PNG, atau PDF.'
  else if (file.size > 2 * 1024 * 1024) errors.proof = 'Ukuran file maksimal 2MB.'
  else { form.proof = file.name; proofSize.value = file.size; proofFile.value = file }
}

function clearFile() {
  form.proof = null
  proofFile.value = null
  proofSize.value = 0
  errors.proof = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function viewKeptProof() {
  try {
    const url = await proofUrl(keptProof.value)
    if (url) window.open(url, '_blank', 'noopener')
    else saveError.value = 'Mode demo: bukti tidak benar-benar diunggah.'
  } catch (e) {
    saveError.value = e.message
  }
}

// Semua jalur tutup lewat sini: foto scan yang tidak dipakai dihapus dari Storage agar tidak menjadi berkas yatim.
function close() {
  if (saving.value) return
  if (props.scan?.proof && !scanProofUsed.value) discardProof(props.scan.proof)
  emit('close')
}

const isScanProof = computed(() => !!props.scan?.proof && keptProof.value === props.scan.proof)
watch(() => [form.amount, form.date], () => { duplicates.value = [] })

async function submit() {
  errors.category = form.category ? '' : 'Pilih kategori.'
  errors.amount = Number.isInteger(Number(form.amount)) && Number(form.amount) > 0 ? '' : 'Nominal harus bilangan bulat lebih dari 0.'
  errors.date = form.date && form.date <= today() ? '' : 'Tanggal wajib diisi dan tidak boleh di masa depan.'
  errors.note = form.note.trim() ? '' : 'Keterangan wajib diisi.'
  if (errors.category || errors.amount || errors.date || errors.note || errors.proof) return
  if (needsCheck.amount || needsCheck.date || needsCheck.category) {
    saveError.value = 'Periksa dulu kolom yang disorot kuning: ubah nilainya atau tekan “Sudah benar”.'
    return
  }
  // Peringatan duplikat: klik Simpan pertama hanya menampilkan peringatan, klik kedua menyimpan.
  if (!duplicates.value.length) {
    const dup = findDuplicates(Number(form.amount), form.date, props.transaction?.id ?? null)
    if (dup.length) { duplicates.value = dup; saveError.value = ''; return }
  }
  saving.value = true
  saveError.value = ''
  try {
    const data = { type: form.type, category: form.category, amount: Number(form.amount), date: form.date, note: form.note.trim() }
    if (isEdit.value) {
      await updateTransaction(props.transaction.id, data, { file: proofFile.value, removeProof: !keptProof.value })
    } else {
      await addTransaction(data, proofFile.value, { proofPath: keptProof.value, scanId: props.scan?.scanId ?? null })
      // Foto scan tetap dipakai kecuali dihapus/diganti; jika diganti, store sudah menghapusnya.
      scanProofUsed.value = !!props.scan?.proof && (isScanProof.value || !!proofFile.value)
    }
    emit('saved')
    saving.value = false
    close()
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" :title="isEdit ? 'Edit transaksi' : scan ? 'Catat dari scan nota' : 'Catat transaksi baru'" width="440px" @close="close">
    <form class="tx" :class="`tx--${form.type}`" novalidate @submit.prevent="submit">
      <div v-if="scan?.result" class="banner banner--scan" role="status">
        <strong>Hasil scan otomatis — periksa nominal, tanggal, dan kategori</strong>
        <span>Belum ada yang disimpan. Kolom bersorot kuning wajib dicek sebelum menekan Simpan.</span>
      </div>
      <div v-else-if="scan?.error" class="banner banner--fail" role="alert">
        <strong>Scan nota gagal</strong>
        <span>{{ scanErrorMessage(scan.error) }}</span>
      </div>

      <!-- Jenis transaksi -->
      <div class="seg" role="radiogroup" aria-label="Jenis transaksi">
        <button type="button" role="radio" :aria-checked="form.type === 'in'" class="seg__item seg__item--in" :class="{ 'is-on': form.type === 'in' }" @click="form.type = 'in'">
          <span class="seg__icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7 7 17M7 8v9h9" /></svg></span>
          <span class="seg__text"><strong>Pemasukan</strong><small>Uang masuk ke kas</small></span>
        </button>
        <button type="button" role="radio" :aria-checked="form.type === 'out'" class="seg__item seg__item--out" :class="{ 'is-on': form.type === 'out' }" @click="form.type = 'out'">
          <span class="seg__icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg></span>
          <span class="seg__text"><strong>Pengeluaran</strong><small>Uang keluar dari kas</small></span>
        </button>
      </div>

      <!-- Kartu nominal -->
      <div class="amount" :class="{ 'is-check': needsCheck.amount }">
        <label for="tx-amount" class="amount__label">{{ form.type === 'in' ? 'Nominal pemasukan' : 'Nominal pengeluaran' }}</label>
        <div class="amount__row">
          <span class="amount__rp">Rp</span>
          <input id="tx-amount" v-model="form.amount" class="amount__input" type="number" min="0" inputmode="numeric" placeholder="0" @input="needsCheck.amount = false" />
        </div>
        <p class="amount__hint">{{ amountPreview || 'Masukkan jumlah dalam rupiah' }}</p>
        <p v-if="projectedBalance !== null && projectedBalance < 0" class="warn" role="status">Pengeluaran ini membuat saldo menjadi {{ formatRupiah(projectedBalance) }}.</p>
        <p v-if="needsCheck.amount" class="check">Wajib dicek <button type="button" class="check__ok" @click="needsCheck.amount = false">Sudah benar</button></p>
      </div>
      <p v-if="errors.amount" class="err">{{ errors.amount }}</p>

      <!-- Kategori -->
      <div class="block" :class="{ 'is-check': needsCheck.category }">
        <span id="tx-cat-label" class="lbl">Kategori</span>
        <div class="chips" role="radiogroup" aria-labelledby="tx-cat-label">
          <button
            v-for="c in categoryOptions" :key="c" type="button" role="radio"
            class="chip" :class="{ 'is-on': form.category === c }" :aria-checked="form.category === c"
            @click="form.category = c; needsCheck.category = false"
          >{{ c }}</button>
        </div>
        <p v-if="needsCheck.category" class="check">Wajib dicek{{ form.category ? '' : ' — kategori tidak terbaca, pilih salah satu' }} <button v-if="form.category" type="button" class="check__ok" @click="needsCheck.category = false">Sudah benar</button></p>
        <p v-if="errors.category" class="err">{{ errors.category }}</p>
      </div>

      <!-- Tanggal -->
      <div class="block" :class="{ 'is-check': needsCheck.date }">
        <label for="tx-date" class="lbl">Tanggal</label>
        <input id="tx-date" v-model="form.date" class="field" type="date" :max="today()" @input="needsCheck.date = false" />
        <p v-if="needsCheck.date" class="check">Wajib dicek{{ scan?.result?.date ? '' : ' — tanggal tidak terbaca, diisi hari ini' }} <button type="button" class="check__ok" @click="needsCheck.date = false">Sudah benar</button></p>
        <p v-if="errors.date" class="err">{{ errors.date }}</p>
      </div>

      <!-- Keterangan -->
      <div class="block">
        <label for="tx-note" class="lbl">Keterangan</label>
        <input id="tx-note" v-model="form.note" class="field" type="text" placeholder="Contoh: iuran kas minggu ke-9" />
        <p v-if="errors.note" class="err">{{ errors.note }}</p>
      </div>

      <!-- Bukti transaksi -->
      <div class="block">
        <span class="lbl">Bukti transaksi <em>opsional</em></span>
        <div v-if="keptProof && !form.proof" class="file file--kept">
          <span class="file__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
          </span>
          <span class="file__info">
            <strong>{{ keptProof.split('/').pop() }}</strong>
            <small>{{ isScanProof ? 'Foto nota hasil scan' : 'Bukti tersimpan' }} · <button type="button" class="file__link" @click="viewKeptProof">lihat</button> · <label class="file__link">ganti<input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden @change="pickFile($event.target.files[0])" /></label></small>
          </span>
          <button type="button" class="file__remove" aria-label="Hapus bukti" title="Hapus bukti" @click="keptProof = null">✕</button>
        </div>
        <div v-else-if="form.proof" class="file">
          <span class="file__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
          </span>
          <span class="file__info"><strong>{{ form.proof }}</strong><small>{{ proofSizeText }} · {{ isEdit && transaction?.proof ? 'menggantikan bukti lama' : 'siap diunggah' }}</small></span>
          <button type="button" class="file__remove" aria-label="Batalkan file" @click="clearFile">✕</button>
        </div>
        <label
          v-else class="drop" :class="{ 'is-drag': dragging }"
          @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="pickFile($event.dataTransfer.files[0])"
        >
          <span class="drop__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
          </span>
          <span class="drop__title">Klik atau seret file ke sini</span>
          <span class="drop__tags"><b>JPG</b><b>PNG</b><b>PDF</b><b>Maks 2MB</b></span>
          <input ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.pdf" hidden @change="pickFile($event.target.files[0])" />
        </label>
        <p v-if="errors.proof" class="err">{{ errors.proof }}</p>
        <p v-if="isEdit && transaction?.proof && !keptProof && !form.proof" class="hint">
          Bukti lama akan dihapus saat disimpan. <button type="button" class="file__link" @click="keptProof = transaction.proof">Urungkan</button>
        </p>
      </div>

      <div v-if="duplicates.length" class="banner banner--dup" role="alert">
        <strong>Kemungkinan transaksi ganda</strong>
        <span>Sudah ada {{ duplicates.length }} transaksi {{ formatRupiah(Number(form.amount)) }} pada {{ formatDate(form.date) }}:</span>
        <ul><li v-for="d in duplicates.slice(0, 3)" :key="d.id">{{ d.note }} ({{ d.category }})</li></ul>
        <span>Tekan “Tetap simpan” jika memang transaksi berbeda.</span>
      </div>
      <p v-if="saveError" class="err" role="alert">{{ saveError }}</p>
      <div class="actions-row">
        <button type="submit" class="btn-save" :disabled="saving">{{ saving ? 'Menyimpan…' : duplicates.length ? 'Tetap simpan' : 'Simpan' }}</button>
        <button type="button" class="btn-cancel" :disabled="saving" @click="close">Batal</button>
      </div>
    </form>
  </AppModal>
</template>

<style scoped>
.tx { --accent: var(--color-income); --accent-soft: #eaf3ec; display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
.tx--out { --accent: var(--color-expense); --accent-soft: #fbeceb; }

/* Jenis transaksi: segmented card */
.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.seg__item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left; color: var(--color-muted); background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: 12px; cursor: pointer; transition: border-color 0.15s, background-color 0.15s; }
.seg__icon { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--color-page); }
.seg__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.seg__text strong { font: 600 12px var(--font-body); color: var(--color-ink); }
.seg__text small { font: 400 9px var(--font-body); }
.seg__item--in.is-on { background: #eaf3ec; border-color: var(--color-income); }
.seg__item--in.is-on .seg__icon { background: var(--color-income); color: #fff; }
.seg__item--out.is-on { background: #fbeceb; border-color: var(--color-expense); }
.seg__item--out.is-on .seg__icon { background: var(--color-expense); color: #fff; }

/* Kartu nominal */
.amount { padding: 14px 16px 12px; background: var(--color-page); border: 1px solid var(--color-border); border-top: 3px solid var(--accent); border-radius: 14px; }
.amount__label { display: block; font: 600 9px var(--font-body); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); }
.amount__row { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
.amount__rp { font: 600 16px var(--font-mono); color: var(--accent); }
.amount__input { flex: 1; min-width: 0; padding: 0; font: 600 34px/1.1 var(--font-mono); color: var(--accent); background: transparent; border: 0; outline: 0; -moz-appearance: textfield; }
.amount__input::-webkit-outer-spin-button, .amount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.amount__input::placeholder { color: #c9c2b2; }
.amount:focus-within { box-shadow: 0 0 0 3px rgb(201 157 60 / 0.2); }
.amount__hint { margin: 6px 0 0; font: 400 10px var(--font-body); color: var(--color-muted); }

.block { display: flex; flex-direction: column; gap: 7px; }
.lbl { font: 600 11px var(--font-body); }
.lbl em { margin-left: 4px; font: 400 10px var(--font-body); font-style: normal; color: var(--color-muted); }
.err { margin: 0; font-size: 10px; color: var(--color-danger); }

/* Kategori: chip */
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 7px 14px; font: 500 12px var(--font-body); color: var(--color-ink); background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: 999px; cursor: pointer; transition: all 0.15s; }
.chip:hover { border-color: var(--color-gold); }
.chip.is-on { color: var(--color-ink); font-weight: 600; background: #f7ecd2; border-color: var(--color-gold); }

.field { width: 100%; height: 40px; padding: 0 12px; font: 400 13px var(--font-body); color: var(--color-ink); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; }
.field:focus { outline: none; border-color: var(--color-gold); box-shadow: 0 0 0 3px rgb(201 157 60 / 0.2); }

/* Upload */
.drop { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 12px; text-align: center; background: #fcfaf5; border: 1.5px dashed #d9cfb6; border-radius: 12px; cursor: pointer; transition: all 0.15s; }
.drop:hover, .drop.is-drag { background: #f7ecd2; border-color: var(--color-gold); }
.drop__icon { display: grid; place-items: center; width: 36px; height: 36px; color: var(--color-gold); background: #f7ecd2; border-radius: 50%; }
.drop__title { font: 600 12px var(--font-body); }
.drop__tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
.drop__tags b { padding: 2px 7px; font: 500 9px var(--font-body); color: var(--color-muted); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 999px; }
.file { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--color-surface); border: 1.5px solid var(--color-income); border-radius: 12px; }
.file__icon { flex: none; display: grid; place-items: center; width: 32px; height: 32px; color: var(--color-income); background: #eaf3ec; border-radius: 8px; }
.file__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.file__info strong { overflow: hidden; font: 600 12px var(--font-body); text-overflow: ellipsis; white-space: nowrap; }
.file__info small { font: 400 10px var(--font-body); color: var(--color-muted); }
.file__remove { flex: none; width: 24px; height: 24px; font-size: 11px; color: var(--color-muted); background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.file__remove:hover { background: var(--color-page); }
.file--kept { border-color: var(--color-border); }
.file__link { padding: 0; font: 600 10px var(--font-body); color: var(--color-gold-hover); background: none; border: 0; text-decoration: underline; cursor: pointer; }
.hint { margin: 0; font-size: 10px; color: var(--color-muted); }

/* Scan nota: banner & sorotan kolom yang wajib dicek */
.banner { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; font-size: 11px; line-height: 1.45; border-radius: 10px; }
.banner strong { font-size: 12px; }
.banner ul { margin: 2px 0; padding-left: 18px; }
.banner--scan, .banner--dup { color: #6b4e00; background: #fdf3d3; border: 1px solid #ecd28a; }
.banner--fail { color: var(--color-danger); background: #fbeceb; border: 1px solid #efc9c5; }
.is-check { padding: 10px; margin: -4px; background: #fdf3d3; border-radius: 12px; box-shadow: inset 0 0 0 1.5px #e3b743; }
.amount.is-check { margin: 0; padding: 14px 16px 12px; border-color: #e3b743; }
.warn { margin: 8px 0 0; padding: 6px 10px; font: 600 10px/1.4 var(--font-body); color: #6b4e00; background: #fdf3d3; border: 1px solid #ecd28a; border-radius: 8px; }
.check { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0 0; font: 600 10px var(--font-body); color: #8a6400; }
.check__ok { padding: 3px 10px; font: 600 10px var(--font-body); color: var(--color-ink); background: var(--color-surface); border: 1px solid #e3b743; border-radius: 999px; cursor: pointer; }

/* Aksi */
.actions-row { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-top: 4px; }
.btn-save, .btn-cancel { height: 44px; font: 600 14px var(--font-body); color: var(--color-ink); border-radius: 10px; cursor: pointer; }
.btn-save { background: var(--color-gold); border: 1px solid var(--color-gold); }
.btn-save:hover { background: var(--color-gold-hover); }
.btn-cancel { background: var(--color-surface); border: 1px solid var(--color-border); }
.btn-cancel:hover { background: #faf7f0; }

@media (max-width: 768px) {
  .seg__text strong { font-size: 13px; }
  .seg__text small { font-size: 10px; }
  .amount__input { font-size: 32px; }
  .field { height: 44px; font-size: 16px; }
  .chip { padding: 8px 16px; font-size: 13px; }
  .lbl { font-size: 12px; }
  .banner, .check, .check__ok, .warn { font-size: 12px; }
  .banner strong { font-size: 13px; }
}
@media (max-width: 380px) {
  .seg { grid-template-columns: 1fr; }
}
</style>