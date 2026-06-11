const vcenterService = require('../services/vcenterProxyService')
const vcenters = require('../config/vcenterConfig')

async function login(req, res) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom d’utilisateur ou mot de passe manquant',
      })
    }

    const vcenterIds = Object.keys(vcenters)
    const sessionPromises = vcenterIds.map((vcenterId) =>
      vcenterService.openVcenterSession(username, password, vcenterId)
    )

    const sessionValues = await Promise.all(sessionPromises)
    const sessions = Object.fromEntries(vcenterIds.map((id, index) => [id, sessionValues[index]]))

    console.log('vCenter login successful:')
    vcenterIds.forEach((id) => {
      console.log(`  ${id}: ${sessions[id]}`)
    })

    const token = vcenterService.createBackendSession(sessions)
    console.log(`Backend token created: ${token}`)

    res.json({
      success: true,
      token,
      sessions,
      authorizedVcenters: Object.keys(sessions),
    })
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message || 'Authentification échouée',
    })
  }
}

module.exports = {
  login,
}