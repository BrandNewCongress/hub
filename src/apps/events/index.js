const express = require('express')
const cors = require('cors')
const client = require('nation-pool/client')
client.forceStandalone()
const { bodyRequired } = require('../../lib')
const log = require('../../log')
const format = require('./format')
const { candidateMap, calendarMap, originMap } = require('./data')

const events = express()
events.use(cors())

/*
 * GET /events
 *
 * If ?candidate=<candidate> is included, will only serve events for that candidate
 * Else, all events will be included
 *
 * Only events today and after will be included
 */

events.get('/events', async (req, res) => {
  try {
    const calendarId =
      candidateMap[req.query.candidate] || originMap[req.headers.origin]

    const date = new Date()
    const today = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`

    const query = {
      starting: today,
      limit: 100
    }

    if (calendarId) {
      Object.assign(query, { calendar_id: calendarId })
    }

    const results = await client.get('sites/brandnewcongress/pages/events', {
      query
    })

    return res.json(
      results.results
        .filter(e => e.venue.address)
        .map(format.event)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    )
  } catch (err) {
    log.error(err)
    return res
      .status(400)
      .json(err.response && err.response.body ? err.response.body : err)
  }
})

/*
 * GET /events/candidates
 *
 * Get possible candidate calendars
 */

events.get('/events/candidates', (req, res) => {
  const candidates = Object.keys(candidateMap)
  return res.json(candidates)
})

/*
 * POST /events/create
 *
 * Creates an event and returns the created event
 */

events.post(
  '/events/create',
  bodyRequired(
    'name intro start_time end_time time_zone venue host_name host_email host_phone'
  ),
  async (req, res) => {
    try {
      const candidate = req.query.candidate || req.headers.origin
      const calendarId = req.body.calendarId || candidateMap[candidate]

      if (!calendarId) {
        return res
          .status(400)
          .json({ error: 'Missing candidate query paramter' })
      }

      // create person based on host info
      const hostId = await getPersonId({
        email: req.body.host_email,
        first_name: req.body.host_name.split(' ')[0],
        last_name: req.body.host_name.split(' ').slice(-1)[0],
        phone: req.body.host_phone
      })

      // fill in defaults, set host as author_id, and mark it part of the proper calendar
      const event = Object.assign({}, req.body, {
        rsvp_form: {
          phone: 'optional',
          address: 'optional',
          accept_rsvps: true,
          gather_volunteers: true,
          allow_guests: true
        },
        venue: Object.assign(req.body.venue, {
          address1: req.body.venue.address,
          address: undefined
        }),
        status: 'unlisted',
        show_guests: false,
        calendar_id: calendarId,
        tags: 'Source: User Submitted',
        author_id: hostId
      })

      const results = await client.post('sites/brandnewcongress/pages/events', {
        body: { event }
      })

      return res.json(results.event)
    } catch (err) {
      log.error(err)
      return res
        .status(400)
        .json(err.response && err.response.body ? err.response.body : err)
    }
  }
)

/*
 * POST /events/:id/rsvp
 *
 *
 */

events.post(
  '/events/:id/rsvp',
  bodyRequired('email guests_count volunteer phone name'),
  async (req, res) => {
    try {
      const personId = await getPersonId({
        email: req.body.email,
        phone: req.body.phone,
        first_name: req.body.name.split(' ')[0],
        last_name: req.body.name.split(' ').slice(-1)[0]
      })

      const rsvp = Object.assign({}, req.body, {
        person_id: personId
      })

      const results = await client.post(
        `sites/brandnewcongress/pages/events/${req.params.id}/rsvps`,
        { body: { rsvp } }
      )

      return res.json(results.rsvp)
    } catch (err) {
      return res
        .status(400)
        .json(err.response && err.response.body ? err.response.body : err)
    }
  }
)

async function getPersonId(data) {
  let result

  try {
    const hostCreateResponse = await client.post('people', {
      body: {
        person: data
      }
    })

    result = hostCreateResponse.person.id
  } catch (err) {
    if (err.status === 409) {
      result = err.response.body.person.id
    }
  }

  return result
}

module.exports = events
