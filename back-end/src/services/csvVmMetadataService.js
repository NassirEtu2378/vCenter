const fs = require('fs')
const path = require('path')

const CSV_FOLDER = path.join(__dirname, '../scripts')
const CSV_FILE_PREFIX = 'VM_List_'
const CSV_FILE_SUFFIX = '.csv'

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ';') {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

function loadCsvForVcenter(vcenterId = 'default') {
  const filePath = path.join(CSV_FOLDER, `${CSV_FILE_PREFIX}${vcenterId}${CSV_FILE_SUFFIX}`)
  if (!fs.existsSync(filePath)) {
    return new Map()
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '')
  if (lines.length === 0) {
    return new Map()
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, '').trim().toLowerCase())
  const nameIndex = headers.indexOf('name')
  const osIndex = headers.indexOf('os')
  const creationIndex = headers.indexOf('creationdate')

  if (nameIndex === -1) {
    return new Map()
  }

  const map = new Map()
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line)
    const name = values[nameIndex] ? values[nameIndex].replace(/^"|"$/g, '').trim() : ''
    if (!name) {
      continue
    }

    const os = osIndex !== -1 ? values[osIndex].replace(/^"|"$/g, '').trim() : null
    const creationDate = creationIndex !== -1 ? values[creationIndex].replace(/^"|"$/g, '').trim() : null

    map.set(name, {
      Name: name,
      OS: os || null,
      CreationDate: creationDate || null,
    })
  }

  return map
}

function getVmMetadataForVcenter(vcenterId = 'default') {
  return loadCsvForVcenter(vcenterId)
}

module.exports = {
  getVmMetadataForVcenter,
}
