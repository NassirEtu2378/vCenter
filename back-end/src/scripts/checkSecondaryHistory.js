const db = require('../db/database')

async function run() {
  const res = await db.query(
    `SELECT vm_uid, count(*) AS cnt, min(change_date) AS first_change, max(change_date) AS last_change
     FROM vm_historique_changement
     WHERE change_date::date = CURRENT_DATE
       AND vcenter_id = $1
     GROUP BY vm_uid`,
    [2]
  )
  console.log(JSON.stringify(res.rows, null, 2))

  const all = await db.query(
    `SELECT count(*) AS total
     FROM vm_historique_changement
     WHERE vcenter_id = $1`,
    [2]
  )
  console.log('total secondary history rows', all.rows[0].total)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
