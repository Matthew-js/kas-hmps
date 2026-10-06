<script setup>
import { ref, computed, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import { useKas } from '@/stores/kas'
import { useAuth } from '@/stores/auth'
import { formatRupiah, formatDate } from '@/utils/format'

const PER_PAGE = 8
const { sorted, allCategories, proofUrl } = useKas()
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
const page = ref(1)
const showForm = ref(false)

const filtered = computed(() =>
  sorted.value.filter((t) =>
    (!category.value || t.category === category.value) &&
    (!query.value || `${t.note} ${t.category}`.toLowerCase().includes(query.value.toLowerCase())),
  ),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const rows = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
watch([query, category], () => { page.value = 1 })

const amountText = (t) => `${t.type === 'in' ? '+' : '−'} ${formatRupiah(t.amount)}`
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Transaksi</h1>
        <p class="page-sub">Catatan pemasukan &amp; pengeluaran kas</p>
      </div>
      <button v-if="isBendahara" class="btn-sm btn-sm--gold btn-sm--lg only-desktop" @click="showForm = true">+ Catat transaksi</button>
    </header>

    <div class="toolbar">
      <input v-model="query" class="input-sm" type="search" placeholder="Cari transaksi..." aria-label="Cari transaksi" />
      <select v-model="category" class="input-sm" aria-label="Filter kategori">
        <option value="">Semua kategori</option>
        <option v-for="c in allCategories" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <p v-if="!filtered.length" class="empty">Belum ada transaksi yang cocok.</p>

    <template v-else>
      <div class="panel-white only-desktop">
        <table class="table">
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="num">Nominal</th></tr></thead>
          <tbody>
            <tr v-for="t in rows" :key="t.id">
              <td class="mono">{{ formatDate(t.date) }}</td>
              <td>{{ t.category }}</td>
              <td>
                {{ t.note }}
                <button v-if="t.proof" class="link" @click="openProof(t.proof)">bukti</button>
              </td>
              <td class="num mono" :class="t.type">{{ amountText(t) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="card-list only-mobile">
        <li v-for="t in rows" :key="t.id" class="card-item">
          <div>
            <p class="card-item__title">{{ t.category }}</p>
            <p class="card-item__meta">{{ t.note }}</p>
            <p class="card-item__meta">{{ formatDate(t.date) }}</p>
          </div>
          <span class="mono" :class="t.type" style="font-size: 12px">{{ amountText(t) }}</span>
        </li>
      </ul>

      <div v-if="pages > 1" class="pager">
        <button class="btn-sm" :disabled="page === 1" @click="page--">Sebelumnya</button>
        <span>{{ page }} / {{ pages }}</span>
        <button class="btn-sm" :disabled="page === pages" @click="page++">Berikutnya</button>
      </div>
    </template>

    <button v-if="isBendahara" class="fab only-mobile" aria-label="Catat transaksi" @click="showForm = true">+</button>
    <TransactionFormModal :open="showForm" @close="showForm = false" />
  </DashboardLayout>
</template>

<style scoped>
.link { margin-left: 6px; padding: 0; font: 600 10px var(--font-body); color: var(--color-gold-hover); background: none; border: 0; text-decoration: underline; cursor: pointer; }
.fab { position: fixed; right: 20px; bottom: 76px; width: 44px; height: 44px; font-size: 24px; color: var(--color-ink); background: var(--color-gold); border: 0; border-radius: 50%; box-shadow: 0 4px 12px rgb(0 0 0 / 0.2); cursor: pointer; }
</style>
