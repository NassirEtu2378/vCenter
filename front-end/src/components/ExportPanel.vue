<template>
  <div class="export-panel">
    <div class="filter-header">
      <h2>Export</h2>
    </div>

    <div class="export-field">
      <label>Format</label>
      <select
        :value="exportFormat"
        @change="$emit('update:exportFormat', $event.target.value)"
        class="filter-select"
      >
        <option value="csv">CSV</option>
        <option value="excel">Excel</option>
      </select>
    </div>

    <div class="export-field">
      <label>Portée</label>
      <select
        :value="exportScope"
        @change="$emit('update:exportScope', $event.target.value)"
        class="filter-select"
      >
        <option value="current">Page actuelle</option>
        <option value="all">Toutes les pages</option>
      </select>
    </div>

    <button
      type="button"
      class="export-button"
      :disabled="disabled"
      @click="$emit('export')"
    >
      Exporter
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  exportFormat: {
    type: String,
    default: 'csv',
  },
  exportScope: {
    type: String,
    default: 'current',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:exportFormat', 'update:exportScope', 'export'])
</script>

<style scoped>
.export-panel {
  display: flex;
  align-items: end;
  gap: 1rem;
  width: 100%;
  padding: 1.25rem;
  background: #ffffff;
}

.export-panel .filter-header {
  margin-bottom: 1rem;
}

.export-field {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  margin-bottom: 0;
}

.filter-select {
  width: 100%;
  padding: 0.9rem 1rem;
  background: #ffffff;
  color: #102a43;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}

.filter-select:focus {
  outline: none;
  border-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.export-button {
  width: auto;
  min-width: 120px;
  height: 50px;
  background-color: #43cf79;
  border: none;
}

.export-button:hover:not(:disabled) {
  background:darkgreen;
}

.export-button:disabled {
  background: #43cf7979;
  cursor: not-allowed;
}
</style>
