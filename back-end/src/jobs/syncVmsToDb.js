const vcenterService = require('../services/vcenterProxyService')
const snapshotService = require('../services/snapshotService')
const vcenters = require('../config/vcenterConfig')

async function syncVmsToDb(vcenterIds = Object.keys(vcenters), sessionMap) {
  if (!sessionMap || typeof sessionMap !== 'object') {
    throw new Error('sessionMap invalide pour syncVmsToDb')
  }

  for (const vcenterId of vcenterIds) {
    const sessionId = sessionMap[vcenterId]
    if (!sessionId) {
      throw new Error(`Session manquante pour ${vcenterId}`)
    }

    const vms = await vcenterService.getAllVmsWithClusterInfo(
      { sessions: { [vcenterId]: sessionId } },
      vcenterId
    )

    for (const vm of vms) {
      await snapshotService.saveSnapshot(vm, vcenterId)
    }
  }
}

module.exports = { syncVmsToDb }