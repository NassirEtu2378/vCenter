const express = require('express')
const router = express.Router()

const vmController = require('../controllers/vmDiffController')
const authMiddleware = require('../middleware/authMiddleware')

// comparaison VM (diff historique)
router.get('/vm/:vmUid/diff', authMiddleware.requireAuth, vmController.getVmDiff)

module.exports = router