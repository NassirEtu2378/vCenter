const axios = require('axios')
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const vcenters = require('../config/vcenterConfig.js')
const csvVmMetadataService = require('./csvVmMetadataService.js')

// place session store outside of `src` so nodemon doesn't restart on writes
const SESSION_STORE_PATH = path.join(__dirname, '../../data/sessionStore.json')
const sessionStore = new Map()
const TOKEN_TTL_MS = 60 * 60 * 1000

function ensureSessionStoreFile() {
  const dir = path.dirname(SESSION_STORE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(SESSION_STORE_PATH)) {
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify({}), 'utf8')
  }
}

function loadSessionStore() {
  try {
    ensureSessionStoreFile()
    const raw = fs.readFileSync(SESSION_STORE_PATH, 'utf8') || '{}'
    const data = JSON.parse(raw)
    Object.entries(data).forEach(([token, session]) => {
      sessionStore.set(token, session)
    })
    cleanupExpiredSessions()
  } catch (err) {
    console.error('Impossible de charger le magasin de sessions backend :', err.message)
  }
}

function saveSessionStore() {
  try {
    ensureSessionStoreFile()
    const data = Object.fromEntries(sessionStore.entries())
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(data), 'utf8')
  } catch (err) {
    console.error('Impossible de sauvegarder le magasin de sessions backend :', err.message)
  }
}

function cleanupExpiredSessions() {
  const now = Date.now()
  let changed = false
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token)
      changed = true
    }
  }
  if (changed) {
    saveSessionStore()
  }
}

function generateBackendToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getVcenterConfig(vcenterId = 'default') {
  const vcenter = vcenters[vcenterId]
  if (!vcenter || !vcenter.url) {
    return null
  }
  return {
    id: vcenterId,
    name: vcenter.name || vcenterId,
    host: vcenter.url,
    description: vcenter.description || `vCenter ${vcenterId}`,
  }
}

async function openVcenterSession(username, password, vcenterId = 'default') {
  const vcenter = vcenters[vcenterId]
  if (!vcenter) {
    throw new Error('vCenter introuvable')
  }

  const response = await axios.post(
    `${vcenter.url}/rest/com/vmware/cis/session`,
    {},
    {
      auth: {
        username,
        password,
      },
      headers: {
        Accept: 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      timeout: 10000,
    },
  )

  if (!response.data || !response.data.value) {
    throw new Error('Impossible de récupérer le token vCenter')
  }

  return response.data.value
}

function createBackendSession(sessions) {
  cleanupExpiredSessions()
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) {
    throw new Error('Impossible de créer la session backend')
  }

  const token = generateBackendToken()
  sessionStore.set(token, {
    sessions,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  })
  saveSessionStore()
  return token
}

function getBackendSession(token) {
  if (!token) {
    return null
  }

  const session = sessionStore.get(token)
  if (!session) {
    return null
  }

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token)
    saveSessionStore()
    return null
  }

  return session
}

function touchBackendSession(token) {
  if (!token) return false
  const session = sessionStore.get(token)
  if (!session) return false
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token)
    saveSessionStore()
    return false
  }
  session.expiresAt = Date.now() + TOKEN_TTL_MS
  session.lastTouchedAt = Date.now()
  sessionStore.set(token, session)
  saveSessionStore()
  return true
}

function invalidateBackendSession(token) {
  if (!token) return false
  const existed = sessionStore.delete(token)
  if (existed) saveSessionStore()
  return existed
}

function getActiveBackendSessions() {
  cleanupExpiredSessions()

  return Array.from(sessionStore.values()).reduce((acc, session) => {
    if (session && session.sessions && typeof session.sessions === 'object') {
      return { ...acc, ...session.sessions }
    }
    return acc
  }, {})
}

function getVcenterSessionId(session, vcenterId) {
  if (!session.sessions || !session.sessions[vcenterId]) {
    throw new Error('Session vCenter non disponible pour ce token')
  }
  return session.sessions[vcenterId]
}

async function proxyToVcenter(session, vcenterId, method, path, data = null) {
  const vcenter = vcenters[vcenterId]
  if (!vcenter) {
    throw new Error('vCenter introuvable')
  }

  const sessionId = getVcenterSessionId(session, vcenterId)
  const url = `${vcenter.url}${path}`
  const response = await axios({
    method,
    url,
    data,
    headers: {
      Accept: 'application/json',
      'vmware-api-session-id': sessionId,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    validateStatus: (status) => status < 500,
  })

  return response.data
}

async function getClusters(session, vcenterId) {
  const response = await proxyToVcenter(session, vcenterId, 'get', '/rest/vcenter/cluster')
  return response?.value || []
}

async function getVms(session, vcenterId, clusterId = null) {
  const path = clusterId
    ? `/rest/vcenter/vm?filter.clusters=${encodeURIComponent(clusterId)}`
    : '/rest/vcenter/vm'
  const response = await proxyToVcenter(session, vcenterId, 'get', path)
  return response?.value || []
}

async function getFolders(session, vcenterId) {
  const response = await proxyToVcenter(session, vcenterId, 'get', '/rest/vcenter/folder?filter.type=VIRTUAL_MACHINE')
  return response?.value || []
}

async function getVmsByFolder(session, vcenterId, folderId) {
  const response = await proxyToVcenter(session, vcenterId, 'get', `/rest/vcenter/vm?filter.folders=${encodeURIComponent(folderId)}`)
  return response?.value || []
}

function normalizeFolderItem(folder) {
  const id = folder.folder || folder.id
  return {
    id,
    name: folder.name || folder.folder_name || 'N/A',
    parentId: folder.parent_folder || folder.parent || folder.parentFolder || null,
  }
}

function buildFolderPathResolver(foldersById) {
  const cache = new Map()

  function resolve(folderId, seen = new Set()) {
    if (!folderId || seen.has(folderId)) {
      return null
    }
    if (cache.has(folderId)) {
      return cache.get(folderId)
    }

    const folder = foldersById.get(folderId)
    if (!folder) {
      return null
    }

    seen.add(folderId)
    const parentPath = resolve(folder.parentId, seen) || []
    const path = [...parentPath, folder.name]
    cache.set(folderId, path)
    return path
  }

  return resolve
}

async function getVmFolderData(session, vcenterId) {
  const folders = await getFolders(session, vcenterId)
  const foldersById = new Map(
    folders
      .map(normalizeFolderItem)
      .filter((folder) => folder.id)
      .map((folder) => [folder.id, folder]),
  )

  const resolveFolderPath = buildFolderPathResolver(foldersById)
  const vmFolderData = new Map()

  await Promise.all(
    Array.from(foldersById.values()).map(async (folder) => {
      const vmsInFolder = await getVmsByFolder(session, vcenterId, folder.id)
      const pathSegments = resolveFolderPath(folder.id) || [folder.name]
      const folderMain = pathSegments[0] || folder.name
      const folderSubpath = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : ''
      vmsInFolder.forEach((vm) => {
        const vmId = vm.vm || vm.id
        if (!vmId || vmFolderData.has(vmId)) {
          return
        }
        vmFolderData.set(vmId, {
          folder_main: folderMain,
          folder_subpath: folderSubpath,
          folder_path: pathSegments.join('/'),
        })
      })
    }),
  )

  return vmFolderData
}

async function getVmDiskIds(session, vcenterId, vmId) {
  const response = await proxyToVcenter(session, vcenterId, 'get', `/rest/vcenter/vm/${encodeURIComponent(vmId)}/hardware/disk`)
  return response?.value || []
}

async function getVmDiskDetail(session, vcenterId, vmId, diskId) {
  const response = await proxyToVcenter(session, vcenterId, 'get', `/rest/vcenter/vm/${encodeURIComponent(vmId)}/hardware/disk/${encodeURIComponent(diskId)}`)
  return response?.value || {}
}

async function getVmStorageGb(session, vcenterId, vmId) {
  const diskIds = await getVmDiskIds(session, vcenterId, vmId)
  if (!Array.isArray(diskIds) || diskIds.length === 0) {
    return 0
  }

  const capacities = await Promise.all(
    diskIds.map(async (disk) => {
      const diskId = disk.disk || disk.key || disk.value?.disk || disk.value?.id || null
      if (!diskId) {
        return 0
      }
      const detail = await getVmDiskDetail(session, vcenterId, vmId, diskId)
      return Number(detail.capacity ?? detail.value?.capacity ?? 0)
    }),
  )

  const totalBytes = capacities.reduce((sum, capacity) => sum + capacity, 0)
  return Number((totalBytes / 1024 ** 3).toFixed(2))
}

async function getAllVmsWithClusterInfo(session, vcenterId) {
  const clusters = await getClusters(session, vcenterId)
  const folderData = await getVmFolderData(session, vcenterId)
  const vmMetadata = csvVmMetadataService.getVmMetadataForVcenter(vcenterId)

  const formatVmFolder = (vm) => {
    const vmId = vm.vm || vm.id
    const data = folderData.get(vmId)
    return {
      folder_main: data?.folder_main ?? vm.folder_name ?? vm.folder ?? vm.folder_path,
    }
  }

  const enrichVmWithMetadata = (vm) => {
    const vmName = vm.name || vm.vm || vm.id
    const metadata = vmName ? vmMetadata.get(vmName) : null

    return {
      ...vm,
      os: metadata?.OS ?? null,
      creation_date: metadata?.CreationDate ?? null,
    }
  }

  if (!Array.isArray(clusters) || clusters.length === 0) {
    const allVms = await getVms(session, vcenterId)
    return allVms.map((vm) => ({
      ...vm,
      ...formatVmFolder(vm),
      ...enrichVmWithMetadata(vm),
    }))
  }

  const clusterResults = await Promise.all(
    clusters.map(async (cluster) => {
      const clusterId = cluster.cluster || cluster.id
      const clusterName = cluster.name
      const vmsInCluster = await getVms(session, vcenterId, clusterId)
      return { clusterId, clusterName, vmsInCluster }
    }),
  )

  const allVmsMap = new Map()
  clusterResults.forEach(({ clusterId, clusterName, vmsInCluster }) => {
    vmsInCluster.forEach((vm) => {
      const vmId = vm.vm || vm.id
      if (!vmId || allVmsMap.has(vmId)) {
        return
      }
      allVmsMap.set(vmId, {
        ...vm,
        cluster: clusterId,
        cluster_name: clusterName,
        ...formatVmFolder(vm),
        ...enrichVmWithMetadata(vm),
      })
    })
  })

  return Array.from(allVmsMap.values())
}

async function getInventory(session, vcenterId) {
  const vms= await Promise.all([
    getAllVmsWithClusterInfo(session, vcenterId),
  ])

  return {
    vms,
  }
}

loadSessionStore()

module.exports = {
  createBackendSession,
  getBackendSession,
  touchBackendSession,
  invalidateBackendSession,
  getActiveBackendSessions,
  getVcenterConfig,
  openVcenterSession,
  getClusters,
  getVms,
  getAllVmsWithClusterInfo,
  getVmStorageGb,
  getInventory,
}
