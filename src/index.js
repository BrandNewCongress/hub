import axios from 'axios'
import bodyParser from 'body-parser'
import 'babel-polyfill'
import express from 'express'
import log from './log'
import wrap from './wrap'
import mail from './mail'
import maestro from './maestro'

const app = express()
const port = process.env.PORT
app.enable('trust proxy')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.post('/signup', wrap(async (req, res) => {
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
  response = await axios.get(`https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com/api/v1/people/count?access_token=${process.env.NATIONBUILDER_TOKEN}`, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, validateStatus: () => true})
  if (response) {
    res.send({ count: response.data.people_count })
  } else {
    res.sendStatus(400)
  }
}))

// get upcoming conferences REST call
// path/maestro/upcomingConferences
// Usage:
//   name : filter for conferences that contain value of "name"
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
