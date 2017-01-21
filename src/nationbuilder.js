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
    address,
    utmSource,
    utmMedium,
    utmCampaign
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
    const response = await this.makeRequest('POST', 'people', requestBody)

    if (response && (response.status === 201 || response.status === 409)) {
      const personId = response.data.person.id
      await this.updatePerson(personId, {
        person: {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign
        }
      })
    } else {
      throw new Error(`Nationbuilder create person failed with status: ${response ? response.status : 'No response status received'}`)
    }
    return response
  }
  async updatePerson(id, fields) {
    return this.makeRequest('PUT', `people/${id}`, fields)
  }
}

const BNCNationbuilderSingleton = new Nationbuilder()
export default BNCNationbuilderSingleton
