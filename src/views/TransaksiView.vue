<script setup>
import { ref, computed, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useKas } from '@/stores/kas'
import { useAuth } from '@/stores/auth'
import { formatRupiah, formatDate } from '@/utils/format'

const PER_PAGE = 8
const { sorted, allCategories, proofUrl, removeTransaction, scanReceipt } = useKas()
const { isBendahara } = useAuth()

async function openProof(path) {
  try {
    const url = await proofUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else alert('Mode demo: bukti tidak benar-benar diunggah.')
  } catch (e) {
    alert(e.message)
  }
}
const query = ref('')
const category = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const showForm = ref(false)
const editing = ref(null)
const deleting = ref(null)
const deleteError = ref('')
const busy = ref(false)

const scan = ref(null) // { proof, scanId, result, error } hasil Scan Nota untuk mengisi form
const scanning = ref(false)
const scanError = ref('')
const scanInput = ref(null)

const openForm = (t = null) => { editing.value = t; scan.value = null; showForm.value = true }

// Scan Nota: kompres → unggah → baca → buka form terisi. Tidak pernah menyimpan transaksi.
async function onScanFile(e) {
  const file = e.target.files[0]
  e.target.value = '' // agar foto yang sama bisa dipilih lagi
  if (!file) return
  scanning.value = true
  scanError.value = ''
  try {
    const res = await scanReceipt(file)
    editing.value = null
    scan.value = res
    showForm.value = true
  } catch (err) {
    // Gagal sebelum/saat unggah (foto rusak, >2MB, jaringan): belum ada bukti, isi manual dari awal.
    scanError.value = `${err.message} Silakan coba lagi atau catat transaksi secara manual.`
  } finally {
    scanning.value = false
  }
}
const askDelete = (t) => { deleting.value = t; deleteError.value = '' }
async function confirmDelete() {
  busy.value = true
  deleteError.value = ''
  try {
    await removeTransaction(deleting.value.id)
    deleting.value = null
  } catch (e) {
    deleteError.value = e.message
  } finally {
    busy.value = false
  }
}
const resetDates = () => { dateFrom.value = ''; dateTo.value = '' }

const filtered = computed(() =>
  sorted.value.filter((t) =>
    (!category.value || t.category === category.value) &&
    (!dateFrom.value || t.date >= dateFrom.value) &&
    (!dateTo.value || t.date <= dateTo.value) &&
    (!query.value || `${t.note} ${t.category}`.toLowerCase().includes(query.value.toLowerCase())),
  ),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const rows = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
watch([query, category, dateFrom, dateTo], () => { page.value = 1 })

const amountText = (t) => `${t.type === 'in' ? '+' : '−'} ${formatRupiah(t.amount)}`
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Transaksi</h1>
        <p class="page-sub">Catatan pemasukan &amp; pengeluaran kas</p>
      </div>
      <span v-if="isBendahara" class="actions only-desktop">
        <button class="btn-sm btn-sm--lg" :disabled="scanning" @click="scanInput.click()">{{ scanning ? 'Membaca nota…' : 'Scan nota' }}</button>
        <button class="btn-sm btn-sm--gold btn-sm--lg" @click="openForm()">+ Catat transaksi</button>
      </span>
      <button v-if="isBendahara" class="btn-sm btn-sm--block only-mobile scan-mobile" :disabled="scanning" @click="scanInput.click()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
        {{ scanning ? 'Membaca nota…' : 'Scan nota' }}
      </button>
      <input v-if="isBendahara" ref="scanInput" type="file" accept="image/jpeg,image/png" capture="environment" hidden @change="onScanFile" />
    </header>
    <p v-if="scanError" class="f__err" role="alert" style="margin-top: 12px">{{ scanError }}</p>

    <div class="toolbar">
      <input v-model="query" class="input-sm" type="search" placeholder="Cari transaksi..." aria-label="Cari transaksi" />
      <select v-model="category" class="input-sm" aria-label="Filter kategori">
        <option value="">Semua kategori</option>
        <option v-for="c in allCategories" :key="c" :value="c">{{ c }}</option>
      </select>
      <div class="range" role="group" aria-label="Rentang tanggal">
        <input v-model="dateFrom" class="input-sm" type="date" :max="dateTo || undefined" aria-label="Dari tanggal" />
        <span class="range__sep">–</span>
        <input v-model="dateTo" class="input-sm" type="date" :min="dateFrom || undefined" aria-label="Sampai tanggal" />
        <button v-if="dateFrom || dateTo" class="btn-sm range__clear" aria-label="Hapus filter tanggal" @click="resetDates">✕</button>
      </div>
    </div>

    <p v-if="!filtered.length" class="empty">Belum ada transaksi yang cocok.</p>

    <template v-else>
      <div class="panel-white only-desktop">
        <table class="table">
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="num">Nominal</th><th v-if="isBendahara" class="num">Aksi</th></tr></thead>
          <tbody>
            <tr v-for="t in rows" :key="t.id">
              <td class="mono">{{ formatDate(t.date) }}</td>
              <td>{{ t.category }}</td>
              <td>
                {{ t.note }}
                <button v-if="t.proof" class="link" @click="openProof(t.proof)">bukti</button>
              </td>
              <td class="num mono" :class="t.type">{{ amountText(t) }}</td>
              <td v-if="isBendahara" class="num">
                <RouterLink v-if="t.duesPaymentId" to="/iuran" class="auto" title="Ubah atau batalkan lewat menu Iuran">Otomatis dari iuran</RouterLink>
                <span v-else class="actions" style="justify-content: flex-end">
                  <button class="btn-sm" @click="openForm(t)">Edit</button>
                  <button class="btn-sm" @click="askDelete(t)">Hapus</button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="card-list only-mobile">
        <li v-for="t in rows" :key="t.id" class="card-item">
          <div>
            <p class="card-item__title">{{ t.category }}</p>
            <p class="card-item__meta">{{ t.note }}</p>
            <p class="card-item__meta">
              {{ formatDate(t.date) }}
              <button v-if="t.proof" class="link" @click="openProof(t.proof)">bukti</button>
            </p>
          </div>
          <div class="card-side">
            <span class="mono" :class="t.type" style="font-size: 12px">{{ amountText(t) }}</span>
            <template v-if="isBendahara">
              <RouterLink v-if="t.duesPaymentId" to="/iuran" class="auto">Otomatis dari iuran</RouterLink>
              <span v-else class="actions">
                <button class="btn-sm" @click="openForm(t)">Edit</button>
                <button class="btn-sm" @click="askDelete(t)">Hapus</button>
              </span>
            </template>
          </div>
        </li>
      </ul>

      <div v-if="pages > 1" class="pager">
        <button class="btn-sm" :disabled="page === 1" @click="page--">Sebelumnya</button>
        <span>{{ page }} / {{ pages }}</span>
        <button class="btn-sm" :disabled="page === pages" @click="page++">Berikutnya</button>
      </div>
    </template>

    <button v-if="isBendahara" class="fab only-mobile" aria-label="Catat transaksi" @click="openForm()">+</button>
    <TransactionFormModal :open="showForm" :transaction="editing" :scan="scan" @close="showForm = false; scan = null" />

    <Teleport to="body">
      <div v-if="scanning" class="scan-overlay" role="status" aria-live="polite">
        <div class="scan-overlay__box">
          <span class="spinner" aria-hidden="true"></span>
          <strong>Membaca nota…</strong>
          <small>Biasanya 5–15 detik, maksimal 30 detik.</small>
        </div>
      </div>
    </Teleport>

    <ConfirmModal :open="!!deleting" title="Hapus transaksi?" :busy="busy" :error="deleteError" @confirm="confirmDelete" @close="deleting = null">
      <p>
        <strong>{{ deleting?.note }}</strong> ({{ deleting && amountText(deleting) }}, {{ deleting && formatDate(deleting.date) }}) akan dihapus dari buku kas.
      </p>
      <p v-if="deleting?.proof">Berkas bukti transaksinya juga ikut dihapus.</p>
      <p class="muted">Aksi ini tidak dapat dibatalkan.</p>
    </ConfirmModal>
  </DashboardLayout>
</template>

<style scoped>
.link { margin-left: 6px; padding: 0; font: 600 10px var(--font-body); color: var(--color-gold-hover); background: none; border: 0; text-decoration: underline; cursor: pointer; }
.fab { position: fixed; right: 20px; bottom: 76px; width: 44px; height: 44px; font-size: 24px; color: var(--color-ink); background: var(--color-gold); border: 0; border-radius: 50%; box-shadow: 0 4px 12px rgb(0 0 0 / 0.2); cursor: pointer; }
.auto { display: inline-block; padding: 2px 8px; font: 600 9px var(--font-body); color: var(--color-muted); text-decoration: none; white-space: nowrap; background: var(--color-page); border: 1px solid var(--color-border); border-radius: 999px; }
.auto:hover { color: var(--color-ink); border-color: var(--color-gold); }
.range { display: flex; align-items: center; gap: 6px; }
.toolbar .range .input-sm { width: 130px; }
.range__sep { font-size: 11px; color: var(--color-muted); }
.range__clear { width: 30px; height: 30px; padding: 0; }
.scan-mobile { display: flex; align-items: center; justify-content: center; gap: 8px; }
.scan-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgb(28 30 44 / 0.55); }
.scan-overlay__box { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 28px; text-align: center; background: var(--color-surface); border-radius: 14px; }
.scan-overlay__box strong { font-size: 14px; }
.scan-overlay__box small { font-size: 11px; color: var(--color-muted); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--color-border); border-top-color: var(--color-gold); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.card-side { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
@media (max-width: 768px) {
  .toolbar { flex-wrap: wrap; }
  .toolbar > .input-sm { flex: 1 1 140px; width: auto; min-width: 0; height: 36px; font-size: 13px; }
  .range { flex: 1 1 100%; }
  .toolbar .range .input-sm { flex: 1; width: auto; min-width: 0; height: 36px; font-size: 13px; }
  .range__clear { width: 36px; height: 36px; flex: none; }
  .card-item > div:first-child { min-width: 0; }
}
</style>
