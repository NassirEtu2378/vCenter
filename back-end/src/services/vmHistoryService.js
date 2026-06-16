const db = require('../db/database')
const snapshotService = require('./snapshotService')

async function saveChanges(vmUid, vcenterId, vmName, changes) {
  if (!changes || changes.length === 0) {
    return
  }

  for (const change of changes) {
    await db.query(
      `
      INSERT INTO vm_historique_changement (
        vm_uid,
        vcenter_id,
        vm_name,
        libelle,
        old_value,
        new_value
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        vmUid,
        vcenterId,
        vmName,
        change.label,
        change.old,
        change.new
      ]
    )
  }
}

async function getHistory(vmUid, vcenterId = null) {
  let query = `
    SELECT *
    FROM vm_historique_changement
    WHERE vm_uid = $1
  `

  const params = [vmUid]

  if (vcenterId) {
    // resolve textual vcenter key (eg 'default') to numeric DB id
    const dbVcenterId = await snapshotService.resolveVcenterDbId(vcenterId)
    query += ` AND vcenter_id = $2`
    params.push(dbVcenterId)
  }

  query += `
    ORDER BY change_date DESC
  `

  const result = await db.query(query, params)

  return result.rows
}

async function getTodayChanges(vcenterId = null) {
  let query = `
    SELECT *
    FROM vm_historique_changement
    WHERE change_date::date = CURRENT_DATE
  `

  const params = []

  if (vcenterId) {
    const dbVcenterId = await snapshotService.resolveVcenterDbId(vcenterId)
    query += ` AND vcenter_id = $1`
    params.push(dbVcenterId)
  }

  query += `
    ORDER BY change_date DESC
  `

  const result = await db.query(query, params)

  return result.rows
}

module.exports = {
  saveChanges,
  getHistory,
  getTodayChanges
}