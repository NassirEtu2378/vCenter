const express = require('express')
const router = express.Router()

const vmController = require('../controllers/vmDiffController')
const authMiddleware = require('../middleware/authMiddleware')
const vmHistoryController = require('../controllers/vmHistoryController')

router.get('/vm/:vmUid/history', authMiddleware.requireAuth, vmHistoryController.getHistory)
router.get('/vm/:vmUid/diff', authMiddleware.requireAuth, vmController.getVmDiff)

module.exports = router