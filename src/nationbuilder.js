const axios = require('axios')
const log = require('./log')
const url = require('url')
const { formatLink } = require('./lib')

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
    profile,
    email,
    phone,
    address,
    facebook,
    twitter,
    linkedIn,
    source,
    utmSource,
    utmMedium,
    utmCampaign,
    tags
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
    const facebookURL = formatLink(facebook)
    const twitterURL = formatLink(twitter)
    let twitterName = null
    if (twitterURL) {
      twitterName = url.parse(twitterURL).pathname.split('/')[1]
    }

    const requestBody = {
      phone,
      source,
      facebook_profile_url: facebookURL,
      twitter_login: twitterName,
      first_name: firstName,
      last_name: lastName,
      email1: email,
      mailing_address: address,
      linkedin: formatLink(linkedIn),
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign
    }

    const response = await this.makeRequest('POST', 'people', { person: requestBody })
    if (response && (response.status === 409 || response.status === 201)) {
      const personId = response.data.person.id
      const personProfile = response.data.person.note
      if (tags) {
        await this.addTagsToPerson(personId, tags)
      }
      const newRequest = {
        person: { }
      }
      if (profile) {
        newRequest.person.note = personProfile ? `${personProfile}; ${profile}` : profile
      }
      if (response.status === 409) {
        newRequest.person = Object.assign(newRequest.person, requestBody)
        delete newRequest.person.email1
      }
      const updateResponse = await this.updatePerson(personId, newRequest)
      return updateResponse
    }

    throw new Error(`Nationbuilder create person failed with status: ${response ? response.status : 'No response status received'}`)
  }

  async updatePerson(id, fields) {
    return this.makeRequest('PUT', `people/${id}`, fields)
  }

  async addTagsToPerson(id, tags) {
    return this.makeRequest('PUT', `people/${id}/taggings`, {
      tagging: {
        tag: tags
      }
    })
  }
}

const BNCNationbuilderSingleton = new Nationbuilder()
module.exports = BNCNationbuilderSingleton
