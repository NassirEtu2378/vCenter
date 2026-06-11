const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vm_inventory',
  password: 'nassir',
  port: 5432,
})

module.exports = pool