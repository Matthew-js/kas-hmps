<script setup>
import { useRoute } from 'vue-router'
import { navItems } from './navItems'

defineProps({ role: { type: String, default: 'Bendahara' } })
const route = useRoute()
const isActive = (item) => route.path === item.to
const mobileItems = navItems.filter((i) => i.mobile !== false)
</script>

<template>
  <div class="shell">
    <!-- Desktop sidebar -->
    <aside class="sidebar">
      <div class="sidebar__brand">
        <p class="brand__name">Kas HMPS</p>
        <span class="brand__bar"></span>
        <p class="brand__sub">INFORMATIKA</p>
      </div>
      <nav class="sidebar__nav" aria-label="Menu utama">
        <component
          :is="item.ready ? 'RouterLink' : 'span'"
          v-for="item in navItems" :key="item.to"
          :to="item.ready ? item.to : undefined"
          class="nav__item" :class="{ 'nav__item--active': isActive(item) }"
        >{{ item.label }}</component>
      </nav>
      <div class="sidebar__role">
        <span>MASUK SEBAGAI</span>
        <strong>{{ role }}</strong>
      </div>
    </aside>

    <!-- Mobile top bar -->
    <header class="topbar">
      <span class="brand__name">Kas HMPS</span>
      <RouterLink to="/anggota" class="topbar__avatar" aria-label="Manajemen anggota">{{ role[0] }}</RouterLink>
    </header>

    <main class="content"><slot /></main>

    <!-- Mobile bottom nav -->
    <nav class="bottomnav" aria-label="Menu utama">
      <component
        :is="item.ready ? 'RouterLink' : 'span'"
        v-for="item in mobileItems" :key="item.to"
        :to="item.ready ? item.to : undefined"
        class="bottomnav__item" :class="{ 'bottomnav__item--active': isActive(item) }"
      >
        <i class="bottomnav__dot"></i>{{ item.short }}
      </component>
    </nav>
  </div>
</template>

<style scoped>
.shell { min-height: 100%; display: grid; grid-template-columns: 240px 1fr; background: var(--color-page); }

.sidebar { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; background: var(--color-navy); color: #fff; }
.sidebar__brand { padding: 24px 24px 22px; border-bottom: 1px solid rgb(255 255 255 / 0.1); }
.brand__name { margin: 0; font: 700 18px var(--font-display); }
.brand__bar { display: block; width: 28px; height: 2px; margin: 8px 0; background: var(--color-gold); }
.brand__sub { margin: 0; font-size: 8px; letter-spacing: 0.06em; color: rgb(255 255 255 / 0.7); }
.sidebar__nav { margin-top: 36px; display: flex; flex-direction: column; }
.nav__item { padding: 11px 24px; font-size: 12px; font-weight: 600; color: rgb(255 255 255 / 0.85); text-decoration: none; border-left: 3px solid transparent; }
.nav__item--active { background: var(--color-navy-active); border-left-color: var(--color-gold); color: #fff; }
.sidebar__role { margin: auto 16px 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; background: rgb(255 255 255 / 0.08); border-radius: 8px; font-size: 8px; color: rgb(255 255 255 / 0.7); }
.sidebar__role strong { font-size: 11px; color: #fff; }

.content { padding: 40px; min-width: 0; }
.topbar, .bottomnav { display: none; }

@media (max-width: 768px) {
  .shell { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .sidebar { display: none; }
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--color-navy); color: #fff; }
  .topbar__avatar { text-decoration: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: rgb(255 255 255 / 0.85); color: var(--color-navy); font: 600 10px var(--font-body); }
  .content { padding: 16px; }
  .bottomnav { position: sticky; bottom: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 8px 0 10px; background: var(--color-surface); border-top: 1px solid var(--color-border); }
  .bottomnav__item { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 9px; color: var(--color-muted); text-decoration: none; }
  .bottomnav__dot { width: 12px; height: 12px; border: 1.5px solid var(--color-muted); border-radius: 50%; }
  .bottomnav__item--active { color: var(--color-gold); }
  .bottomnav__item--active .bottomnav__dot { border-color: var(--color-gold); }
}
</style>