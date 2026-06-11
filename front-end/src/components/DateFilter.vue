<script setup>
const props = defineProps({
  dateFrom: {
    type: String,
    default: '',
  },
  dateTo: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:dateFrom', 'update:dateTo'])

const updateFrom = (event) => {
  emit('update:dateFrom', event.target.value)
}

const updateTo = (event) => {
  emit('update:dateTo', event.target.value)
}
</script>

<template>
  <div class="filter-card date-filter-card">
    <div class="filter-header">
      <h2>Filtre de date</h2>
    </div>

    <label class="filter-label">
      <span>Date de début</span>
      <input class="filter-input" type="date" :value="dateFrom" @input="updateFrom" />
    </label>

    <label class="filter-label">
      <span>Date de fin</span>
      <input class="filter-input" type="date" :value="dateTo" @input="updateTo" />
    </label>
  </div>
</template>

<style scoped>
.date-filter-card {
  margin-top: 1rem;
}

.filter-label {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #334155;
  font-size: 0.95rem;
}

.filter-label span {
  font-weight: 500;
}

.filter-input {
  width: 70%;
  padding: 0.8rem 1rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #102a43;
}

.filter-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
</style>
