const axios = require('axios')
const log = require('./log')

class BNCAsana {
  constructor(accessToken) {
    this.accessToken = accessToken
  }

  async request(method, path, options) {
    let config = {
      method,
      url: `https://app.asana.com/api/1.0/${path}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    }
    config = Object.assign(config, options)
    let response = null
    try {
      response = await axios(config)
    } catch (ex) {
      log.error(ex.response.data)
    }
    return response
  }
}

const AsanaSingleton = new BNCAsana(process.env.ASANA_API_KEY)
module.exports = AsanaSingleton
