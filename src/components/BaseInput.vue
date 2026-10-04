<script setup>
defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  error: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <input
      :id="id"
      class="field__input"
      :class="{ 'field__input--error': error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="!!error"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" class="field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 8px; }
.field__label { font-size: 13px; font-weight: 600; }
.field__input {
  height: 44px;
  padding: 0 14px;
  font: 400 14px var(--font-body);
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.field__input::placeholder { color: var(--color-muted); }
.field__input:focus { border-color: var(--color-gold); outline: none; box-shadow: 0 0 0 3px rgb(201 157 60 / 0.2); }
.field__input--error { border-color: var(--color-danger); }
.field__error { margin: 0; font-size: 12px; color: var(--color-danger); }
</style>
