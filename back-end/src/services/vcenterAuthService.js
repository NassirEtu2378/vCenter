const axios = require('axios')
const vcenters = require('../config/vcenterConfig')

async function login(username, password, vcenterId = 'default') {
  const vcenter = vcenters[vcenterId]

  if (!vcenter) {
    throw new Error('vCenter introuvable')
  }

  const response = await axios.post(
    `${vcenter.url}/rest/com/vmware/cis/session`,
    {},
    {
      auth: {
        username,
        password,
      },

      headers: {
        Accept: 'application/json',
      },

      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false,
      }),
    },
  )

  return response.data.value
}

module.exports = {
  login,
}