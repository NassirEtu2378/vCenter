const express = require('express')
const router = express.Router()
const vcenterController = require('../controllers/vcenterController')
const authMiddleware = require('../middleware/authMiddleware')

router.get('/', authMiddleware.requireAuth, vcenterController.getVcenters)
router.get('/:vcenterId/inventory', authMiddleware.requireAuth, vcenterController.getInventory)
router.get('/:vcenterId/clusters', authMiddleware.requireAuth, vcenterController.getClusters)
router.get('/:vcenterId/all-vms-with-cluster-info', authMiddleware.requireAuth, vcenterController.getAllVmsWithClusterInfo)
router.get('/:vcenterId/vm-storage/:vmId', authMiddleware.requireAuth, vcenterController.getVmStorage)
module.exports = router
