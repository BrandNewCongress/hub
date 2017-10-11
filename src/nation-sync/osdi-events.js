const log = require('../log')
const request = require('superagent')
const bsdConstructor = require('../bsd')
const moment = require('moment-timezone')

const bsd = new bsdConstructor(
  process.env.BSD_API_URL,
  process.env.BSD_API_ID,
  process.env.BSD_API_SECRET
)

async function syncEvents() {
  // --------------------   Delete all events for now --------------------
  const bsdEvents = await bsd.searchEvents({
    date_start: '2000-01-01 00:00:00'
  })

  const responses = await bsd.deleteEvents(bsdEvents.map(e => e.event_id))
  log.info(`Done deleting events: ${JSON.stringify(responses)}`)

  // -------------------- Sync all events --------------------
  const events = await new Promise((resolve, reject) =>
    request
      .get('https://now.justicedemocrats.com/api/events')
      .end((err, res) => (err ? reject(err) : resolve(res.body)))
  )

  for (let event of events) {
    log.info(`Syncing event ${event.name}`)
    try {
      const creatorConsId = await syncContact(event.contact)
      await syncEvent(event, creatorConsId)
      log.info(`Synced event ${event.name}`)
    } catch (ex) {
      log.error(`Failed: could not sync event ${event.name}`)
      log.error(ex)
    }
  }
}

async function syncEvent(event, creatorConsId) {
  const startDatetimeSystem = moment
    .tz(event.start_date, event.location.timezone)
    .format('YYYY-MM-DD HH:mm:ss')

  const duration = moment
    .duration(moment(event.end_date).diff(moment(event.start_date)))
    .asMinutes()

  const bsdEvent = {
    name: event.title,
    event_type_id: eventTypeId(event),
    description: event.description,
    creator_cons_id: creatorConsId,
    local_timezone: bsdifyTimeZone(event.location.time_zone),
    is_searchable: 1,
    start_datetime_system: startDatetimeSystem,
    duration: duration.toString(),
    contact_phone: event.contact.phone_number,
    public_phone: 1,
    venue_name: event.location.venue,
    venue_addr1: event.location.address_lines[0],
    venue_addr2: event.name,
    venue_zip: event.location.postal_code,
    venue_city: event.location.locality,
    venue_state_cd: event.location.region,
    venue_country: 'US'
  }

  return bsd.createEvent(bsdEvent)
}

function eventTypeId(event) {
  const id = {
    Canvass: 6,
    'Organizing meeting': 4,
    Other: 7,
    Phonebank: 5,
    'Rally, march or protest': 8,
    'Tabling or Clipboarding': 9
  }[event.type]

  return id || 10
}

function bsdifyTimeZone(tz) {
  const match = {
    'America/New_York': 'US/Eastern',
    'America/Chicago': 'US/Central',
    'America/Salt_Lake_City': 'US/Mountain',
    'America/Phoenix': 'US/Arizona',
    'America/Los_Angeles': 'US/Pacific'
  }[tz]

  if (match) return match

  const city = tz.split('/')[0]
  return `US/${city}`
}

async function syncContact(contact) {
  const consData = {
    firstname: contact.name.split(' ')[0],
    lastname: contact.name.split(' ')[1],
    cons_email: {
      email: contact.email_address,
      is_subscribed: 1,
      is_primary: 1
    },
    cons_phone: [
      {
        phone: contact.phone_number,
        phone_type: 'mobile',
        is_primary: 1
      }
    ]
  }

  const cons = await bsd.setConstituentData(consData)
  return cons.id
}

module.exports = { syncEvents }
