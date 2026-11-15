<script setup>
import { ref, computed } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PeriodFormModal from '@/components/PeriodFormModal.vue'
import CategoryFormModal from '@/components/CategoryFormModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useKas } from '@/stores/kas'
import { useAuth } from '@/stores/auth'
import { formatRupiah, formatDate } from '@/utils/format'

const { state, categories, closingBalanceOf, removePeriod, removeCategory } = useKas()
const { isBendahara } = useAuth()

const LOCKED = 'Iuran anggota'
const isLocked = (c) => c.name === LOCKED && c.type === 'in'
const groups = computed(() => [
  { type: 'in', label: 'Pemasukan', rows: categories.rows.filter((c) => c.type === 'in') },
  { type: 'out', label: 'Pengeluaran', rows: categories.rows.filter((c) => c.type === 'out') },
])
const range = (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`

// ----- Periode -----
const showPeriod = ref(false)
const editingPeriod = ref(null)
const openPeriod = (p = null) => { editingPeriod.value = p; showPeriod.value = true }

// ----- Kategori -----
const showCategory = ref(false)
const editingCategory = ref(null)
const newCategoryType = ref('in')
const openCategory = (c = null, type = 'in') => { editingCategory.value = c; newCategoryType.value = type; showCategory.value = true }

// ----- Konfirmasi hapus (periode atau kategori) -----
const deleting = ref(null) // { kind: 'period' | 'category', item }
const deleteError = ref('')
const busy = ref(false)
const askDelete = (kind, item) => { deleting.value = { kind, item }; deleteError.value = '' }
async function confirmDelete() {
  busy.value = true
  deleteError.value = ''
  try {
    const { kind, item } = deleting.value
    await (kind === 'period' ? removePeriod(item.id) : removeCategory(item.id))
    deleting.value = null
  } catch (e) {
    deleteError.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Periode &amp; Kategori</h1>
        <p class="page-sub">Periode iuran, saldo awal, dan kategori transaksi</p>
      </div>
      <template v-if="isBendahara">
        <button class="btn-sm btn-sm--gold btn-sm--lg only-desktop" @click="openPeriod()">+ Tambah periode</button>
        <button class="btn-sm btn-sm--gold btn-sm--block only-mobile" @click="openPeriod()">+ Tambah periode</button>
      </template>
    </header>

    <!-- ===== Periode ===== -->
    <h2 class="section-title">Periode</h2>
    <p v-if="!state.periods.length" class="empty">Belum ada periode.{{ isBendahara ? ' Klik “Tambah periode” untuk memulai.' : '' }}</p>

    <template v-else>
      <div class="panel-white only-desktop">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th><th>Rentang</th><th class="num">Iuran</th><th class="num">Saldo awal</th><th class="num">Saldo akhir</th>
              <th v-if="isBendahara" class="num">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in state.periods" :key="p.id">
              <td>{{ p.name }} <span v-if="p.id === state.periodId" class="pill">Dipilih</span></td>
              <td class="mono">{{ range(p) }}</td>
              <td class="num mono">{{ formatRupiah(p.duesAmount) }}</td>
              <td class="num mono">{{ formatRupiah(p.openingBalance) }}</td>
              <td class="num mono" :class="{ out: closingBalanceOf(p) < 0 }">{{ formatRupiah(closingBalanceOf(p)) }}</td>
              <td v-if="isBendahara" class="num">
                <span class="actions" style="justify-content: flex-end">
                  <button class="btn-sm" @click="openPeriod(p)">Edit</button>
                  <button class="btn-sm" @click="askDelete('period', p)">Hapus</button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="card-list only-mobile">
        <li v-for="p in state.periods" :key="p.id" class="card-item card-item--stack">
          <div class="row">
            <p class="card-item__title">{{ p.name }} <span v-if="p.id === state.periodId" class="pill">Dipilih</span></p>
            <span v-if="isBendahara" class="actions">
              <button class="btn-sm" @click="openPeriod(p)">Edit</button>
              <button class="btn-sm" @click="askDelete('period', p)">Hapus</button>
            </span>
          </div>
          <p class="card-item__meta mono">{{ range(p) }}</p>
          <dl class="stats">
            <div><dt>Iuran</dt><dd class="mono">{{ formatRupiah(p.duesAmount) }}</dd></div>
            <div><dt>Saldo awal</dt><dd class="mono">{{ formatRupiah(p.openingBalance) }}</dd></div>
            <div><dt>Saldo akhir</dt><dd class="mono" :class="{ out: closingBalanceOf(p) < 0 }">{{ formatRupiah(closingBalanceOf(p)) }}</dd></div>
          </dl>
        </li>
      </ul>
    </template>

    <!-- ===== Kategori ===== -->
    <h2 class="section-title">Kategori transaksi</h2>
    <div class="cat-grid">
      <section v-for="g in groups" :key="g.type" class="panel-white cat">
        <header class="cat__head">
          <h3 class="cat__title" :class="g.type">{{ g.label }}</h3>
          <button v-if="isBendahara" class="btn-sm" @click="openCategory(null, g.type)">+ Tambah</button>
        </header>
        <p v-if="!g.rows.length" class="empty" style="padding: 16px 0">Belum ada kategori.</p>
        <ul class="cat__list">
          <li v-for="c in g.rows" :key="c.id" class="cat__item">
            <span class="cat__name">
              {{ c.name }}
              <span v-if="isLocked(c)" class="lock" title="Dipakai otomatis oleh menu Iuran">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                Dikunci
              </span>
            </span>
            <span v-if="isBendahara && !isLocked(c)" class="actions">
              <button class="btn-sm" @click="openCategory(c)">Ganti nama</button>
              <button class="btn-sm" @click="askDelete('category', c)">Hapus</button>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <PeriodFormModal :open="showPeriod" :period="editingPeriod" @close="showPeriod = false" />
    <CategoryFormModal :open="showCategory" :category="editingCategory" :type="newCategoryType" @close="showCategory = false" />

    <ConfirmModal
      :open="!!deleting" :title="deleting?.kind === 'period' ? 'Hapus periode?' : 'Hapus kategori?'"
      :busy="busy" :error="deleteError" @confirm="confirmDelete" @close="deleting = null"
    >
      <template v-if="deleting?.kind === 'period'">
        <p>Periode <strong>{{ deleting.item.name }}</strong> ({{ range(deleting.item) }}) akan dihapus.</p>
        <p class="muted">Periode yang sudah memiliki pembayaran iuran tidak bisa dihapus. Transaksi di rentang tanggalnya tidak ikut terhapus.</p>
      </template>
      <template v-else-if="deleting">
        <p>Kategori <strong>{{ deleting.item.name }}</strong> ({{ deleting.item.type === 'in' ? 'pemasukan' : 'pengeluaran' }}) akan dihapus.</p>
        <p class="muted">Kategori yang sudah dipakai transaksi tidak bisa dihapus.</p>
      </template>
    </ConfirmModal>
  </DashboardLayout>
</template>

<style scoped>
.section-title { margin: 28px 0 12px; font: 700 16px var(--font-display); }
.pill { margin-left: 6px; vertical-align: middle; }

.card-item--stack { flex-direction: column; align-items: stretch; }
.row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; }
.stats div { min-width: 0; }
.stats dt { font-size: 9px; color: var(--color-muted); }
.stats dd { margin: 2px 0 0; font-size: 11px; overflow-wrap: anywhere; }

.cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.cat { padding: 4px 20px 8px; }
.cat__head { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 10px; border-bottom: 1px solid var(--color-line); }
.cat__title { margin: 0; font: 600 12px var(--font-body); }
.cat__list { margin: 0; padding: 0; list-style: none; }
.cat__item { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 48px; padding: 8px 0; font-size: 12px; border-bottom: 1px solid var(--color-line); }
.cat__item:last-child { border-bottom: 0; }
.cat__name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.lock { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; font: 600 9px var(--font-body); color: var(--color-muted); background: var(--color-page); border: 1px solid var(--color-border); border-radius: 999px; }

@media (max-width: 768px) {
  .section-title { margin-top: 22px; font-size: 15px; }
  .cat-grid { grid-template-columns: 1fr; gap: 12px; }
  .cat { padding: 4px 14px 6px; }
  .cat__item { font-size: 13px; }
  .stats dd { font-size: 12px; }
}
</style>
