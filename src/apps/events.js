const express = require('express')
const cors = require('cors')
const client = require('nation-pool/client')
client.forceStandalone()

const idMap = {
  'votecoribush.com': 6,
  coribush: 6
}

const events = express()
events.use(cors())

events.get('/events', async (req, res) => {
  const candidate = req.query.candidate || req.headers.origin
  const calendarId = idMap[candidate]

  if (!calendarId) {
    return res.status(400).json({ error: 'Unknown candidate' })
  }

  const date = new Date()
  const today = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`

  const results = await client.get('sites/brandnewcongress/pages/events', {
    query: {
      calendar_id: calendarId,
      starting: today
    }
  })

  return res.json(results.results.map(e => ({
    url: `http://go.brandnewcongress.org${e.path}`,
    title: e.headline,
    startTime: new Date(e.start_time).toISOString(),
    endTime: new Date(e.end_time).toISOString(),
    timeZone: e.time_zone,
    venue: e.venue
  })).sort((a, b) => new Date(a.startTime) - new Date(b.startTime)))
})

module.exports = events
