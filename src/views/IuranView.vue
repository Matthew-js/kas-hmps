<script setup>
import { ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import DuesNominalModal from '@/components/DuesNominalModal.vue'
import Stamp from '@/components/Stamp.vue'
import { useKas } from '@/stores/kas'
import { useAuth } from '@/stores/auth'
import { formatRupiah } from '@/utils/format'

const { state, currentPeriod, activeMembers, isPaid, markPaid, setPeriod } = useKas()
const { isBendahara } = useAuth()
const showNominal = ref(false)
const busyId = ref(null)
const actionError = ref('')

async function pay(member) {
  busyId.value = member.id
  actionError.value = ''
  try {
    await markPaid(member.id)
  } catch (e) {
    actionError.value = `${member.name}: ${e.message}`
  } finally {
    busyId.value = null
  }
}
async function changePeriod(e) {
  try { await setPeriod(Number(e.target.value)) } catch (err) { actionError.value = err.message }
}
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Iuran Anggota</h1>
        <p class="page-sub">
          <span class="only-desktop">Periode {{ currentPeriod?.name }} · {{ formatRupiah(currentPeriod?.duesAmount ?? 0) }} / anggota aktif</span>
          <span class="only-mobile" style="display: inline">{{ currentPeriod?.name }} · {{ formatRupiah(currentPeriod?.duesAmount ?? 0) }} / anggota</span>
        </p>
      </div>
      <div class="actions only-desktop">
        <button v-if="isBendahara" class="btn-sm" @click="showNominal = true">Atur nominal</button>
        <select class="input-sm" aria-label="Periode" :value="state.periodId" @change="changePeriod">
          <option v-for="p in state.periods" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <button v-if="isBendahara" class="btn-sm btn-sm--block only-mobile" @click="showNominal = true">Atur nominal iuran</button>
    </header>

    <p v-if="actionError" class="f__err" role="alert" style="margin-top: 12px">{{ actionError }}</p>
    <p v-if="!state.periods.length" class="empty" style="margin-top: 16px">Belum ada periode iuran. Tambahkan lewat tabel <code>periods</code> di Supabase.</p>
    <p v-else-if="!activeMembers.length" class="empty" style="margin-top: 16px">Belum ada anggota aktif. Tambahkan di Manajemen Anggota.</p>

    <div v-if="currentPeriod && activeMembers.length" class="panel-white only-desktop" style="margin-top: 20px">
      <table class="table">
        <thead><tr><th>Nama</th><th>NRP</th><th>Angkatan</th><th class="num">Status</th></tr></thead>
        <tbody>
          <tr v-for="m in activeMembers" :key="m.id">
            <td>{{ m.name }}</td>
            <td class="mono">{{ m.nrp }}</td>
            <td class="mono">{{ m.year }}</td>
            <td class="num">
              <Stamp v-if="isPaid(m.id)" text="LUNAS" tone="paid" />
              <button v-else-if="isBendahara" class="btn-sm" :disabled="busyId === m.id" @click="pay(m)">{{ busyId === m.id ? 'Menyimpan…' : 'Tandai lunas' }}</button>
              <Stamp v-else text="BELUM" tone="unpaid" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul v-if="currentPeriod && activeMembers.length" class="card-list only-mobile" style="margin-top: 14px">
      <li v-for="m in activeMembers" :key="m.id" class="card-item">
        <div>
          <p class="card-item__title">{{ m.name }}</p>
          <p class="card-item__meta">Angkatan {{ m.year }}</p>
        </div>
        <Stamp v-if="isPaid(m.id)" text="LUNAS" tone="paid" />
        <button v-else-if="isBendahara" class="btn-sm" :disabled="busyId === m.id" @click="pay(m)">{{ busyId === m.id ? '…' : 'Tandai lunas' }}</button>
        <Stamp v-else text="BELUM" tone="unpaid" />
      </li>
    </ul>

    <DuesNominalModal :open="showNominal" @close="showNominal = false" />
  </DashboardLayout>
</template>
