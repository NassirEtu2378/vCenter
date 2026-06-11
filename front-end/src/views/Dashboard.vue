<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import ClusterFilter from '@/components/ClusterFilter.vue'
import FolderFilter from '@/components/FolderFilter.vue'
import DateFilter from '@/components/DateFilter.vue'
import ExportPanel from '@/components/ExportPanel.vue'
import { getVcenterList, getVcenterClusters, getAllVmsWithClusterInfo, getVmStorageGb, getVmDiff } from '../api/vcenter'
import { useRouter } from 'vue-router'
import { logout } from '@/api/vcenter'

const vcenters = ref([])
const selectedVcenter = ref(null)
const clusters = ref([])
const selectedCluster = ref(null)
const selectedFolder = ref(null)
const dateFrom = ref('')
const dateTo = ref('')
const exportFormat = ref('csv')
const exportScope = ref('current')
const allVms = ref([])
const isLoadingVcenters = ref(true)
const isLoadingClusters = ref(false)
const isLoadingVms = ref(false)
const errorMessage = ref('')
const showBellModal = ref(false)
const activeVmHistory = ref(null)
const isLoadingHistory = ref(false)
const clusterError = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const vmStorage = ref({})
const vmStorageLoading = ref({})
const router = useRouter()

const loadVcenters = async () => {
  isLoadingVcenters.value = true
  errorMessage.value = ''

  try {
    vcenters.value = await getVcenterList()
    if (vcenters.value.length > 0) {
      await selectVcenter(vcenters.value[0])
    }
  } catch (error) {
    errorMessage.value = 'Impossible de charger la liste des vCenter.'
  } finally {
    isLoadingVcenters.value = false
  }
}

const getVmClusterName = (vm) => {
  const clusterId = vm.cluster || vm.cluster_id
  return clusterMapMemo.value.get(clusterId) ?? vm.cluster_name ?? clusterId ?? '-'
}

const loadVcenterVms = async () => {
  if (!selectedVcenter.value) {
    allVms.value = []
    vmStorage.value = {}
    vmStorageLoading.value = {}
    return
  }

  isLoadingVms.value = true
  errorMessage.value = ''

  try {
    allVms.value = await getAllVmsWithClusterInfo(selectedVcenter.value.id)

    currentPage.value = 1
    vmStorage.value = {}
    vmStorageLoading.value = {}
    // reset history/modal state
    activeVmHistory.value = null
    showBellModal.value = false
  } catch (error) {
    errorMessage.value =
      'Impossible de récupérer les machines virtuelles. Veuillez vérifier votre session vCenter.'
    allVms.value = []
    vmStorage.value = {}
    vmStorageLoading.value = {}
  } finally {
    isLoadingVms.value = false
  }
}

const viewVmHistory = async (vm) => {
  const vmUid = vm.vm || vm.id || vm.name
  if (!vmUid) return

  showBellModal.value = true
  activeVmHistory.value = {
    vmUid,
    vm: vm.name || vm.vm || vm.id || 'VM',
    history: [],
  }
  isLoadingHistory.value = true

  try {
    const res = await getVmDiff(vmUid, selectedVcenter.value?.id || 'default')
    activeVmHistory.value = {
      ...res,
      vm: vm.name || vm.vm || vm.id || res.vmUid,
    }
  } catch (e) {
    activeVmHistory.value = { vmUid, vm: vm.name || vm.vm || vm.id || 'VM', history: [] }
  } finally {
    isLoadingHistory.value = false
  }
}

const loadClusters = async () => {
  if (!selectedVcenter.value) {
    clusters.value = []
    selectedCluster.value = null
    return
  }

  isLoadingClusters.value = true
  clusterError.value = ''

  try {
    clusters.value = await getVcenterClusters(selectedVcenter.value.id)
    selectedCluster.value = null
  } catch (error) {
    clusterError.value = 'Impossible de charger les clusters.'
    clusters.value = []
    selectedCluster.value = null
  } finally {
    isLoadingClusters.value = false
  }

  // Charger les VMs indépendamment
  await loadVcenterVms()
}

const selectVcenter = async (vcenter) => {
  selectedVcenter.value = vcenter
  selectedFolder.value = null
  dateFrom.value = ''
  dateTo.value = ''
  await loadClusters()
}

const resetFilters = () => {
  selectedFolder.value = null
  dateFrom.value = ''
  dateTo.value = ''
  currentPage.value = 1
}

const exportRows = (rows) => {
  const headers = ['Nom', 'OS', 'CPU', 'RAM (MiB)', 'Stockage (GB)', 'Date de création', 'Cluster', 'Dossier']
  const data = rows.map((vm) => {
    const folder = vm.folder_main || vm.folder_name || vm.folder || vm.folder_path || '-'
    return [
      vm.name || '-',
      vm.os ?? '-',
      vm.cpu_count ?? vm.cpu?.count ?? '-',
      vm.memory_size_MiB ?? vm.memory?.size_MiB ?? '-',
      getStorageLabel(vm),
      formatDate(vm.creation_date || vm.create_time || vm.creation_time || vm.identity?.create_time),
      getVmClusterName(vm),
      folder,
    ]
  })
  return { headers, data }
}

const buildCsv = (rows) => {
  const escapeCell = (value) => {
    const cell = String(value ?? '')
    return `"${cell.replace(/"/g, '""')}"`
  }
  const { headers, data } = exportRows(rows)
  const csvLines = [headers.map(escapeCell).join(';')]
  data.forEach((row) => {
    csvLines.push(row.map(escapeCell).join(';'))
  })
  return csvLines.join('\r\n')
}

const buildExcel = (rows) => {
  const { headers, data } = exportRows(rows)
  const headerRow = headers.map((cell) => `<th>${cell}</th>`).join('')
  const bodyRows = data
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${String(cell ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`
}

const downloadExport = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportData = () => {
  const rows = exportScope.value === 'current' ? paginatedVms.value : vms.value
  if (!rows || rows.length === 0) {
    return
  }

  const dateSuffix = new Date().toISOString().slice(0, 10)
  if (exportFormat.value === 'excel') {
    const html = buildExcel(rows)
    downloadExport(html, `vms_export_${dateSuffix}.xls`, 'application/vnd.ms-excel;charset=utf-8')
  } else {
    const csv = buildCsv(rows)
    downloadExport(csv, `vms_export_${dateSuffix}.csv`, 'text/csv;charset=utf-8;')
  }
}

const selectCluster = (clusterId) => {
  if (clusterId === null || clusterId === '') {
    selectedCluster.value = null
  } else {
    const cluster = clusters.value.find(
      (c) => (c.cluster || c.id) === clusterId
    ) || null
    selectedCluster.value = cluster
  }
  currentPage.value = 1
}

const folderOptions = computed(() => {
  const folders = new Set()
  for (const vm of allVms.value) {
    const folder = vm.folder_main || vm.folder_name || vm.folder || vm.folder_path
    if (folder) {
      folders.add(folder)
    }
  }
  return Array.from(folders).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
})

const getVmCreationDate = (vm) => {
  const value = vm.creation_date || vm.create_time || vm.creation_time || vm.identity?.create_time
  return parseCsvDate(value)
}

const matchesDateFilter = (vmDate, fromValue, toValue) => {
  if (!vmDate) {
    return false
  }

  const fromDate = fromValue ? parseCsvDate(fromValue) : null
  const toDate = toValue ? parseCsvDate(toValue) : null

  if (fromDate && toDate) {
    const start = new Date(fromDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(toDate)
    end.setHours(23, 59, 59, 999)
    return vmDate >= start && vmDate <= end
  }

  if (fromDate) {
    return vmDate.toDateString() === fromDate.toDateString()
  }

  if (toDate) {
    return vmDate.toDateString() === toDate.toDateString()
  }

  return true
}

const vms = computed(() => {
  let filtered = allVms.value

  if (selectedCluster.value) {
    const clusterId = selectedCluster.value.cluster || selectedCluster.value.id
    filtered = filtered.filter((vm) => (vm.cluster || vm.cluster_id) === clusterId)
  }

  if (selectedFolder.value) {
    filtered = filtered.filter((vm) => {
      const folder = vm.folder_main || vm.folder_name || vm.folder || vm.folder_path
      return folder === selectedFolder.value
    })
  }

  if (dateFrom.value || dateTo.value) {
    filtered = filtered.filter((vm) => {
      const vmDate = getVmCreationDate(vm)
      return matchesDateFilter(vmDate, dateFrom.value, dateTo.value)
    })
  }

  return filtered
})

const clusterMapMemo = computed(() => {
  const map = new Map()
  for (const cluster of clusters.value) {
    const id = cluster.cluster || cluster.id
    if (id) {
      map.set(id, cluster.name || cluster.cluster || '')
    }
  }
  return map
})

const hasVms = computed(() => vms.value.length > 0)
const pageCount = computed(() => Math.max(1, Math.ceil(vms.value.length / pageSize.value)))
const paginatedVms = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return vms.value.slice(start, start + pageSize.value)
})
const pageNumbers = computed(() => Array.from({ length: pageCount.value }, (_, index) => index + 1))

const formatMemory = (value) => (value ? `${value} Mo` : '-')

const parseCsvDate = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const csvDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/)
  if (csvDateMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = csvDateMatch
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const handleDateFrom = (value) => {
  dateFrom.value = value
  currentPage.value = 1
}

const handleDateTo = (value) => {
  dateTo.value = value
  currentPage.value = 1
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const parsed = parseCsvDate(value)
  if (!parsed) {
    return value
  }

  return parsed.toLocaleDateString('fr-FR')
}

const fetchVmStorage = async (vmId) => {
  if (!vmId || !selectedVcenter.value) {
    return 0
  }

  if (vmStorage.value[vmId] != null) {
    return vmStorage.value[vmId]
  }

  vmStorageLoading.value[vmId] = true
  try {
    const storageGb = await getVmStorageGb(vmId, selectedVcenter.value.id)
    vmStorage.value[vmId] = storageGb
    return storageGb
  } catch (error) {
    vmStorage.value[vmId] = 0
    return 0
  } finally {
    vmStorageLoading.value[vmId] = false
  }
}

const loadStorageForPage = async () => {
  const vmsToLoad = paginatedVms.value.filter((vm) => {
    const vmId = vm.vm || vm.name
    return vmStorage.value[vmId] === undefined
  })

  await Promise.all(
    vmsToLoad.map((vm) => {
      const vmId = vm.vm || vm.name
      return fetchVmStorage(vmId)
    }),
  )
}

let storageLoadTimeout
watch(
  () => paginatedVms.value.map((vm) => vm.vm || vm.name),
  () => {
    if (hasVms.value) {
      clearTimeout(storageLoadTimeout)
      storageLoadTimeout = setTimeout(() => {
        loadStorageForPage()
      }, 100)
    }
  },
  { immediate: true },
)

const getStorageLabel = (vm) => {
  const vmId = vm.vm || vm.name
  if (vmStorageLoading.value[vmId]) {
    return '...'
  }

  return vmStorage.value[vmId] != null ? vmStorage.value[vmId] : '-'
}

const isFirstPage = computed(() => currentPage.value === 1)
const isLastPage = computed(() => currentPage.value === pageCount.value)

const goToPage = (page) => {
  if (page >= 1 && page <= pageCount.value) {
    currentPage.value = page
  }
}

const prevPage = () => {
  if (!isFirstPage.value) {
    currentPage.value -= 1
  }
}

const nextPage = () => {
  if (!isLastPage.value) {
    currentPage.value += 1
  }
}

const handleLogout = () => {
  logout()
  router.push('/login')
}

onMounted(() => {
  loadVcenters()
})
</script>

<template>
  <section class="dashboard-page">
    <div class="dashboard-hero">
      <div class="hero-content">
        <h1>Tableau de bord VMware</h1>
        <p>Supervision des vCenter et des machines virtuelles.</p>
      </div>

      <div class="hero-actions">
        <div class="logout-wrapper">
          <button class="logout-button" @click="handleLogout">Déconnexion</button>
        </div>

        <ExportPanel
          :exportFormat="exportFormat"
          :exportScope="exportScope"
          :disabled="!vms.length"
          @update:exportFormat="(value) => (exportFormat = value)"
          @update:exportScope="(value) => (exportScope = value)"
          @export="exportData"
        />
      </div>
    </div>

    <div class="dashboard-grid">
      <aside class="dashboard-sidebar">
        <div class="panel">
          <h2>vCenter</h2>

          <div v-if="isLoadingVcenters" class="panel-empty">Chargement des vCenter…</div>
          <div v-else-if="vcenters.length === 0" class="panel-empty">Aucun vCenter configuré.</div>

          <ul class="vcenter-list" v-else>
            <li
              v-for="vcenter in vcenters"
              :key="vcenter.id"
              :class="{ active: selectedVcenter?.id === vcenter.id }"
            >
              <button type="button" @click="selectVcenter(vcenter)">
                <span class="vcenter-name">{{ vcenter.name }}</span>
                <!-- <span class="vcenter-host">{{ vcenter.host }}</span> -->
              </button>
            </li>
          </ul>
        </div>

          <ClusterFilter
            :clusters="clusters"
            :isLoading="isLoadingClusters"
            :error="clusterError"
            :selectedClusterId="selectedCluster?.cluster || selectedCluster?.id"
            @update:selectedClusterId="selectCluster"
          />

          <FolderFilter
            :folders="folderOptions"
            v-model:selectedFolder="selectedFolder"
            @update:selectedFolder="currentPage = 1"
          />

          <DateFilter
            :dateFrom="dateFrom"
            :dateTo="dateTo"
            @update:dateFrom="handleDateFrom"
            @update:dateTo="handleDateTo"
          />
        </aside>

      <main class="dashboard-content">
        <div class="panel">
          <div v-if="isLoadingVms" class="panel-empty">Chargement des VM…</div>

          <table v-if="selectedVcenter && hasVms" class="vm-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>OS</th>
                <th>CPU</th>
                <th class="valeurColonne">RAM</th>
                <th>Stockage (GB)</th>
                <th>Date de création</th>
                <th class="valeurColonne">Cluster</th>
                <th class="valeurColonne">Dossier</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="vm in paginatedVms" :key="vm.vm || vm.name">
                <td>
                  <div class="vm-name-cell">
                    <span>{{ vm.name || vm.vm || '-' }}</span>
                    <button
                      v-if="vm.hasChangesToday"
                      type="button"
                      class="row-bell-button"
                      @click.stop="viewVmHistory(vm)"
                      aria-label="Voir les modifications de cette VM"
                    >
                      🔔
                    </button>
                  </div>
                </td>
                <td>{{ vm.os ?? '-' }}</td>
                <td class="valeurColonne">{{ vm.cpu_count ?? vm.cpu?.count ?? '-' }}</td>
                <td>{{ formatMemory(vm.memory_size_MiB || vm.memory?.size_MiB) }}</td>
                <td class="valeurColonne">{{ getStorageLabel(vm) }}</td>
                <td class="valeurColonne">
                  {{ formatDate(vm.creation_date || vm.create_time || vm.creation_time || vm.identity?.create_time) }}
                </td>
                <td class="cluster_label">{{ getVmClusterName(vm) }}</td>
                <td>{{ vm.folder_main || vm.folder_name || vm.folder || vm.folder_path || '-' }}</td>
              </tr>
            </tbody>
          </table>

          <div v-if="selectedVcenter && hasVms" class="pagination-controls">
            <button type="button" :disabled="isFirstPage" @click="prevPage">Précédent</button>
            <div class="page-list">
              <button
                v-for="page in pageNumbers"
                :key="page"
                type="button"
                :class="{ active: currentPage === page }"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
            </div>
            <button type="button" :disabled="isLastPage" @click="nextPage">Suivant</button>
          </div>

          <div v-if="selectedVcenter && !isLoadingVms && !hasVms" class="panel-empty">
            Aucune machine virtuelle trouvée pour ce vCenter.
          </div>
        </div>
      </main>
    </div>
    <div v-if="showBellModal" class="modal-overlay" @click.self="showBellModal = false">
      <div class="modal-panel">
        <h3>Modifications de {{ activeVmHistory?.vm || activeVmHistory?.vmUid }}</h3>
        <div v-if="isLoadingHistory" class="panel-empty">Chargement…</div>
        <div v-else>
          <div v-if="!activeVmHistory || !activeVmHistory.history || activeVmHistory.history.length === 0" class="panel-empty">
            Aucune modification enregistrée pour cette VM aujourd'hui.
          </div>
          <ul v-else class="history-list">
            <li v-for="h in activeVmHistory.history" :key="h.date + (h.modifications || '')">
              <strong>{{ new Date(h.date).toLocaleString() }}:</strong> {{ h.modifications }}
            </li>
          </ul>
        </div>

        <div class="modal-actions">
          <button type="button" @click="showBellModal = false">Fermer</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  padding: 2rem;
  font-family: 'Poppins', sans-serif;
  font-size: 15px;
}

.dashboard-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.hero-content {
  flex: 1 1 auto;
  min-width: 0;
}

.hero-content h1 {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
  min-width: 240px;
}

.logout-wrapper {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.logout-button {
  padding: 0.9rem 1.2rem;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ce4c4c;
  color: #ffffff;
  cursor: pointer;
  font-weight: 600;
}

.logout-button:hover {
  background: #ff0000;
}

.dashboard-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(240px, 320px) 1fr;
}

.dashboard-sidebar {
  display: flex;
  flex-direction: column;
}

.panel {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 0 30px rgba(15, 23, 42, 0.06);
  padding: 5px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.subtitle {
  margin: 0.35rem 0 0;
  color: #627d98;
}

.cluster_label{
  font-size: medium;
}

.status-pill {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 0.9rem;
  white-space: nowrap;
}

.vcenter-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.vcenter-list li {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.vcenter-list li.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.vcenter-list button {
  width: 100%;
  text-align: left;
  padding: 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
}

  .filter-select,
  .cluster-dropdown {
    width: 100%;
    padding: 0.9rem 1rem;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #102a43;
    font-size: 0.95rem;
    margin-top: 0.5rem;
  }

  .filter-select:focus,
  .cluster-dropdown:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .export-panel {
    margin-top: 1.25rem;
    padding: 1.25rem;
    border-radius: 16px;
    background: #f8fafc;
  }

  .export-panel .filter-header {
    margin-bottom: 1rem;
  }

  .export-field {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .export-button,
  .reset-button {
    width: 100%;
    padding: 0.95rem 1rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .export-button {
    background: #129922;
    color: #ffffff;
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .export-button:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #0a7c2c;
  }

  .export-button:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .reset-button {
    background: #e2e8f0;
    color: #0f172a;
    margin-top: 0.5rem;
  }

  .vm-table {
    width: 100%;
    border-collapse: collapse;
  }

  .vm-table th,
  .vm-table td {
    padding: 0.95rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .vm-table th {
    font-weight: 700;
    color: #334155;
    text-align: left;
  }

  .vm-table tbody tr:hover {
    background: #f8f8f8;
  }

  .valeurColonne{
    text-align: center;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .pagination-controls button {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    padding: 0.65rem 1rem;
    border-radius: 12px;
    cursor: pointer;
  }

  .pagination-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-list {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .page-list button {
    min-width: 2.4rem;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
  }

  .page-list button.active {
    background: #4e71bd;
    border-color: #5a7dca;
    color: #ffffff;
  }

  .panel-empty {
    padding: 1.25rem 0;
    color: #64748b;
  }

  .vm-name-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .row-bell-button {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.1rem;
    color: #f59e0b;
  }

  .row-bell-button:hover {
    transform: scale(1.1);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .modal-panel {
    background: #fff;
    border-radius: 12px;
    padding: 1rem;
    width: min(720px, 90%);
    max-height: 80vh;
    overflow: auto;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: grid;
    gap: 0.75rem;
  }

  .history-list li {
    padding: 0.85rem 1rem;
    background: #f8fafc;
    border-radius: 12px;
  }

  .muted {
    color: #64748b;
    font-size: 0.9rem;
  }

  .error-message {
    margin-bottom: 1rem;
    padding: 1rem;
    color: #991b1b;
    background: #fee2e2;
    border-radius: 12px;
  }

  .filter-header h2,
  .filter-label span,
  .export-panel label {
    color: #334155;
    font-size: 0.95rem;
    font-weight: 600;
  }

  :deep(.cluster-filter-panel) {
    padding: 0;
    margin-top: 1.5rem;
  }
</style>