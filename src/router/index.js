import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import AnggotaView from '@/views/AnggotaView.vue'
import TransaksiView from '@/views/TransaksiView.vue'
import IuranView from '@/views/IuranView.vue'
import LaporanView from '@/views/LaporanView.vue'
import { useAuth } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/anggota', name: 'anggota', component: AnggotaView },
    { path: '/transaksi', name: 'transaksi', component: TransaksiView },
    { path: '/iuran', name: 'iuran', component: IuranView },
    { path: '/laporan', name: 'laporan', component: LaporanView },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Guard: halaman selain login wajib login. Pembatasan tulis tetap dijaga RLS di database.
router.beforeEach((to) => {
  const { isLoggedIn } = useAuth()
  if (!to.meta.public && !isLoggedIn.value) return { name: 'login' }
  if (to.name === 'login' && isLoggedIn.value) return { name: 'dashboard' }
})

export default router
