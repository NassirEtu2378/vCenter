<script setup>
const props = defineProps({
  folders: {
    type: Array,
    default: () => [],
  },
  selectedFolder: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['update:selectedFolder'])

const handleChange = (event) => {
  emit('update:selectedFolder', event.target.value || null)
}
</script>

<template>
  <div class="filter-card">
    <div class="filter-header">
      <h2>Dossier</h2>
    </div>
    <select class="filter-select" :value="selectedFolder || ''" @change="handleChange">
      <option value="">-- Tous les dossiers --</option>
      <option v-for="folder in folders" :key="folder" :value="folder">
        {{ folder }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.filter-card {
  margin-top: 1.55rem;
  /* width:80%; */
  border-radius: 16px;
}

.filter-header {
  margin-bottom: 1rem;
}

.filter-header h2 {
  margin: 0;
  font-size: 1rem;
  color: #102a43;
}

.filter-select {
  width: 80%;
  padding: 0.85rem 1rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.95rem;
  color: #102a43;
}

.filter-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
</style>
