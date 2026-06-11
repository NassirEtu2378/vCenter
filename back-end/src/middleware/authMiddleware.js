const vcenterService = require('../services/vcenterProxyService')

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token d’authentification manquant' })
  }

  const token = authHeader.substring(7).trim()
  const session = vcenterService.getBackendSession(token)
  if (!session) {
    return res.status(401).json({ success: false, message: 'Session invalide ou expirée' })
  }

  const vcenterId = req.params.vcenterId
  if (vcenterId && (!session.sessions || !session.sessions[vcenterId])) {
    return res.status(403).json({ success: false, message: 'Accès au vCenter non autorisé pour ce token' })
  }

  req.authSession = session
  req.authVcenterId = vcenterId
  next()
}

module.exports = {
  requireAuth,
}
