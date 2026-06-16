const vmHistoryService =
  require('../services/vmHistoryService')

async function getHistory(req, res) {
  try {
    const { vmUid } = req.params
    const { vcenterId } = req.query

    const history =
      await vmHistoryService.getHistory(
        vmUid,
        vcenterId
      )

    res.json(history)
  }
  catch (err) {
    res.status(500).json({
      error: err.message
    })
  }
}

module.exports = {
  getHistory
}