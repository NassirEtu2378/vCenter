const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/authRoutes')
const vcenterRoutes = require('./routes/vcenterRoutes')
const vmRoutes = require('./routes/vmRoutes')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/vcenters', vcenterRoutes)
app.use('/api', vmRoutes)

module.exports = app