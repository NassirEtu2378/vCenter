const db = require('../db/database')
const vcenters = require('../config/vcenterConfig')

function cleanString(value) {
  if (value == null) return null

  return String(value)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '') // caractères invisibles
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

async function saveSnapshot(vm, vcenterId, storageGb = null) {
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
      cpu, memory_mb, storage_gb, creation_date
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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

  const values = [
    vmId,
    dbVcenterId,
    cleanString(vm.name),
    cleanString(vm.os),
    cleanString(vm.cluster_name),
    cpu,
    memoryMb,
    storage,
    vm.creation_date ?? null,
  ]

  await db.query(query, values)
}

module.exports = {
  saveSnapshot,
  resolveVcenterDbId,
}