// State autentikasi: siapa yang login dan apa perannya.
import { reactive, computed } from 'vue'
import { repo } from '@/repositories'

const auth = reactive({ user: null, profile: null })

const isLoggedIn = computed(() => !!auth.user)
const isBendahara = computed(() => auth.profile?.role === 'bendahara')
const roleLabel = computed(() => (isBendahara.value ? 'Bendahara' : 'Pengurus'))

async function setUser(user) {
  auth.user = user
  auth.profile = user ? await repo.auth.getProfile(user.id) : null
}

// Dipanggil sekali sebelum aplikasi di-mount (main.js) agar sesi login tetap ada setelah refresh.
export async function initAuth() {
  try {
    await setUser(await repo.auth.getUser())
  } catch {
    auth.user = null; auth.profile = null
  }
  repo.auth.onChange((user) => {
    if ((user?.id ?? null) !== (auth.user?.id ?? null)) setUser(user)
  })
}

export function useAuth() {
  return {
    auth, isLoggedIn, isBendahara, roleLabel,
    async login(email, password, roleHint) {
      await setUser(await repo.auth.signIn(email, password, roleHint))
    },
    async logout() {
      await repo.auth.signOut()
      auth.user = null; auth.profile = null
    },
  }
}
