const db = require('../db/database')
const vcenters = require('../config/vcenterConfig')

function cleanString(value) {
  if (value == null) return null

  return String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u200e\u200f\u202a-\u202e\ufeff]/g, '') // invisibles/contrôle
    .replace(/[^\x00-\x7F]/g, '') // supprimer non-ASCII
    .trim()
}

async function resolveVcenterDbId(vcenterId) {
  if (Number.isInteger(vcenterId) || /^[0-9]+$/.test(String(vcenterId))) {
    return Number(vcenterId)
  }

  const config = vcenters[vcenterId]
  if (!config) {
    throw new Error(`Clé vCenter inconnue : ${vcenterId}`)
  }

  const { url, name } = config

  const result = await db.query(
    `SELECT id FROM vcenter WHERE url = $1 OR name = $2 LIMIT 1`,
    [url, name]
  )

  if (result.rows.length > 0) {
    return result.rows[0].id
  }

  const insertResult = await db.query(
    `INSERT INTO vcenter (name, url) VALUES ($1, $2) RETURNING id`,
    [name, url]
  )

  return insertResult.rows[0].id
}

async function saveSnapshot(vm, vcenterId, storageGb = null, snapshotDate = null) {
  const vmId = vm.vm || vm.id || vm.name

  // ❌ sécurité : on ignore les VM invalides
  if (!vmId) {
    console.log('⚠️ VM ignorée (pas de vm_uid)', vm)
    return
  }

  const dbVcenterId = await resolveVcenterDbId(vcenterId)

  const query = `
    INSERT INTO vm_snapshot (
      vm_uid, vcenter_id, name, os, cluster_name,
      cpu, memory_mb, storage_gb, creation_date${snapshotDate ? ', snapshot_date' : ''}
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9${snapshotDate ? ', $10' : ''})
  `

  const memoryMb =
    vm.memory_size_MiB ??
    vm.memory_mb ??
    (vm.memory_gb != null ? Number(vm.memory_gb) * 1024 : null)

  const cpu = vm.cpu_count ?? vm.cpu ?? null

  // ✅ priorité au storage calculé dans le cron
  const storage =
    storageGb ??
    vm.storage_gb ??
    vm.storage ??
    null

  const name = cleanString(vm.name)
  const os = cleanString(vm.os)
  const clusterName = cleanString(vm.cluster_name)
  const creationDate = vm.creation_date ?? null

  if (snapshotDate) {
    const latestSnapshot = await getLatestSnapshot(vmId, dbVcenterId)
    if (
      latestSnapshot &&
      latestSnapshot.snapshot_date &&
      new Date(latestSnapshot.snapshot_date).getTime() === new Date(snapshotDate).getTime()
    ) {
      return
    }
  }

  const values = [
    vmId,
    dbVcenterId,
    name,
    os,
    clusterName,
    cpu,
    memoryMb,
    storage,
    creationDate,
  ]

  if (snapshotDate) {
    values.push(snapshotDate)
  }

  await db.query(query, values)
}

async function getLatestSnapshot(vmUid, vcenterId) {
  const dbVcenterId = await resolveVcenterDbId(vcenterId)

  const result = await db.query(
    `
    SELECT *
    FROM vm_snapshot
    WHERE vm_uid = $1
      AND vcenter_id = $2
    ORDER BY snapshot_date DESC
    LIMIT 1
    `,
    [vmUid, dbVcenterId]
  )

  return result.rows[0] || null
}

module.exports = {
  saveSnapshot,
  resolveVcenterDbId,
  getLatestSnapshot
}