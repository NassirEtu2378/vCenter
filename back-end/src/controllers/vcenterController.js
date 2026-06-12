const vcenterService = require('../services/vcenterProxyService')
const vmDiffService = require('../services/vmDiffService')

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

async function getVcenters(req, res) {
  try {
    const authorizedIds = Object.keys(req.authSession.sessions || {})
    const configs = authorizedIds
      .map((vcenterId) => vcenterService.getVcenterConfig(vcenterId))
      .filter(Boolean)
    res.json({ success: true, value: configs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur interne du serveur' })
  }
}

async function getClusters(req, res) {
  try {
    const vcenterId = req.params.vcenterId
    const clusters = await vcenterService.getClusters(req.authSession, vcenterId)
    res.json({ success: true, value: clusters })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de la récupération des clusters' })
  }
}

async function getAllVmsWithClusterInfo(req, res) {
  try {
    const vcenterId = req.params.vcenterId

    let vms = await vcenterService.getAllVmsWithClusterInfo(
      req.authSession,
      vcenterId
    )
    vms = vms.map((vm) => {
      const vmUid = vm.vm || vm.id || vm.name
      return {
        ...vm,
        vm_uid: vmUid,
        creation_date: vm.creation_date || vm.create_time || vm.creation_time || vm.identity?.create_time || null,
        hasChangesToday: false,
      }
    })

    // sort by creation date desc only (hasChangesToday will be added by frontend)
    vms = vms.sort((a, b) => {
      return parseDate(b.creation_date) - parseDate(a.creation_date)
    })

    res.json({ success: true, value: vms })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la récupération des machines virtuelles'
    })
  }
}

async function getVmStorage(req, res) {
  try {
    const vcenterId = req.params.vcenterId
    const { vmId } = req.params
    const storageGb = await vcenterService.getVmStorageGb(req.authSession, vcenterId, vmId)
    res.json({ success: true, value: storageGb })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de la récupération du stockage VM' })
  }
}

async function getInventory(req, res) {
  try {
    const vcenterId = req.params.vcenterId
    const inventory = await vcenterService.getInventory(req.authSession, vcenterId)
    res.json({ success: true, value: inventory })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de la récupération de l’inventaire' })
  }
}

async function getVmsChangedToday(req, res) {
  try {
    const vcenterId = req.params.vcenterId

    // récupérer tous les VMs du vCenter
    const vms = await vcenterService.getAllVmsWithClusterInfo(req.authSession, vcenterId)
    const vmUidList = vms.map(vm => vm.vm || vm.id || vm.name).filter(Boolean)

    // récupérer juste les vm_uids modifiées aujourd'hui
    const changedVmUids = await vmDiffService.getVmsChangedToday(vmUidList, vcenterId)

    res.json({ success: true, value: changedVmUids })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de la récupération des VMs modifiées' })
  }
}

module.exports = {
  getVcenters,
  getClusters,
  getAllVmsWithClusterInfo,
  getVmStorage,
  getInventory,
  getVmsChangedToday,
}
