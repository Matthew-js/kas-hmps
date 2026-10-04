<script setup>
defineProps({ members: { type: Array, required: true } }) // [string]
</script>

<template>
  <ul class="list">
    <li v-for="name in members" :key="name" class="list__row">
      <span>{{ name }}</span>
      <span class="stamp" aria-label="Belum lunas">BELUM</span>
    </li>
    <li v-if="!members.length" class="list__empty">Semua anggota sudah lunas.</li>
  </ul>
</template>

<style scoped>
.list { margin: 0; padding: 0; list-style: none; }
.list__row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; font-size: 10px; border-bottom: 1px solid var(--color-line); }
.list__empty { padding: 12px 0; font-size: 11px; color: var(--color-muted); }
.stamp {
  display: grid; place-items: center; width: 24px; height: 24px;
  border: 1.5px solid var(--color-expense); border-radius: 50%;
  outline: 1px dotted var(--color-expense); outline-offset: -4px;
  font: 700 5px var(--font-body); color: var(--color-expense); transform: rotate(-12deg);
}
@media (max-width: 768px) {
  .list__row { font-size: 11px; }
}
</style>
