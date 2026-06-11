import axios from 'axios'
import { getAuthToken, setAuthToken, removeAuthToken } from './sessionService'

const api = axios.create({
  baseURL: '/api',
  headers: {
    Accept: 'application/json',
  },
})

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function login(username, password) {
  try {
    const response = await api.post('/auth/login', {
      username,
      password,
    })

    console.log('[login response]', response.data)
    console.log('[vCenter sessions]', response.data?.sessions)
    const token = response.data?.token
    if (token) {
      setAuthToken(token)
      console.log('[auth token]', token)
    }

    return response.data
  } catch (error) {
    console.error('[login error]', error)
    throw error
  }
}

export function logout() {
  removeAuthToken()
}

export async function getVcenterList() {
  const response = await api.get('/vcenters', { headers: authHeaders() })
  return response.data?.value ?? []
}

export async function getVcenterClusters(vcenterId = 'default') {
  const response = await api.get(`/vcenters/${encodeURIComponent(vcenterId)}/clusters`, {
    headers: authHeaders(),
  })
  return response.data?.value ?? []
}

export async function getVmStorageGb(vmId, vcenterId = 'default') {
  const response = await api.get(`/vcenters/${encodeURIComponent(vcenterId)}/vm-storage/${encodeURIComponent(vmId)}`, {
    headers: authHeaders(),
  })
  return response.data?.value ?? 0
}

export async function getVmStorageBatch(vmIds, vcenterId = 'default') {
  const response = await api.post(
    `/vcenters/${encodeURIComponent(vcenterId)}/vm-storage/batch`,
    { vmIds },
    { headers: authHeaders() },
  )
  return response.data?.value ?? {}
}

export async function getInventory(vcenterId = 'default', { page = 1, pageSize = 20 } = {}) {
  const response = await api.get(`/vcenters/${encodeURIComponent(vcenterId)}/inventory`, {
    headers: authHeaders(),
    params: { page, pageSize },
  })
  return response.data?.value ?? {
    clusters: [],
    folders: [],
    vms: [],
    pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
  }
}

export async function getAllVmsWithClusterInfo(vcenterId = 'default') {
  try {
    const response = await api.get(`/vcenters/${encodeURIComponent(vcenterId)}/all-vms-with-cluster-info`, {
      headers: authHeaders(),
    })
    return response.data?.value ?? []
  } catch (err) {
    // transient 502 from vite proxy/backend can happen immediately after login; retry once
    if (err?.response?.status === 502) {
      await new Promise((r) => setTimeout(r, 300))
      const retry = await api.get(`/vcenters/${encodeURIComponent(vcenterId)}/all-vms-with-cluster-info`, {
        headers: authHeaders(),
      })
      return retry.data?.value ?? []
    }
    throw err
  }
}

export async function getVmDiff(vmUid, vcenterId = 'default') {
  const response = await api.get(`/vm/${encodeURIComponent(vmUid)}/diff`, {
    headers: authHeaders(),
    params: { vcenterId },
  })
  return response.data ?? { vmUid, hasChangesToday: false, history: [] }
}
