<template>
  <div class="seal" aria-hidden="true">
    <span class="seal__text">KAS</span>
  </div>
</template>

<style scoped>
.seal {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border: 2px solid var(--color-gold);
  border-radius: 50%;
}
.seal__text {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1.5px dotted var(--color-gold);
  border-radius: 50%;
  font: 600 10px var(--font-body);
  letter-spacing: 0.04em;
  color: var(--color-gold);
}
</style>
