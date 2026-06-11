const path = require('path')
const vmDiffService = require(path.join(__dirname, '..', 'src', 'services', 'vmDiffService'))

const vmUid = process.argv[2] || ''

async function main() {
  try {
    if (!vmUid) {
      console.log('Usage: node scripts/testVmDiff.js <vmUid>')
      process.exit(0)
    }

    const history = await vmDiffService.getChangeHistory(vmUid)
    console.log(JSON.stringify(history, null, 2))
    process.exit(0)
  } catch (err) {
    console.error('Erreur:', err.message)
    process.exit(1)
  }
}

main()
