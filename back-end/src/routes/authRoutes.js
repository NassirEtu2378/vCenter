const express = require('express')
const router = express.Router()

const authController = require('../controllers/authController')

router.post('/login', authController.login)
router.post('/keepalive', authController.keepalive)
router.post('/invalidate', authController.invalidate)

module.exports = router