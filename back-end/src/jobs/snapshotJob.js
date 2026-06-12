const cron = require('node-cron')
const vcenterService = require('../services/vcenterProxyService')
const snapshotService = require('../services/snapshotService')
const vcenters = require('../config/vcenterConfig')
const { getActiveBackendSessions } = require('../services/vcenterProxyService')

let isRunning = false

async function runSnapshot(vcenterId) {
  const start = Date.now()

  console.log(`\n🟢 SNAPSHOT START: ${vcenterId}`)

  try {
    const sessionMap = getActiveBackendSessions()
    const sessionId = sessionMap[vcenterId]

    if (!sessionId) {
      throw new Error(`Aucune session active trouvée pour ${vcenterId}. Connectez-vous via l'interface.`)
    }

    const vms = await vcenterService.getAllVmsWithClusterInfo(
      { sessions: { [vcenterId]: sessionId } },
      vcenterId
    )

    console.log(`📦 ${vms.length} VM trouvées (${vcenterId})`)

    let i = 0

    for (const vm of vms) {
      try {
        const vmId = vm.vm || vm.id

        //STORAGE (dans même boucle)
        let storageGb = 0

        try {
          storageGb = await vcenterService.getVmStorageGb(
            { sessions: { [vcenterId]: sessionId } },
            vcenterId,
            vmId
          )
        } catch (e) {
          console.log(`Storage failed ${vmId}:`, e.message)
        }

        await snapshotService.saveSnapshot(vm, vcenterId, storageGb)

        i++

        if (i % 100 === 0) {
          console.log(`${vcenterId}: ${i}/${vms.length}`)
        }

      } catch (err) {
        console.log(`VM ERROR ${vm.name}`, err.message)
      }
    }

    const end = Date.now()

    console.log(`SNAPSHOT DONE: ${vcenterId}`)
    console.log(`Duration: ${(end - start) / 1000}s`)
  } catch (err) {
    console.error(`SNAPSHOT ERROR ${vcenterId}:`, err.message)
  }
}

function startSnapshotJob() {
  console.log('🚀 Snapshot job initialized')

  cron.schedule('41 8 * * *', async () => {
    if (isRunning) {
      console.log('Job already running')
      return
    }

    isRunning = true

    try {
      console.log(' NIGHT SNAPSHOT START')

      for (const vcenterId of Object.keys(vcenters)) {
        await runSnapshot(vcenterId)
      }

      console.log('ALL DONE')

    } finally {
      isRunning = false
    }
  })
}

module.exports = startSnapshotJob