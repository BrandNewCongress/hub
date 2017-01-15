import axios from 'axios'
import log from './log'

class Nationbuilder {
  async makeRequest(method, path, body) {
    const response = await axios({
      method,
      data: body,
      url: `https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com/api/v1/${path}?access_token=${process.env.NATIONBUILDER_TOKEN}`,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      validateStatus: () => true
    })
    if (!(response.status === 409 || (response.status >= 200 && response.status <= 300))) {
      log.error(response)
    }

    return response
  }
  async createPerson({
    name,
    email,
    phone,
    address
  }) {
    let nameParts = null
    let firstName = null
    let lastName = null
    if (name) {
      nameParts = name.split(/\s+/)
    }
    if (nameParts) {
      firstName = nameParts.shift()
      lastName = nameParts.join(' ')
    }
    const requestBody = {
      person: {
        phone,
        first_name: firstName,
        last_name: lastName,
        email1: email,
        mailing_address: address
      }
    }
    return this.makeRequest('POST', 'people', requestBody)
  }
}

const BNCNationbuilderSingleton = new Nationbuilder()
export default BNCNationbuilderSingleton
