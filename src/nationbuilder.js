const axios = require('axios')
const log = require('./log')
const url = require('url')
const { formatLink } = require('./lib')
const { convertTags } = require('./legacy-tag-map')

class Nationbuilder {
  async makeRequest(method, path, { body, params }) {
    let newPath = path
    if (newPath.indexOf('/api/v1') === -1) {
      newPath = `/api/v1/${newPath}`
    }
    let newParams = {}
    Object.assign(newParams, params)    
    newParams.access_token = process.env.NATIONBUILDER_TOKEN
    const response = await axios({
      method,
      data: body,
      params: newParams,
      url: `https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com${newPath}`,
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

    const response = await this.makeRequest('POST', 'people', { body: { person: requestBody } })
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
    return this.makeRequest('PUT', `people/${id}`, { body: fields })
  }

  async addTagsToPerson(id, tags) {
    const newTags = convertTags(tags)
    let tagsToPush = []
    for (let index = 0; index < newTags.length; index++) {
      tagsToPush.push(newTags[index])
      if (tagsToPush.length >= 25) {
        await this.makeRequest('PUT', `people/${id}/taggings`, { body: {
          tagging: {
            tag: tagsToPush
          }
        }})
        tagsToPush = []
      }
    }
    if (tagsToPush.length > 0) {
      await this.makeRequest('PUT', `people/${id}/taggings`, { body: {
        tagging: {
          tag: tagsToPush
        }
      }})
    }
  }
}

const BNCNationbuilderSingleton = new Nationbuilder()
module.exports = BNCNationbuilderSingleton
