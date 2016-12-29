import axios from 'axios'
import bodyParser from 'body-parser'
import express from 'express'
import log from './log'
import wrap from './wrap'
import mail from './mail'
import maestro from './maestro'
import normalizeUrl from 'normalize-url'
import { PhoneNumberFormat as PNF, PhoneNumberUtil } from 'google-libphonenumber'
import airtable from './airtable'
import { toTitleCase } from './lib'

const phoneUtil = PhoneNumberUtil.getInstance()
const app = express()
const port = process.env.PORT
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

app.post('/nominations', wrap(async (req, res) => {
  const body = req.body
  if (!body.nominatorName || !body.nominatorEmail || !body.nominatorPhone || !body.nomineeName) {
    res.sendStatus(400)
    return
  }
  body.nominatorName = body.nominatorName.trim()
  body.nominatorEmail = body.nominatorEmail.trim().toLowerCase()
  body.nominatorPhone = phoneUtil.format(phoneUtil.parse(body.nominatorPhone.trim(), 'US'), PNF.INTERNATIONAL)
  body.nomineeName = body.nomineeName.trim()
  body.nomineeEmail = body.nomineeEmail ? body.nomineeEmail.trim().toLowerCase() : null
  body.nomineePhone = body.nomineePhone ? phoneUtil.format(phoneUtil.parse(body.nomineePhone.trim(), 'US'), PNF.INTERNATIONAL) : null
  body.nomineeCity = body.nomineeCity ? toTitleCase(body.nomineeCity.trim()) : null
  body.nomineeState = body.nomineeState ? body.nomineeState.trim().toUpperCase() : null
  body.nomineeDistrict = body.nomineeDistrict ? (body.nomineeDistrict.trim().toUpperCase() === 'AL' ? body.nomineeDistrict.trim().toUpperCase() : parseInt(body.nomineeDistrict, 10).toString()) : null
  body.nomineeFacebook = body.nomineeFacebook && body.nomineeFacebook.toLowerCase().match('facebook.com') ? normalizeUrl(body.nomineeFacebook).toLowerCase() : null
  body.nomineeLinkedIn = body.nomineeLinkedIn && body.nomineeLinkedIn.toLowerCase().match('linkedin.com') ? normalizeUrl(body.nomineeLinkedIn).toLowerCase() : null
  body.nomineeTwitter = body.nomineeTwitter && body.nomineeTwitter.toLowerCase().match('twitter.com') ? normalizeUrl(body.nomineeTwitter).toLowerCase() : null
  body.politicalParty = body.politicalParty ? toTitleCase(body.politicalParty.trim()) : 'Unknown'
  body.source = body.source ? body.source.trim() : 'BNC Website Submission'
  body.sourceTeamName = body.sourceTeamName ? body.sourceTeamName.trim() : 'No Team'
  body.submitterEmail = body.submitterEmail ? body.submitterEmail.trim().toLowerCase() : body.nominatorEmail

  const state = await airtable.findOne('States', `{Abbreviation} = '${body.nomineeState}'`)
  const stateId = state ? state.id : null
  const districtName = `${body.nomineeState}-${body.nomineeDistrict}`
  const district = await airtable.findOne('Congressional Districts', `{ID} = '${districtName}'`)
  const districtId = district ? district.id : null
  let nominator = await airtable.matchPerson({
    email: body.nominatorEmail,
    phone: body.nominatorPhone
  })
  nominator = await airtable.createOrUpdatePerson(nominator, {
    name: body.nominatorName,
    email: body.nominatorEmail,
    phone: body.nominatorPhone
  })
  let submitter = await airtable.matchPerson({
    email: body.submitterEmail
  })
  submitter = await airtable.createOrUpdatePerson(submitter, {
    email: body.submitterEmail
  })
  let nominee = await airtable.matchPerson({
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
  nominee = await airtable.createOrUpdatePerson(nominee, {
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
    sourceTeam = await airtable.findOne('Teams', `LOWER({Name}) = '${body.sourceTeamName.toLowerCase()}'`)
  }

  const nomination = {
    'Nominator Name': body.nominatorName,
    'Nominator Email': body.nominatorEmail,
    'Nominator Phone': body.nominatorPhone,
    Name: body.nomineeName,
    Email: body.nomineeEmail,
    Phone: body.nomineePhone,
    City: body.nomineeCity,
    State: stateId ? [stateId] : null,
    'Congressional District': districtId ? [districtId] : null,
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
  }

  await airtable.create('Nominations', nomination)

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
