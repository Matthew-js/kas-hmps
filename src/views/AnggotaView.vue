<script setup>
import { ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import MemberFormModal from '@/components/MemberFormModal.vue'
import AppModal from '@/components/AppModal.vue'
import { useKas } from '@/stores/kas'

const { state, removeMember } = useKas()
const showForm = ref(false)
const editing = ref(null)
const deleting = ref(null)

const openForm = (member = null) => { editing.value = member ? { ...member } : null; showForm.value = true }
function confirmDelete() { removeMember(deleting.value.id); deleting.value = null }
</script>

<template>
  <DashboardLayout>
    <header class="page-head">
      <div>
        <h1 class="page-title">Manajemen Anggota</h1>
        <p class="page-sub">Data anggota HMPS Informatika</p>
      </div>
      <button class="btn-sm btn-sm--gold btn-sm--lg only-desktop" @click="openForm()">+ Tambah</button>
      <button class="btn-sm btn-sm--gold btn-sm--block only-mobile" @click="openForm()">+ Tambah anggota</button>
    </header>

    <p v-if="!state.members.length" class="empty" style="margin-top: 16px">Belum ada anggota. Klik “Tambah” untuk memulai.</p>

    <div v-else class="panel-white only-desktop" style="margin-top: 20px">
      <table class="table">
        <thead><tr><th>Nama</th><th>NRP</th><th>Angkatan</th><th>Status</th><th class="num">Aksi</th></tr></thead>
        <tbody>
          <tr v-for="m in state.members" :key="m.id">
            <td>{{ m.name }}</td>
            <td class="mono">{{ m.nrp }}</td>
            <td class="mono">{{ m.year }}</td>
            <td><span class="pill" :class="{ 'pill--off': !m.active }">{{ m.active ? 'Aktif' : 'Nonaktif' }}</span></td>
            <td class="num">
              <span class="actions" style="justify-content: flex-end">
                <button class="btn-sm" @click="openForm(m)">Edit</button>
                <button class="btn-sm" @click="deleting = m">Hapus</button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul class="card-list only-mobile" style="margin-top: 14px">
      <li v-for="m in state.members" :key="m.id" class="card-item">
        <div>
          <p class="card-item__title">{{ m.name }}</p>
          <p class="card-item__meta"><span class="mono">{{ m.nrp }}</span> · {{ m.year }}</p>
          <span class="pill" :class="{ 'pill--off': !m.active }" style="margin-top: 6px">{{ m.active ? 'Aktif' : 'Nonaktif' }}</span>
        </div>
        <span class="actions">
          <button class="btn-sm" @click="openForm(m)">Edit</button>
          <button class="btn-sm" @click="deleting = m">Hapus</button>
        </span>
      </li>
    </ul>

    <MemberFormModal :open="showForm" :member="editing" @close="showForm = false" />

    <AppModal :open="!!deleting" title="Hapus anggota?" width="320px" @close="deleting = null">
      <p style="font-size: 12px; margin: 12px 0 0">
        {{ deleting?.name }} akan dihapus dari daftar anggota beserta status iurannya. Aksi ini tidak dapat dibatalkan.
      </p>
      <div class="modal-actions">
        <button class="btn-sm btn-sm--gold btn-sm--lg" @click="confirmDelete">Hapus</button>
        <button class="btn-sm btn-sm--lg" @click="deleting = null">Batal</button>
      </div>
    </AppModal>
  </DashboardLayout>
</template>
