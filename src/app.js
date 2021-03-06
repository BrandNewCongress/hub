const axios = require('axios')
const bodyParser = require('body-parser')
const express = require('express')
const log = require('./log')
const mail = require('./mail')
const maestro = require('./maestro')
const airtable = require('./airtable')
const { isEmpty } = require('./lib')
const kue = require('kue')
const basicAuth = require('basic-auth')
const apps = require('./apps')
const BSD = require('./bsd')
const apiLog = require('./api-log')
const asana = require('./asana')
const sourceMap = require('./source-map')
const nationSync = require('./nation-sync')
const qs = require('querystring')

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
    job.removeOnComplete(true).save(err => {
      if (err) {
        log.error(err)
        reject(err)
      }
      resolve()
    })
  })
}

const stripBadPunc = str => (str ? str.replace(/[",]/g, '') : str)

let source = req => {
  const toMatch = [
    req.body
      ? req.body.forceSource
        ? req.body.forceSource
        : req.body.candidate ? req.body.candidate : req.headers.origin
      : req.headers.origin
  ].filter(m => m)

  return toMatch.map(m => {
    const s = sourceMap.match(m)
    return s
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

apps.forEach(a => {
  app.use(a)
})

app.get('/cons_group/:id/count', async (req, res) => {
  const bsd = new BSD(
    process.env.BSD_API_URL,
    process.env.BSD_API_ID,
    process.env.BSD_API_SECRET
  )
  const consGroup = await bsd.getConstituentGroup(req.params.id)
  res.send({
    count: consGroup.members,
    unique_emails: consGroup.unique_emails,
    subscribed_emails: consGroup.unique_emails_subscribed
  })
})

app.get('/forms/:id/count', async (req, res) => {
  const bsd = new BSD(
    process.env.BSD_API_URL,
    process.env.BSD_API_ID,
    process.env.BSD_API_SECRET
  )
  const formCount = await bsd.getFormSignupCount(req.params.id)
  res.send({ count: formCount })
})

app.get('/teams', async (req, res) => {
  try {
    let teams = await airtable.findAll('Teams')
    teams = teams.map(team => ({
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

const fullFields = 'nominatorName nominatorEmail nominatorPhone nomineeName'.split(
  ' '
)

const minimumFields = 'nomineeName'.split(' ')
const isValidHalfBody = body => minimumFields.filter(f => !body[f]).length == 0
const isValidFullBody = body => fullFields.filter(f => !body[f]).length == 0

app.post('/nominations', apiLog, async (req, res) => {
  try {
    const body = req.body
    if (!isValidHalfBody(body)) {
      log.error(`Not enough info for ${JSON.stringify(body)}`)
      res.sendStatus(400)
      return
    }

    if (isValidFullBody(body)) {
      let sources = source(req, false)
      let tags = []
      sources.forEach(s => {
        tags.push(`Action: Nominated Candidate: ${s}`)
      })

      const createJob = queue.create('createPerson', {
        name: stripBadPunc(body.nominatorName),
        email: body.nominatorEmail,
        phone: body.nominatorPhone,
        tags: tags,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign
      })

      await saveKueJob(createJob.attempts(3))
    }

    const nominationJob = queue.create('createNomination', {
      'Nominator Name': stripBadPunc(body.nominatorName),
      'Nominator Email': body.nominatorEmail,
      'Nominator Phone': body.nominatorPhone,
      Name: stripBadPunc(body.nomineeName),
      Email: body.nomineeEmail,
      Phone: body.nomineePhone,
      City: body.nomineeCity,
      'Nominator Personal': body.nominatorPersonal !== undefined
        ? body.nominatorPersonal ? 'Yes' : 'No'
        : 'Unknown',
      'Already Running': body.alreadyRunning !== undefined
        ? body.alreadyRunning ? 'Yes' : 'No'
        : 'Unknown',
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
      'Current Political Party': body.politicalParty,
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

app.post('/people', apiLog, async (req, res) => {
  try {
    const body = req.body
    const rawSources = source(req)
    const signupSource = rawSources[0]
    const tags = rawSources.map(s => `Action: Joined Website: ${s}`)

    let ref
    if (req.headers.origin == 'https://brandnewcongress.org') {
      const queryString = req.headers.referer.split('?')[1]

      if (queryString) {
        const parsed = qs.parse(queryString)
        if (parsed.ref) {
          ref = parsed.ref
        }
      }
    }

    if (ref) {
      tags.push(`Action: Joined Website: Brand New Congress: ${ref}`)
    }

    const createJob = queue.createJob('createPerson', {
      name: stripBadPunc(body.fullName),
      email: body.email,
      phone: body.phone,
      address: {
        zip: body.zip
      },
      tags: tags,
      tagsToRemove: rawSources.map(s => `Action: Unsubscribed: ${s}`),
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
    })

    await saveKueJob(createJob.attempts(3))

    let signupTemplate = 'bnc-signup'
    if (req.headers.origin === 'https://justicedemocrats.com') {
      signupTemplate = 'jd-signup'
    }

    const name = 'friend'
    const electTarget = signupSource == 'Brand New Congress'
      ? 'a Brand New Congress'
      : `${signupSource} and a Brand New Congress!`

    await mail.sendEmailTemplate(
      body.email,
      'Thanks for signing up. This is what you can do now.',
      signupTemplate,
      { name, electTarget }
    )

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

app.post('/volunteers', apiLog, async (req, res) => {
  try {
    const body = req.body
    const addressLines = body.volunteerAddress
      ? body.volunteerAddress.split('\n')
      : []

    const address = {
      city: body.volunteerCity,
      state: body.volunteerState,
      zip: body.volunteerZip
    }

    let counter = 1
    addressLines.forEach(line => {
      if (counter > 3) {
        return
      }
      address[`address${counter}`] = line
      counter = counter + 1
    })

    let tags = (body.volunteerSkills || [])
      .concat(body.volunteerFrequency || [])

    if (body.volunteerAvailability) {
      tags.push(body.volunteerAvailability)
    }

    let sourceTags = source(req)
    sourceTags = sourceTags.map(s => `Action: Joined as Volunteer: ${s}`)

    tags = tags.concat(sourceTags)
    log.info(tags)

    const volunteerJob = queue.createJob('createPerson', {
      name: stripBadPunc(body.volunteerName),
      email: body.volunteerEmail,
      phone: body.volunteerPhone,
      address: Object.assign({}, address),
      linkedIn: body.volunteerLinkedIn,
      profile: body.volunteerProfile,
      tags
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

app.get('/people/count', (req, res) => {
  axios
    .get('http://go.brandnewcongress.org/people-count')
    .then(count => {
      res.json({ count: count.data })
    })
    .catch(err => {
      log.error(err)
      if (res.body.redirect) {
        res.redirect(res.body.redirect)
      } else {
        res.status(500).json({ err })
      }
    })
})

app.get('/conference-calls/upcoming', async (request, response) => {
  try {
    const name = typeof request.query.name === 'undefined'
      ? ''
      : unescape(request.query.name)
    const upcomingConferences = {
      conferences: []
    }

    const upcomingConferenceIds = await maestro.getUpcomingConferences(name)
    for (let index = 0; index < upcomingConferenceIds.length; index++) {
      const conferenceData = await maestro.getConferenceData(
        upcomingConferenceIds[index]
      )
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

app.post('/hooks/work-request', async (request, response) => {
  const body = request.body
  const BNCAirtable = airtable.BNCAirtable
  const teamsBase = new BNCAirtable(process.env.AIRTABLE_TEAMS_BASE)
  const requester = await teamsBase.findById('People', body.Requestor)
  const team = await teamsBase.findById('Teams', body.Team)
  const requestingTeam = await teamsBase.findById(
    'Teams',
    body['Requesting Team']
  )
  const teamLeader = await teamsBase.findById(
    'People',
    team.get('Deputy Team Leader') || team.get('Team Leader')
  )
  const users = await asana.request('GET', 'users', {
    params: { opt_fields: 'email' }
  })
  const requesterUser = users.data.data.filter(
    user => user.email.toLowerCase() === requester.get('Email').toLowerCase()
  )[0]
  const teamLeaderUser = users.data.data.filter(
    user => user.email.toLowerCase() === teamLeader.get('Email').toLowerCase()
  )[0]
  const tags = await asana.request('GET', 'tags')
  const workRequestTag = tags.data.data.filter(
    tag => tag.name === 'Work Request'
  )[0]
  const requesterProject = parseInt(
    requestingTeam.get('Asana Project').split('/').slice(-1)[0],
    10
  )
  const project = parseInt(
    team.get('Asana Project').split('/').slice(-1)[0],
    10
  )
  const ignoreKeys = [
    'id',
    'Requesting Team',
    'Description',
    'Requestor',
    'Deadline',
    'Team',
    'Name'
  ]
  const otherDetails = Object.keys(body)
    .map(key => {
      if (key[0] === '_' || ignoreKeys.indexOf(key) !== -1) {
        return null
      }
      return `${key}: ${body[key]}`
    })
    .filter(ele => ele !== null)
  const description = `
Requesting Team: ${requestingTeam.get('Name')}
Requester: ${requester.get('Name')}
Details: ${body.Description}
${otherDetails.join('\n')}
  `
  const newRequesterTask = await asana.request('POST', 'tasks', {
    data: {
      data: {
        name: `Follow-up on WR: ${body.Name}`,
        projects: [requesterProject],
        assignee: requesterUser ? requesterUser.id : null,
        due_at: body.Deadline
      }
    }
  })
  await asana.request('POST', 'tasks', {
    data: {
      data: {
        name: body.Name,
        projects: [project],
        assignee: teamLeaderUser ? teamLeaderUser.id : null,
        due_at: body.Deadline,
        parent: newRequesterTask.data.data.id,
        tags: workRequestTag ? [workRequestTag.id] : null,
        notes: description
      }
    }
  })
  response.sendStatus(200)
})

app.get('/donate', (req, res) => {
  res.redirect(
    'https://secure.actblue.com/contribute/page/bnc-candidates?refcode=brandnewcongress.org'
  )
})

app.get('/force-sync', (req, res) => {
  res.send('Starting a forced sync now!')
  nationSync().catch(ex => console.log(ex))
})

app.listen(port, () => {
  log.info(`Node app is running on port ${port}`)
})
