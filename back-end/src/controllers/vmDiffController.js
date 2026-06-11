const vmDiffService = require('../services/vmDiffService')

async function getVmDiff(req, res) {
  try {
    const { vmUid } = req.params
    const vcenterId = req.query.vcenterId

    const history = await vmDiffService.getChangeHistory(vmUid, vcenterId)

    const today = new Date().toISOString().slice(0, 10)
    const hasChangesToday = history.some((h) => new Date(h.date).toISOString().slice(0, 10) === today)

    res.json({
      vmUid,
      hasChangesToday,
      history,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getVmDiff }