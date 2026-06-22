const cron = require('node-cron')
const { exec } = require('child_process')

function runScript(name, scriptPath) {
  const startTime = new Date()

  console.log(` ${name} - Début : ${startTime.toLocaleString()}`)

  exec(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout, stderr) => {
    const endTime = new Date()
    const duration = (endTime - startTime) / 1000

    if (err) {
      console.error(` ${name} - Erreur :`, err)
      console.log(` ${name} - Fin : ${endTime.toLocaleString()}`)
      console.log(` ${name} - Durée : ${duration} secondes`)
      return
    }

    console.log(` ${name} OK`)
    console.log(` ${name} - Fin : ${endTime.toLocaleString()}`)
    console.log(` ${name} - Durée : ${duration} secondes`)
  })
}

cron.schedule('36 8 * * *', () => {
  console.log(' Cron lancé')

  runScript(
    'vCenter1',
    'D:/newproject/back-end/src/scripts/export-vcenter1.ps1'
  )

  runScript(
    'vCenter2',
    'D:/newproject/back-end/src/scripts/export-vcenter2.ps1'
  )

  console.log(' import lancé')
})