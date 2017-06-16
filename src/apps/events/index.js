const express = require('express')
const cors = require('cors')
const client = require('nation-pool/client')
client.forceStandalone()
const { bodyRequired } = require('../../lib')
const mail = require('../../mail')
const log = require('../../log')
const format = require('./format')
const { calendarMap, followers } = require('./data')
const sourceMap = require('../../source-map')

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
    const candidate = sourceMap.match(req.query.candidate)
    const calendarId = candidate == 'Brand New Congress'
      ? null
      : calendarMap.fromCandidate[candidate]

    const date = new Date()
    const today = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`

    const query = {
      starting: today,
      limit: 100
    }

    if (calendarId) {
      Object.assign(query, { calendar_id: calendarId })
    } else {
      if (req.query.candidate) {
        return res
          .status(400)
          .json({ error: `Invalid candidate ${req.query.candidate}` })
      }
    }

    const results = await client.get('sites/brandnewcongress/pages/events', {
      query
    })

    return res.json(
      results.results
        .filter(e => e.venue.address && e.status != 'unlisted')
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
  const candidates = [...new Set(sourceMap.sources.map(([_, name]) => name))]
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
      const candidate = sourceMap.match(req.query.candidate)
      const calendarId = candidate
        ? calendarMap.fromCandidate[candidate]
        : false

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

      // format venue
      const { name, city, state } = req.body.venue
      const address = {
        address1: req.body.venue.address,
        city,
        state
      }

      const venue = { name, address }

      // fill in defaults, set host as author_id, and mark it part of the proper calendar
      const event = Object.assign({}, req.body, {
        rsvp_form: {
          phone: 'optional',
          address: 'optional',
          accept_rsvps: true,
          gather_volunteers: true,
          allow_guests: true
        },
        autoresponse: {
          broadcaster_id: 21,
          subject: `RSVP Confirmation: ${req.body.name}`,
          body: `{{ recipient.first_name_or_friend }} --

Thank you for your RSVP.

{% include "mailing_event" %}

If you need to update or cancel your RSVP, use this link:

{{ edit_url }}

And you can invite others to join you at the event with this link:

{{ page_url }}`
        },
        venue: venue,
        status: 'unlisted',
        show_guests: false,
        calendar_id: calendarId,
        tags: 'Source: User Submitted',
        author_id: hostId,
        contact: {
          name: req.body.host_name,
          phone: req.body.host_phone,
          email: req.body.host_email
        }
      })

      const results = await client.post('sites/brandnewcongress/pages/events', {
        body: { event }
      })

      // response
      res.json(results.event)

      // post response hook
      mail.sendEmailTemplate(
        'sam@brandnewcongress.org',
        'New User Submitted Event!',
        'user-event',
        Object.assign(format.event(results.event), {candidate: req.query.candidate}, results.event)
      )
    } catch (err) {
      log.error(err)
      console.log(err)
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
      const event = await client.get(`sites/brandnewcongress/pages/events/${req.params.id}`)
      const calendar  = await client.get(`sites/brandnewcongress/pages/calendars/${event.calendar_id}`)
      const candidateName = calendar.name
      const tagName = `Action: RSVP: ${candidateName}`
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
      await client.put(`people/${personId}/taggings`, { body: { tagging: { tag: [tagName] } } })

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
