const cron = require('node-cron')
const vcenterService = require('../services/vcenterProxyService')
const snapshotService = require('../services/snapshotService')
const vmDiffService = require('../services/vmDiffService')
const vmHistoryService = require('../services/vmHistoryService')
const vcenters = require('../config/vcenterConfig')
const { getActiveBackendSessions } = require('../services/vcenterProxyService')
const db = require('../db/database')

let isRunning = false

async function cleanupOldSnapshots() {
  const sessionMap = getActiveBackendSessions()
  if (!sessionMap || Object.keys(sessionMap).length === 0) {
    console.log('Aucune session active ; suppression des anciens snapshots ignorée')
    return
  }

  console.log(' ANCIENNE SNAPSHOTS (J-2) SUPPRIMÉS')

  try {
    const result = await db.query(`
      DELETE FROM vm_snapshot
      WHERE snapshot_date < CURRENT_DATE - INTERVAL '1 day'
    `)

    console.log(` SNAPSHOTS SUPPRIMÉS: ${result.rowCount || 0}`)
  } catch (err) {
    console.error(' ERREUR DE SUPPRESSION:', err.message)
  }
}

async function runSnapshot(vcenterId) {
  const start = Date.now()

  console.log(`\n🟢 SNAPSHOT START: ${vcenterId}`)

  try {
    const sessionMap = getActiveBackendSessions()
    const sessionId = sessionMap[vcenterId]

    if (!sessionId) {
      throw new Error(`Aucune session active pour ${vcenterId}`)
    }

    const dbVcenterId =
      await snapshotService.resolveVcenterDbId(vcenterId)

    const vms = await vcenterService.getAllVmsWithClusterInfo(
      { sessions: { [vcenterId]: sessionId } },
      vcenterId
    )

    console.log(`--> ${vms.length} VM trouvées (${vcenterId})`)

    const processedVmIds = new Set()
    const snapshotDate = new Date()
    let i = 0

    for (const vm of vms) {
      try {
        const vmId = vm.vm || vm.id
        if (!vmId || processedVmIds.has(vmId)) continue
        processedVmIds.add(vmId)

        let storageGb = 0

        try {
          storageGb = await vcenterService.getVmStorageGb(
            { sessions: { [vcenterId]: sessionId } },
            vcenterId,
            vmId
          )
        } catch (e) {
          console.log(`Storage failed ${vmId}: ${e.message}`)
        }

        const previousSnapshot =
          await snapshotService.getLatestSnapshot(vmId, dbVcenterId)

        const currentSnapshot = {
          cpu: vm.cpu_count ?? vm.cpu ?? null,
          memory_mb: vm.memory_size_MiB ?? vm.memory_mb ?? null,
          storage_gb: storageGb,
          cluster_name: vm.cluster_name ?? null,
          name: vm.name ?? null,
        }

        if (previousSnapshot) {
          const changes =
            vmDiffService.compareSnapshots(
              previousSnapshot,
              currentSnapshot
            )

          if (changes.length > 0) {
            await vmHistoryService.saveChanges(
              vmId,
              dbVcenterId,
              vm.name,
              changes
            )

            console.log(`--> ${changes.length} changements: ${vm.name}`)
          }
        }

        await snapshotService.saveSnapshot(vm, vcenterId, storageGb, snapshotDate)

        i++
        if (i % 100 === 0) {
          console.log(`${vcenterId}: ${i}/${vms.length}`)
        }

      } catch (err) {
        console.log(`VM ERROR ${vm?.name}:`, err.message)
      }
    }

    const end = Date.now()

    console.log(`SNAPSHOT DONE: ${vcenterId}`)
    console.log(`-->Duree: ${(end - start) / 1000}s`)

  } catch (err) {
    console.error(`❌ ERREUR SNAPSHOT  ${vcenterId}:`, err.message)
  }
}

function startSnapshotJob() {
  console.log(' Snapshot commence')

  cron.schedule('10 0 * * *', async () => {
    if (isRunning) {
      console.log('autre tache effectuee')
      return
    }

    isRunning = true

    try {
      console.log('START')

      // 1. snapshot normal
      for (const vcenterId of Object.keys(vcenters)) {
        await runSnapshot(vcenterId)
      }

      // 2. nettoyage après snapshot
      await cleanupOldSnapshots()

      console.log('----->FINI')

    } finally {
      isRunning = false
    }
  })
}

module.exports = startSnapshotJob