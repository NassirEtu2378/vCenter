<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import ClusterFilter from '@/components/ClusterFilter.vue'
import FolderFilter from '@/components/FolderFilter.vue'
import DateFilter from '@/components/DateFilter.vue'
import ExportPanel from '@/components/ExportPanel.vue'
import ModalWindow from '@/components/ModalWindow.vue'
import { getVcenterList, getVcenterClusters, getAllVmsWithClusterInfo, getVmStorageGb, getVmDiff, getVmsChangedToday, getVmHistory } from '../api/vcenter'
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
const clustersCache = new Map()
const vmsCache = new Map()
const vmStorageCache = new Map()
let currentVcenterRequestId = 0
const getVmStorageKey = (vcenterId, vmId) => `${vcenterId}||${vmId}`
const getVmUid = (vm) => vm?.vm_uid || vm?.vm || vm?.id || vm?.name || ''
const showFullHistoryModal = ref(false)
const fullHistory = ref([])

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

const loadVcenterVms = async (requestId) => {
  if (!selectedVcenter.value) {
    allVms.value = []
    vmStorage.value = {}
    vmStorageLoading.value = {}
    return
  }

  const vcenterId = selectedVcenter.value.id
  isLoadingVms.value = true
  errorMessage.value = ''

  try {
    if (requestId !== currentVcenterRequestId) return

    if (vmsCache.has(vcenterId)) {
      allVms.value = vmsCache.get(vcenterId).map((vm) => ({ ...vm }))
    } else {
      const vms = await getAllVmsWithClusterInfo(vcenterId)
      if (requestId !== currentVcenterRequestId) return
      vmsCache.set(vcenterId, vms)
      allVms.value = vms.map((vm) => ({ ...vm }))
    }

    if (requestId !== currentVcenterRequestId) return
    currentPage.value = 1
    
    if (vmStorageCache.has(vcenterId)) {
      vmStorage.value = { ...vmStorageCache.get(vcenterId) }
    } else {
      vmStorage.value = {}
    }
    vmStorageLoading.value = {}
    activeVmHistory.value = null
    showBellModal.value = false

    getVmsChangedToday(vcenterId)
      .then((changedUids) => {
        if (requestId !== currentVcenterRequestId || selectedVcenter.value?.id !== vcenterId) return
        const changedSet = new Set(changedUids)
        allVms.value = allVms.value.map((vm) => {
          vm.hasChangesToday = changedSet.has(vm.vm_uid)
          return vm
        })
        allVms.value.sort((a, b) => {
          if ((a.hasChangesToday ? 1 : 0) !== (b.hasChangesToday ? 1 : 0)) {
            return (b.hasChangesToday ? 1 : 0) - (a.hasChangesToday ? 1 : 0)
          }
          return parseDate(b.creation_date) - parseDate(a.creation_date)
        })
        if (vmsCache.has(vcenterId)) {
          vmsCache.set(vcenterId, allVms.value.map((vm) => ({ ...vm })))
        }
      })
      .catch((e) => {
        console.error('Error loading changed VMs:', e)
      })
  } catch (error) {
    if (requestId !== currentVcenterRequestId) return
    errorMessage.value =
      'Impossible de récupérer les machines virtuelles. Veuillez vérifier votre session vCenter.'
    allVms.value = []
    if (vmStorageCache.has(vcenterId)) {
      vmStorage.value = { ...vmStorageCache.get(vcenterId) }
    } else {
      vmStorage.value = {}
    }
    vmStorageLoading.value = {}
  } finally {
    if (requestId !== currentVcenterRequestId) return
    isLoadingVms.value = false
  }
}

function parseDate(str) {
  if (!str || str === '01/01/1970 00:00:00') return new Date(0)
  if (str instanceof Date) return str
  if (typeof str !== 'string') {
    const parsed = new Date(str)
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
  }

  const [date, time = '00:00:00'] = str.split(' ')
  const [day, month, year] = date.split('/')

  if (day && month && year) {
    const parsed = new Date(`${year}-${month}-${day}T${time}`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  const fallback = new Date(str)
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback
}

const viewVmHistory = async (vm) => {
  const vmUid = getVmUid(vm)
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

const loadClusters = async (requestId) => {
  if (!selectedVcenter.value) {
    clusters.value = []
    selectedCluster.value = null
    return
  }

  const vcenterId = selectedVcenter.value.id
  isLoadingClusters.value = true
  clusterError.value = ''

  try {
    if (requestId !== currentVcenterRequestId) return

    if (clustersCache.has(vcenterId)) {
      clusters.value = clustersCache.get(vcenterId)
    } else {
      const fetchedClusters = await getVcenterClusters(vcenterId)
      if (requestId !== currentVcenterRequestId) return
      clustersCache.set(vcenterId, fetchedClusters)
      clusters.value = fetchedClusters
    }
    selectedCluster.value = null
  } catch (error) {
    if (requestId !== currentVcenterRequestId) return
    clusterError.value = 'Impossible de charger les clusters.'
    clusters.value = []
    selectedCluster.value = null
  } finally {
    if (requestId !== currentVcenterRequestId) return
    isLoadingClusters.value = false
  }

  await loadVcenterVms(requestId)
}

const selectVcenter = async (vcenter) => {
  selectedVcenter.value = vcenter
  selectedFolder.value = null
  dateFrom.value = ''
  dateTo.value = ''
  clusters.value = []
  allVms.value = []
  if (vmStorageCache.has(vcenter.id)) {
    vmStorage.value = { ...vmStorageCache.get(vcenter.id) }
  } else {
    vmStorage.value = {}
  }
  vmStorageLoading.value = {}
  currentVcenterRequestId += 1
  const requestId = currentVcenterRequestId
  await loadClusters(requestId)
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

  const vcenterId = selectedVcenter.value.id
  const storageKey = getVmStorageKey(vcenterId, vmId)
  if (vmStorage.value[storageKey] != null) {
    return vmStorage.value[storageKey]
  }

  vmStorageLoading.value[storageKey] = true
  try {
    const storageGb = await getVmStorageGb(vmId, vcenterId)
    if (!selectedVcenter.value || selectedVcenter.value.id !== vcenterId) {
      return 0
    }
    vmStorage.value[storageKey] = storageGb
    if (!vmStorageCache.has(vcenterId)) {
      vmStorageCache.set(vcenterId, {})
    }
    vmStorageCache.get(vcenterId)[storageKey] = storageGb
    return storageGb
  } catch (error) {
    if (!selectedVcenter.value || selectedVcenter.value.id !== vcenterId) {
      return 0
    }
    vmStorage.value[storageKey] = 0
    return 0
  } finally {
    if (!selectedVcenter.value || selectedVcenter.value.id !== vcenterId) {
      return
    }
    vmStorageLoading.value[storageKey] = false
  }
}

const loadStorageForPage = async () => {
  const vmsToLoad = paginatedVms.value.filter((vm) => {
    const vmId = getVmUid(vm)
    const storageKey = getVmStorageKey(selectedVcenter.value?.id, vmId)
    return vmStorage.value[storageKey] === undefined
  })

  await Promise.all(
    vmsToLoad.map((vm) => {
      const vmId = getVmUid(vm)
      return fetchVmStorage(vmId)
    }),
  )
}

let storageLoadTimeout
watch(
  () => paginatedVms.value.map((vm) => getVmUid(vm)),
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
  const vmId = getVmUid(vm)
  const storageKey = getVmStorageKey(selectedVcenter.value?.id, vmId)
  if (vmStorageLoading.value[storageKey]) {
    return '...'
  }

  return vmStorage.value[storageKey] != null ? vmStorage.value[storageKey] : '-'
}

const isFirstPage = computed(() => currentPage.value === 1)
const isLastPage = computed(() => currentPage.value === pageCount.value)

const goToPage = (page) => {
  if (page >= 1 && page <= pageCount.value) {
    currentPage.value = page
  }
}

const openFullHistory = async (vmUid) => {
  try {
    const res = await getVmHistory(vmUid, selectedVcenter.value.id)
    const rows = Array.isArray(res) ? res : (res.value || res.history || [])
    fullHistory.value = rows.map((item) => ({
      ...item,
      date: item.date || item.change_date,
      modifications:
        item.modifications ||
        item.history_text ||
        `${item.libelle || ''}${item.old_value != null || item.new_value != null ? `: ${item.old_value ?? ''} → ${item.new_value ?? ''}` : ''}`,
    }))
    showFullHistoryModal.value = true
  } catch (e) {
    console.error(e)
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
              <tr v-for="vm in paginatedVms" :key="getVmUid(vm)">
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
    <ModalWindow
      :visible="showBellModal"
      :title="`Modifications de ${activeVmHistory?.vm || activeVmHistory?.vmUid}`"
      @close="showBellModal = false"
    >
      <div v-if="isLoadingHistory" class="panel-empty">Chargement…</div>

      <div v-else>
        <div v-if="!activeVmHistory?.history?.length" class="panel-empty">
          Aucune modification enregistrée pour cette VM aujourd'hui.
        </div>

        <ul v-else class="history-list">
          <li v-for="h in activeVmHistory.history" :key="h.date + (h.modifications || '')">
            <strong>{{ new Date(h.date).toLocaleString() }}:</strong>
            {{ h.modifications }}
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="historique_modal"
          @click="openFullHistory(activeVmHistory.vmUid)"
        >
          Historique
        </button>

        <button
          type="button"
          class="fermer_modal"
          @click="showBellModal = false"
        >
          Fermer
        </button>
      </div>
    </ModalWindow>

    <ModalWindow
      :visible="showFullHistoryModal"
      title="Historique complet"
      width="min(620px, 80%)"
      maxHeight="70vh"
      :zIndex="70"
      overlayClass="full-history-overlay"
      panelClass="full-history-panel"
      @close="showFullHistoryModal = false"
    >
      <div v-if="!fullHistory.length" class="panel-empty">
        Aucun historique disponible.
      </div>

      <ul v-else class="history-list">
        <li v-for="h in fullHistory" :key="h.date + (h.modifications || '')">
          <strong>{{ new Date(h.date).toLocaleString() }}:</strong>
          {{ h.modifications }}
        </li>
      </ul>

      <div class="modal-actions">
        <button
          type="button"
          class="fermer_modal"
          @click="showFullHistoryModal = false"
        >
          Fermer
        </button>
      </div>
    </ModalWindow>
  </section>
</template>

<style scoped src="@/assets/css/dashboard.css"></style>