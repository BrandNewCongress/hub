import axios from 'axios'
import bodyParser from 'body-parser'
import express from 'express'
import log from './log'
import wrap from './wrap'
import mail from './mail'
import maestro from './maestro'
import normalizeUrl from 'normalize-url'
import Airtable from 'airtable'
import { PhoneNumberFormat as PNF, PhoneNumberUtil } from 'google-libphonenumber'

const phoneUtil = PhoneNumberUtil.getInstance()
const app = express()
const port = process.env.PORT
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE)
app.enable('trust proxy')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Origin,Content-Type,X-Auth-Token'
  })
  return next()
})

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

async function findAll(table, filterOptions) {
  return new Promise((resolve, reject) => {
    let results = []
    airtableBase(table)
      .select(filterOptions)
      .eachPage((records, fetchNextPage) => {
        results = results.concat(records)
        fetchNextPage()
      }, (err) => {
        if (err) {
          log.error(err)
          reject(err)
        }
        resolve(results)
      })
  })
}

async function findById(table, id) {
  return new Promise((resolve, reject) => {
    airtableBase(table)
      .find(id, (err, record) => {
        if (err) {
          log.error(err)
          reject(err)
        }
        resolve(record)
      })
  })
}

async function findOne(table, formula) {
  const result = await findAll(table, {
    filterByFormula: formula,
    maxRecords: 1
  })
  return result[0]
}

async function update(table, id, fields) {
  return new Promise((resolve, reject) => {
    airtableBase(table)
      .update(id, fields, (err, record) => {
        if (err) {
          log.error(err)
          reject(err)
        }
        resolve(record)
      })
  })
}

async function create(table, fields) {
  return new Promise((resolve, reject) => {
    airtableBase(table)
      .create(fields, (err, record) => {
        if (err) {
          log.error(err)
          reject(err)
        }
        resolve(record)
      })
  })
}

function isEmpty(field) {
  if (typeof field === 'undefined' || field === null || field === '') {
    return true
  }
  if (field.hasOwnProperty('length') && field.length === 0) {
    return true
  }
  return false
}

async function createOrUpdatePerson(personId, {
  email,
  phone,
  facebook,
  linkedin,
  twitter,
  name,
  city,
  politicalParty,
  stateId,
  districtId
}) {
  let person = null
  if (personId) {
    person = await findById('People', personId)
  } else {
    person = await create('People', {
      Name: name,
      Facebook: facebook,
      LinkedIn: linkedin,
      Twitter: twitter,
      'Political Party': politicalParty
    })
  }

  const recordsToCreate = {}

  if (phone) {
    recordsToCreate['Phone Numbers'] = {
      'Phone Number': phone,
      Person: [person.id]
    }
  }

  if (email) {
    recordsToCreate.Emails = {
      Email: email,
      Person: [person.id]
    }
  }

  if (city || stateId || districtId) {
    recordsToCreate.Addresses = {
      City: city,
      State: [stateId],
      'Congressional District': [districtId],
      Person: [person.id]
    }
  }

  const personFieldsToUpdate = {}
  if (isEmpty(person.get('Name')) && name) {
    personFieldsToUpdate.Name = name
  }
  if (isEmpty(person.get('Facebook')) && facebook) {
    personFieldsToUpdate.Facebook = facebook
  }
  if (isEmpty(person.get('LinkedIn')) && linkedin) {
    personFieldsToUpdate.LinkedIn = linkedin
  }
  if (isEmpty(person.get('Twitter')) && twitter) {
    personFieldsToUpdate.Twitter = twitter
  }
  if (Object.keys(personFieldsToUpdate).length > 0) {
    await update('People', person.id, personFieldsToUpdate)
  }

  const existingEmail = await findOne('Emails', `{Email} = '${email}'`)
  if (existingEmail) {
    delete recordsToCreate.Emails
  }

  const existingPhone = await findOne('Phone Numbers', `{Phone Number} = '${phone}'`)
  if (existingPhone) {
    delete recordsToCreate['Phone Numbers']
  }

  const addressIds = person.get('Addresses')
  if (!isEmpty(addressIds)) {
    let index = 0
    for (index = 0; index < addressIds.length; index++) {
      const address = await findById('Addresses', addressIds[index])
      if ((!isEmpty(address.get('Congressional District')) && address.get('Congressional District')[0] === districtId) ||
          (!isEmpty(address.get('City')) && !isEmpty(city) && address.get('City').toLowerCase() === city.toLowerCase()) ||
          (!isEmpty(address.get('State')) && address.get('State')[0] === stateId && isEmpty(city) && isEmpty(districtId))) {
        const addressFieldsToUpdate = {}
        if (isEmpty(address.get('Congressional District')) && districtId) {
          addressFieldsToUpdate['Congressional District'] = [districtId]
        }
        if (isEmpty(address.get('City')) && city) {
          addressFieldsToUpdate.City = city
        }
        if (isEmpty(address.get('State')) && stateId) {
          addressFieldsToUpdate.State = [stateId]
        }
        await update('Addresses', address.id, addressFieldsToUpdate)
        break
      }
    }
    if (index !== addressIds.length) {
      delete recordsToCreate.Addresses
    }
  }
  const tablesToUpdate = Object.keys(recordsToCreate)
  for (let index = 0; index < tablesToUpdate.length; index++) {
    const tableToUpdate = tablesToUpdate[index]
    await create(tableToUpdate, recordsToCreate[tableToUpdate])
  }
  return person
}

async function matchPerson({
  email, phone, facebook, linkedin, twitter, name, city, stateId, districtId
}) {
  if (email) {
    const emailRecord = await findOne('Emails', `{Email} = '${email}'`)
    if (emailRecord) {
      return emailRecord.get('Person')[0]
    }
  }
  if (phone) {
    const phoneRecord = await findOne('Phone Numbers', `{Phone Number} = '${phone}'`)
    if (phoneRecord) {
      return phoneRecord.get('Person')[0]
    }
  }
  if (facebook || linkedin || twitter) {
    let matchString = 'OR('
    if (facebook) {
      matchString = `${matchString}{Facebook} = '${facebook}',`
    }
    if (linkedin) {
      matchString = `${matchString}{LinkedIn} = '${linkedin}',`
    }
    if (twitter) {
      matchString = `${matchString}{Twitter} = '${twitter}',`
    }
    matchString = `${matchString.slice(0, -1)})`

    const personRecord = await findOne('People', matchString)
    if (personRecord) {
      return personRecord.id
    }
  }
  if (name && (districtId || (city && stateId))) {
    const personRecords = await findAll('People', {
      filterByFormula: `LOWER({Name}) = '${name.toLowerCase()}'`
    })
    for (let index = 0; index < personRecords.length; index++) {
      const record = personRecords[index]
      const addressIds = record.get('Addresses')
      if (!isEmpty(addressIds)) {
        for (let innerIndex = 0; innerIndex < addressIds.length; innerIndex++) {
          const address = await findById('Addresses', addressIds[innerIndex])
          if ((!isEmpty(address.get('Congressional District')) && address.get('Congressional District')[0] === districtId) ||
            (!isEmpty(address.get('City')) && address.get('City').toLowerCase() === city.toLowerCase() && !isEmpty(address.get('State')) && address.get('State')[0] === stateId)) {
            return record.id
          }
        }
      }
    }
  }
  return null
}

app.post('/nominations', wrap(async (req, res) => {
  const body = req.body
  body.nominatorName = body.nominatorName.trim()
  body.nominatorEmail = body.nominatorEmail.trim().toLowerCase()
  body.nominatorPhone = phoneUtil.format(phoneUtil.parse(body.nominatorPhone.trim(), 'US'), PNF.INTERNATIONAL)
  body.nomineeName = body.nomineeName.trim()
  body.nomineeEmail = body.nomineeEmail.trim().toLowerCase()
  body.nomineePhone = phoneUtil.format(phoneUtil.parse(body.nomineePhone.trim(), 'US'), PNF.INTERNATIONAL)
  body.nomineeCity = toTitleCase(body.nomineeCity.trim())
  body.nomineeState = body.nomineeState.trim().toUpperCase()
  body.nomineeDistrict = body.nomineeDistrict.trim().toUpperCase() === 'AL' ? body.nomineeDistrict.trim().toUpperCase() : parseInt(body.nomineeDistrict, 10).toString()
  body.nomineeFacebook = body.nomineeFacebook && body.nomineeFacebook.toLowerCase().match('facebook.com') ? normalizeUrl(body.nomineeFacebook).toLowerCase() : null
  body.nomineeLinkedIn = body.nomineeLinkedIn && body.nomineeLinkedIn.toLowerCase().match('linkedin.com') ? normalizeUrl(body.nomineeLinkedIn).toLowerCase() : null
  body.nomineeTwitter = body.nomineeTwitter && body.nomineeTwitter.toLowerCase().match('twitter.com') ? normalizeUrl(body.nomineeTwitter).toLowerCase() : null
  body.politicalParty = toTitleCase(body.politicalParty.trim())
  body.source = body.source.trim()
  body.sourceTeamName = body.sourceTeamName.trim()
  body.submitterEmail = body.submitterEmail.trim().toLowerCase()

  const state = await findOne('States', `{Abbreviation} = '${body.nomineeState}'`)
  const stateId = state ? state.id : null
  const districtName = `${body.nomineeState}-${body.nomineeDistrict}`
  const district = await findOne('Congressional Districts', `{ID} = '${districtName}'`)
  const districtId = district ? district.id : null
  let nominator = await matchPerson({
    email: body.nominatorEmail,
    phone: body.nominatorPhone
  })
  nominator = await createOrUpdatePerson(nominator, {
    name: body.nominatorName,
    email: body.nominatorEmail,
    phone: body.nominatorPhone
  })
  let submitter = await matchPerson({
    email: body.submitterEmail
  })
  submitter = await createOrUpdatePerson(submitter, {
    email: body.submitterEmail
  })
  let nominee = await matchPerson({
    email: body.nomineeEmail,
    phone: body.nomineePhone,
    facebook: body.nomineeFacebook,
    linkedin: body.nomineeLinkedIn,
    twitter: body.nomineeTwitter,
    name: body.nomineeName,
    city: body.nomineeCity,
    stateId,
    districtId
  })
  nominee = await createOrUpdatePerson(nominee, {
    email: body.nomineeEmail,
    phone: body.nomineePhone,
    facebook: body.nomineeFacebook,
    linkedin: body.nomineeLinkedIn,
    twitter: body.nomineeTwitter,
    name: body.nomineeName,
    city: body.nomineeCity,
    politicalParty: body.politicalParty,
    stateId,
    districtId
  })

  let sourceTeam = null
  if (body.sourceTeamName) {
    sourceTeam = await findOne('Teams', `LOWER({Name}) = '${body.sourceTeamName.toLowerCase}'`)
  }

  await create('Nominations', {
    'Nominator Name': body.nominatorName,
    'Nominator Email': body.nominatorEmail,
    'Nominator Phone': body.nominatorPhone,
    Name: body.nomineeName,
    Email: body.nomineeEmail,
    Phone: body.nomineePhone,
    City: body.nomineeCity,
    State: [stateId],
    'Congressional District': [districtId],
    Facebook: body.nomineeFacebook,
    LinkedIn: body.nomineeLinkedIn,
    Twitter: body.nomineeTwitter,
    'Relationship to Nominator': body.relationship,
    Leadership: body.leadership,
    'Work History': body.work,
    'Public Speaking': body.publicSpeaking,
    'Political Views': body.politicalViews,
    'Run for Office': body.runForOffice,
    'Office Run Results': body.officeRunResults,
    'Other Info': body.otherInfo,
    'District Info': body.districtInfo,
    Person: [nominee.id],
    Source: body.source,
    'Source Details': body.sourceDetails,
    'Source Team': sourceTeam ? [sourceTeam.id] : null,
    Submitter: [submitter.id],
    Nominator: [nominator.id]
  })

  res.sendStatus(200)
}))

app.post('/people', wrap(async (req, res) => {
  const body = req.body
  let nameParts = null
  let firstName = null
  let lastName = null
  const phone = body.hasOwnProperty('phone') ? body.phone : null
  if (body.hasOwnProperty('fullName')) {
    nameParts = body.fullName.split(/\s+/)
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
      email1: body.email,
      mailing_address: {
        zip: body.zip
      }
    }
  }

  let response = null
  response = await axios
    .post(`https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com/api/v1/people?access_token=${process.env.NATIONBUILDER_TOKEN}`, requestBody, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, validateStatus: () => true })

  if (response && (response.status === 201 || response.status === 409)) {
    await mail.sendEmailTemplate(body.email, 'Thanks for signing up. This is what you can do now.', 'signup', { name: 'Friend' })
    res.sendStatus(200)
  } else {
    res.sendStatus(400)
  }
}))

app.get('/people/count', wrap(async (req, res) => {
  let response = null
  response = await axios.get(`https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com/api/v1/people/count?access_token=${process.env.NATIONBUILDER_TOKEN}`, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, validateStatus: () => true })
  if (response) {
    res.send({ count: response.data.people_count })
  } else {
    res.sendStatus(400)
  }
}))

// get upcoming conferences REST call
// path/maestro/upcomingConferences
// Usage:
//   name : filter for conferences that contain value of 'name"
app.get('/conference-calls/upcoming', wrap(async (request, response) => {
  const name = (typeof request.query.name === 'undefined') ? '' : unescape(request.query.name)

  const upcomingConferences = {
    conferences: []
  }

  const upcomingConferenceIds = await maestro.getUpcomingConferences(name)
  for (let index = 0; index < upcomingConferenceIds.length; index++) {
    const conferenceData = await maestro.getConferenceData(upcomingConferenceIds[index])
    const newMaestroConference = maestro.formattedData(conferenceData)
    upcomingConferences.conferences.push(newMaestroConference)
  }
  upcomingConferences.conferences.sort((a, b) => {
    if (a.timeInSeconds < b.timeInSeconds) {
      return -1
    }
    if (a.timeInSeconds > b.timeInSeconds) {
      return 1
    }
    return 0
  })
  response.send(upcomingConferences)
}))

app.listen(port, () => {
  log.info(`Node app is running on port ${port}`)
})
