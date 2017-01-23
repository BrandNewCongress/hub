import axios from 'axios'
import log from './log'
import url from 'url'
import { formatLink, formatDistrictCode } from './lib'

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

  async createVolunteer(personInfo) {
    const person = await this.createPerson(personInfo)

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
    congressionalDistrict,
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
    const linkedInURL = formatLink(linkedIn)
    let twitterName = null
    let linkedInID = null
    if (twitterURL) {
      twitterName = url.parse(twitterURL).pathname.split('/')[1]
    }
    if (linkedInURL) {
      linkedInID = url.parse(linkedInURL).pathname.split('/')[2]
    }
    const utmParameters = {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign
    }

    const requestBody = {
      phone,
      facebook_profile_url: facebookURL,
      twitter_login: twitterName,
      linkedin_id: linkedInID,
      first_name: firstName,
      last_name: lastName,
      email1: email,
      mailing_address: address,
      federal_district: formatDistrictCode(congressionalDistrict)
    }
    const response = await this.makeRequest('POST', 'people', { person: requestBody })
    if (response && response.status === 409) {
      const personId = response.data.person.id
      const personProfile = response.data.person.note
      if (tags) {
        await this.addTagsToPerson(personId, tags)
      }
      const updateResponse = await this.updatePerson(personId, {
        person: {
          note: `${personProfile}; ${profile}`,
          ...requestBody,
          ...utmParameters
        }
      })

      return updateResponse
    }
    if (response && response.status === 201) {
      const personId = response.data.person.id
      const personProfile = response.data.person.note
      if (tags) {
        await this.addTagsToPerson(personId, tags)
      }
      const updateResponse = await this.updatePerson(personId, {
        person: {
          note: `${personProfile}; ${profile}`,
          ...utmParameters
        }
      })
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
export default BNCNationbuilderSingleton
