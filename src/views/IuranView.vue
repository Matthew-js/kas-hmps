<script setup>
import { ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import DuesNominalModal from '@/components/DuesNominalModal.vue'
import Stamp from '@/components/Stamp.vue'
import { useKas } from '@/stores/kas'
import { formatRupiah } from '@/utils/format'

const { state, isPaid, markPaid } = useKas()
const showNominal = ref(false)
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Iuran Anggota</h1>
        <p class="page-sub">
          <span class="only-desktop">Periode {{ state.period }} · {{ formatRupiah(state.duesAmount) }} / anggota</span>
          <span class="only-mobile" style="display: inline">{{ state.period }} · {{ formatRupiah(state.duesAmount) }} / anggota</span>
        </p>
      </div>
      <div class="actions only-desktop">
        <button class="btn-sm" @click="showNominal = true">Atur nominal</button>
        <select class="input-sm" aria-label="Periode"><option>{{ state.period }}</option></select>
      </div>
      <button class="btn-sm btn-sm--block only-mobile" @click="showNominal = true">Atur nominal iuran</button>
    </header>

    <p v-if="!state.members.length" class="empty" style="margin-top: 16px">Belum ada anggota. Tambahkan di Manajemen Anggota.</p>

    <div v-else class="panel-white only-desktop" style="margin-top: 20px">
      <table class="table">
        <thead><tr><th>Nama</th><th>NRP</th><th>Angkatan</th><th class="num">Status</th></tr></thead>
        <tbody>
          <tr v-for="m in state.members" :key="m.id">
            <td>{{ m.name }}</td>
            <td class="mono">{{ m.nrp }}</td>
            <td class="mono">{{ m.year }}</td>
            <td class="num">
              <Stamp v-if="isPaid(m.id)" text="LUNAS" tone="paid" />
              <button v-else class="btn-sm" @click="markPaid(m.id)">Tandai lunas</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul class="card-list only-mobile" style="margin-top: 14px">
      <li v-for="m in state.members" :key="m.id" class="card-item">
        <div>
          <p class="card-item__title">{{ m.name }}</p>
          <p class="card-item__meta">Angkatan {{ m.year }}</p>
        </div>
        <Stamp v-if="isPaid(m.id)" text="LUNAS" tone="paid" />
        <button v-else class="btn-sm" @click="markPaid(m.id)">Tandai lunas</button>
      </li>
    </ul>

    <DuesNominalModal :open="showNominal" @close="showNominal = false" />
  </DashboardLayout>
</template>
