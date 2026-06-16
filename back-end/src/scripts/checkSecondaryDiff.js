const db = require('../db/database')
const vmDiffService = require('../services/vmDiffService')

async function run() {
  const rows = await db.query('SELECT DISTINCT vm_uid FROM vm_snapshot WHERE vcenter_id = $1', [2])
  const vmUids = rows.rows.map((r) => r.vm_uid)
  console.log('vm count for vcenter 2:', vmUids.length)
  if (vmUids.length === 0) {
    console.log('No snapshots for vcenter 2')
    return
  }

  const changed = await vmDiffService.getVmsChangedToday(vmUids, 2)
  console.log('changed vm_uids:', changed)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
