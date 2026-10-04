import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import AnggotaView from '@/views/AnggotaView.vue'
import TransaksiView from '@/views/TransaksiView.vue'
import IuranView from '@/views/IuranView.vue'
import LaporanView from '@/views/LaporanView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/anggota', name: 'anggota', component: AnggotaView },
    { path: '/transaksi', name: 'transaksi', component: TransaksiView },
    { path: '/iuran', name: 'iuran', component: IuranView },
    { path: '/laporan', name: 'laporan', component: LaporanView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
