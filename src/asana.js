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
      log.error(ex)
    }
    return response
  }

  async requestList(method, path, options) {
    const newOptions = {}
    Object.assign(newOptions, options)
    if (newOptions.hasOwnProperty('params')) {
      newOptions.params.limit = 100
    }
    let results = {}
    let collection = []
    while (results) {
      results = await this.request(method, path, newOptions)
      collection = collection.concat(results.data.data)
      if (results.data.next_page && results.data.next_page.offset) {
        newOptions.params.offset = results.data.next_page.offset
      } else {
        break
      }
    }
    return collection
  }

}

const AsanaSingleton = new BNCAsana(process.env.ASANA_API_KEY)
module.exports = AsanaSingleton
