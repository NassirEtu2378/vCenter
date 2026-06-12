const db = require('../db/database')
const snapshotService = require('./snapshotService')

async function getLastSnapshots(vmUid, limit = 2) {
  const result = await db.query(
    `
    SELECT *
    FROM vm_snapshot
    WHERE vm_uid = $1
    ORDER BY snapshot_date DESC
    LIMIT $2
    `,
    [vmUid, limit]
  )

  return result.rows
}

function normalizeValue(value, isNumeric = false) {
  if (value == null) {
    return null
  }
  if (isNumeric) {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  return String(value).trim()
}

function compareSnapshots(oldSnap, newSnap) {
  const fields = [
    { key: 'cpu', label: 'CPU', numeric: true },
    { key: 'memory_mb', label: 'Mémoire (Mo)', numeric: true },
    { key: 'storage_gb', label: 'Stockage (GB)', numeric: true },
    { key: 'cluster_name', label: 'Cluster', numeric: false },
    { key: 'name', label: 'Nom', numeric: false },
  ]

  const changes = []

  for (const field of fields) {
    const oldValue = normalizeValue(oldSnap[field.key], field.numeric)
    const newValue = normalizeValue(newSnap[field.key], field.numeric)

    if (oldValue !== newValue) {
      changes.push({
        field: field.key,
        label: field.label,
        old: oldValue,
        new: newValue,
      })
    }
  }

  return changes
}

module.exports = {
  getLastSnapshots,
  compareSnapshots,
  getAllSnapshots,
  getChangeHistory,
  getVmsChangedToday,
}

async function getAllSnapshots(vmUid, vcenterId = null) {
  const dbVcenterId = vcenterId ? await snapshotService.resolveVcenterDbId(vcenterId) : null
  const result = await db.query(
    `
    SELECT *
    FROM vm_snapshot
    WHERE vm_uid = $1
      ${dbVcenterId ? 'AND vcenter_id = $2' : ''}
    ORDER BY snapshot_date ASC
    `,
    dbVcenterId ? [vmUid, dbVcenterId] : [vmUid]
  )

  return result.rows
}

function formatDiffsAsString(diffs) {
  return diffs
    .map((d) => `${d.label} : ${d.old ?? '-'} → ${d.new ?? '-'}`)
    .join(', ')
}

async function getChangeHistory(vmUid, vcenterId = null) {
  const snapshots = await getAllSnapshots(vmUid, vcenterId)
  const history = []

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]
    const diffs = compareSnapshots(prev, curr)
    if (diffs.length > 0) {
      history.push({
        date: curr.snapshot_date,
        vm: curr.name || curr.vm_uid || vmUid,
        modifications: formatDiffsAsString(diffs),
        raw: diffs,
      })
    }
  }

  
  history.sort((a, b) => new Date(b.date) - new Date(a.date))
  return history
}

async function getVmsChangedToday(vmUids = [], vcenterId = null) {
  if (!Array.isArray(vmUids) || vmUids.length === 0 || !vcenterId) return []

  const dbVcenterId = await snapshotService.resolveVcenterDbId(vcenterId)
  const result = await db.query(`
    WITH latest_today AS (
      SELECT DISTINCT ON (vm_uid) vm_uid, snapshot_date, cpu, memory_mb, storage_gb, cluster_name, name
      FROM vm_snapshot
      WHERE vm_uid = ANY($1::text[])
        AND vcenter_id = $2
        AND snapshot_date::date = current_date
      ORDER BY vm_uid, snapshot_date DESC
    ),
    latest_before_today AS (
      SELECT DISTINCT ON (vm_uid) vm_uid, snapshot_date, cpu, memory_mb, storage_gb, cluster_name, name
      FROM vm_snapshot
      WHERE vm_uid = ANY($1::text[])
        AND vcenter_id = $2
        AND snapshot_date::date < current_date
      ORDER BY vm_uid, snapshot_date DESC
    )
    SELECT t.vm_uid
    FROM latest_today t
    JOIN latest_before_today p ON p.vm_uid = t.vm_uid
    WHERE (
      COALESCE(t.cpu::text, '') <> COALESCE(p.cpu::text, '') OR
      COALESCE(t.memory_mb::text, '') <> COALESCE(p.memory_mb::text, '') OR
      COALESCE(t.storage_gb::text, '') <> COALESCE(p.storage_gb::text, '') OR
      COALESCE(t.cluster_name, '') <> COALESCE(p.cluster_name, '') OR
      COALESCE(t.name, '') <> COALESCE(p.name, '')
    )
    `,
    [vmUids, dbVcenterId]
  )

  return result.rows.map(r => r.vm_uid)
}