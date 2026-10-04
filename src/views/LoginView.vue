<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandSeal from '@/components/BrandSeal.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const loading = ref(false)
const router = useRouter()

function validate() {
  errors.email = /^\S+@\S+\.\S+$/.test(form.email) ? '' : 'Masukkan email yang valid.'
  errors.password = form.password ? '' : 'Kata sandi wajib diisi.'
  return !errors.email && !errors.password
}

// role: 'bendahara' | 'pengurus'
async function login(role) {
  if (!validate()) return
  loading.value = true
  try {
    // TODO: sambungkan ke Supabase Auth, lalu arahkan sesuai peran
    console.log('login', role, form.email)
    router.push({ name: 'dashboard' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="card" novalidate @submit.prevent="login('bendahara')">
      <BrandSeal />
      <h1 class="card__title">Kas HMPS Informatika</h1>
      <p class="card__subtitle">
        <span class="only-desktop">Masuk untuk mengelola kas &amp; keuangan himpunan</span>
        <span class="only-mobile">Masuk untuk kelola kas himpunan</span>
      </p>

      <div class="card__fields">
        <BaseInput
          id="email" v-model="form.email" label="Email" type="email"
          placeholder="bendahara@hmps.if.ac.id" autocomplete="username" :error="errors.email"
        />
        <BaseInput
          id="password" v-model="form.password" label="Kata sandi" type="password"
          placeholder="••••••••" autocomplete="current-password" :error="errors.password"
        />
      </div>

      <div class="card__actions">
        <BaseButton type="submit" :loading="loading">Masuk sebagai Bendahara</BaseButton>
        <BaseButton variant="secondary" :loading="loading" @click="login('pengurus')">
          Masuk sebagai Pengurus
        </BaseButton>
      </div>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 380px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.card__title { margin: 16px 0 0; font: 700 26px/1.2 var(--font-display); text-align: center; }
.card__subtitle { margin: 6px 0 24px; font-size: 12px; color: var(--color-muted); text-align: center; }
.card__fields, .card__actions { width: 100%; display: flex; flex-direction: column; }
.card__fields { gap: 14px; }
.card__actions { gap: 10px; margin-top: 18px; }

.only-mobile { display: none; }

@media (max-width: 640px) {
  .login { padding: 20px; }
  .card { padding: 28px 20px; }
  .card__title { font-size: 22px; }
  .card__subtitle { font-size: 13px; }
  .only-desktop { display: none; }
  .only-mobile { display: inline; }
}
</style>
