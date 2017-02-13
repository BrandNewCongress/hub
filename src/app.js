import axios from 'axios'
import bodyParser from 'body-parser'
import express from 'express'
import log from './log'
import mail from './mail'
import maestro from './maestro'
import airtable from './airtable'
import { isEmpty } from './lib'
import kue from 'kue'
import basicAuth from 'basic-auth'

function auth(username, password) {
  return (req, res, next) => {
    const user = basicAuth(req)

    if (!user || user.name !== username || user.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
      return res.send(401)
    }
    return next()
  }
}

const queue = kue.createQueue({
  redis: process.env.REDIS_URL
})

const app = express()
const port = process.env.PORT
async function saveKueJob(job) {
  return new Promise((resolve, reject) => {
    job.removeOnComplete(true).save((err) => {
      if (err) {
        log.error(err)
        reject(err)
      }
      resolve()
    })
  })
}
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
app.use('/queue', auth('admin', process.env.QUEUE_PASSWORD), kue.app)
app.get('/teams', async (req, res) => {
  try {
    let teams = await airtable.findAll('Teams')
    teams = teams.map((team) => ({
      name: team.get('Name')
    }))
    res.send(JSON.stringify(teams))
  } catch (ex) {
    log.error(ex)
    if (req.body.redirect) {
      res.redirect(req.body.redirect)
    } else {
      res.sendStatus(200)
    }
  }
})

app.post('/nominations', async (req, res) => {
  try {
    const body = req.body
    if (!body.nominatorName || !body.nominatorEmail || !body.nominatorPhone || !body.nomineeName) {
      res.sendStatus(400)
      return
    }

    const createJob = queue.create('createPerson', {
      name: body.nominatorName,
      email: body.nominatorEmail,
      phone: body.nominatorPhone,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign
    })
    await saveKueJob(createJob.attempts(3))

    const nominationJob = queue.create('createNomination', {
      'Nominator Name': body.nominatorName,
      'Nominator Email': body.nominatorEmail,
      'Nominator Phone': body.nominatorPhone,
      Name: body.nomineeName,
      Email: body.nomineeEmail,
      Phone: body.nomineePhone,
      City: body.nomineeCity,
      'State Abbreviation': body.nomineeState,
      'Congressional District Code': body.nomineeDistrict,
      Facebook: body.nomineeFacebook,
      LinkedIn: body.nomineeLinkedIn,
      Twitter: body.nomineeTwitter,
      'Relationship to Nominator': body.relationship,
      Leadership: body.leadership,
      'Work History': body.work,
      'Public Speaking': body.publicSpeaking,
      'Political Views': body.politicalViews,
      'Political Party': body.politicalParty,
      'Run for Office': body.runForOffice,
      'Office Run Results': body.officeRunResults,
      'Other Info': body.otherInfo,
      'District Info': body.districtInfo,
      Source: isEmpty(body.source) ? 'BNC Website' : body.source,
      'Source Details': body.sourceDetails,
      'Source Team Name': body.sourceTeamName,
      'Submitter Email': body.submitterEmail,
      Profile: body.nomineeProfile,
      'Other Links': body.nomineeLinks,
      'UTM Source': body.utmSource,
      'UTM Medium': body.utmMedium,
      'UTM Campaign': body.utmCampaign
    })

    await saveKueJob(nominationJob.attempts(3).backoff(true))

    if (body.redirect) {
      res.redirect(body.redirect)
    } else {
      res.sendStatus(200)
    }
  } catch (ex) {
    log.error(ex)
    if (req.body.redirect) {
      res.redirect(req.body.redirect)
    } else {
      res.sendStatus(200)
    }
  }
})

app.post('/people', async (req, res) => {
  try {
    const body = req.body
    const createJob = queue.createJob('createPerson', {
      name: body.fullName,
      email: body.email,
      phone: body.phone,
      address: {
        zip: body.zip
      },
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign
    })
    await saveKueJob(createJob.attempts(3))
    let signupTemplate = 'bnc-signup'
    if (body.source === 'justicedemocrats') {
      signupTemplate = 'jd-signup'
    }
    await mail.sendEmailTemplate(body.email, 'Thanks for signing up. This is what you can do now.', signupTemplate, { name: 'Friend' })

    if (body.redirect) {
      res.redirect(body.redirect)
    } else {
      res.sendStatus(200)
    }
  } catch (ex) {
    log.error(ex)
    if (req.body.redirect) {
      res.redirect(req.body.redirect)
    } else {
      res.sendStatus(200)
    }
  }
})

app.get('/person/:id', async (req, res) => {
  airtable.getPersonWithEvaluations(req.params.id, (err, person) => {
    if (err)
      return res.status(400).json(err)

    return res.json(person)
  })
})

app.put('/person/:id', async (req, res) => {
  try {
    const {
      emails, phones, facebook, linkedin, twitter, name, city,
      politicalParty, stateId, districtId, profile, otherLinks,
      evaluations, nominations, gender, addresses, religion, occupations,
      potentialVolunteer,
    } = req.body


    await saveKueJob(queue.createJob('editPerson', {
      personId: req.params.id,
      data: {
        emails, phones, facebook, linkedin, twitter, name, city,
        politicalParty, stateId, districtId, profile, otherLinks,
        evaluations, nominations, gender, addresses, religion, occupations,
        potentialVolunteer,
      }
    }).attempts(1))

    res.json(req.body)
  } catch (ex) {
    log.error(ex)
    res.status(400).json(ex)
  }
})

app.post('/volunteers', async (req, res) => {
  try {
    const body = req.body
    const addressLines = body.volunteerAddress ? body.volunteerAddress.split('\n') : []
    const address = {
      city: body.volunteerCity,
      state: body.volunteerState,
      zip: body.volunteerZip
    }
    let counter = 1
    addressLines.forEach((line) => {
      if (counter > 3) {
        return
      }
      address[`address${counter}`] = line
      counter = counter + 1
    })
    const volunteerJob = queue.createJob('createPerson', {
      name: body.volunteerName,
      email: body.volunteerEmail,
      phone: body.volunteerPhone,
      address: {
        ...address
      },
      linkedIn: body.volunteerLinkedIn,
      profile: body.volunteerProfile,
      tags: body.volunteerSkills
    })
    await saveKueJob(volunteerJob)
    if (body.redirect) {
      res.redirect(body.redirect)
    } else {
      res.sendStatus(200)
    }
  } catch (ex) {
    log.error(ex)
    if (req.body.redirect) {
      res.redirect(req.body.redirect)
    } else {
      res.sendStatus(200)
    }
  }
})

app.get('/people/count', async (req, res) => {
  try {
    let response = null
    response = await axios.get(`https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com/api/v1/people/count?access_token=${process.env.NATIONBUILDER_TOKEN}`, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, validateStatus: () => true })
    if (response) {
      res.send({ count: response.data.people_count })
    } else {
      res.sendStatus(400)
    }
  } catch (ex) {
    log.error(ex)
    if (req.body.redirect) {
      res.redirect(req.body.redirect)
    } else {
      res.sendStatus(200)
    }
  }
})

app.get('/conference-calls/upcoming', async (request, response) => {
  try {
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
  } catch (ex) {
    log.error(ex)
    if (request.body.redirect) {
      response.redirect(request.body.redirect)
    } else {
      response.sendStatus(200)
    }
  }
})

app.listen(port, () => {
  log.info(`Node app is running on port ${port}`)
})
