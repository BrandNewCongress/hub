const bsdConstructor = require('./bsd')
const nationbuilder = require('./nationbuilder')
const moment = require('moment')
const log = require('./log')
const Baby = require('babyparse')
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)
const redisClient = redis.createClient(process.env.REDIS_URL)
const bsd = new bsdConstructor(process.env.BSD_API_URL, process.env.BSD_API_ID, process.env.BSD_API_SECRET)

redisClient.on("error", function (err) {
  log.error("Error " + err)
})

let CONS_GROUP_MAP = {}

async function refreshConsGroups() {
  log.info('Refreshing cons groups...')
  CONS_GROUP_MAP = {}
  const groups = await bsd.listConstituentGroups()
  groups.forEach((group) => {
    const groupName = group['name'][0]
    if (CONS_GROUP_MAP.hasOwnProperty(groupName)) {
      log.error(`Duplicate cons groups: ${groupName}`)
    }
    CONS_GROUP_MAP[groupName] = group['$'].id
  })
  log.info('Done refreshing cons!')
}

async function nbPersonToBSDCons(person) {
  const tagPrefixWhitelist = [
    'Action:',
    'Availability:',
    'Skill:'
  ]

  const consGroups = person.tags.filter((tag) => {
    let foundPrefix = false
    tagPrefixWhitelist.forEach((prefix) => {
      if (tag.indexOf(prefix) === 0) {
        foundPrefix = true
      }
    })
    return foundPrefix
  })

  for (let index = 0; index < consGroups.length; index++) {
    const group = consGroups[index]
    if (!CONS_GROUP_MAP.hasOwnProperty(group)) {
      await bsd.createConstituentGroups([group])
      await refreshConsGroups()
      log.error(`WARNING: New cons group created: ${group}. Be sure to add this to the appropriate BSD dynamic cons group or people with this tag won't get e-mailed.`)
    }
  }
  
  if (!person.email || consGroups.length === 0) {
    log.error(`WARNING: NB Person: ${person.id} did not sync. Either has no e-mail address or no suitable tags.`)
    return null
  }

  const consGroupIds = consGroups.map((group) => ({ id: CONS_GROUP_MAP[group] }))
  const names = person.first_name.split(' ')
  const address = person.primary_address
  const consData = {
    firstname: names[0] || null,
    middlename: names[1] || null,
    lastname: person.last_name,
    create_dt: person.created_at,
    gender: person.sex,
    ext_id: person.id,
    ext_type: 'nationbuilder_id',
    employer: person.employer,
    occupation: person.occupation,
    cons_email: {
      email: person.email,
      is_subscribed: person.email_opt_in ? 1 : 0,
      is_primary: 1
    }
  }

  if (address) {
    consData.cons_addr = [{
      addr1: address.address1,
      addr2: address.address2,
      city: address.city,
      state_cd: address.state,
      zip: address.zip,
      country: address.country_code
    }]
  }
  const phones = []
  if (person.mobile) {
    phones.push({
      phone: person.mobile,
      phone_type: 'mobile',
      is_primary: 1
    })
  }

  if (person.phone) {
    phones.push({
      phone: person.phone,
      phone_type: 'home',
      is_primary: person.mobile ? 0 : 1
    })
  }
  if (phones.length > 0) {
    consData.cons_phone = phones
  }
  consData.cons_group = consGroupIds
  let cons = null
  try {
    const cons = await bsd.setConstituentData(consData)
  } catch (ex)  {
    log.error(consData)
    log.error(ex)
  }
  return cons
}
async function syncPeople() {
  const now = moment().subtract(1, 'seconds').format('YYYY-MM-DDTHH:mm:ssZ')
  let syncSince = await redisClient.getAsync('nationsync:lastsync')
  log.info('Syncing people to BSD updated since', syncSince)
  if (!syncSince) {
    syncSince = now
  }
  let results = await nationbuilder.makeRequest('GET', 'people/search', { params: {
    limit: 100, 
    updated_since: syncSince
  } })
  const peopleRecords = []

  let count = 0
  while (true) {
    const people = results.data.results
    const length = people.length
    for (let index = 0; index < length; index++) {
      const person = people[index]
      log.info('Syncing person: ', person.id, person.email)
      await nbPersonToBSDCons(person)
    }
    if (results.data.next) {
      const next = results.data.next.split('?')    
      results = await nationbuilder.makeRequest('GET', results.data.next, { params: { 
        limit: 100 
      }})
      count = count + 100
    } else {
      break
    }
    log.info('Done syncing people!')
  }
  await redisClient.setAsync('nationsync:lastsync', now)
}

async function syncEvents() {
  log.info('Syncing events to BSD...')
  let results = await nationbuilder.makeRequest('GET', 'sites/brandnewcongress/pages/events', { params: {
    starting: moment().subtract(1, 'days').format('YYYY-MM-DD'),
    limit: 100
  } })

  // Grab all NB events
  const allNBEvents = []
  while(true) {
    const events = results.data.results
    events.forEach((event) => {
      if (event.status === 'published') {
        allNBEvents.push(event)
      }
    })

    if (results.data.next) {
      const next = results.data.next.split('?')    
      results = await nationbuilder.makeRequest('GET', results.data.next, { params: { limit: 100 } })
    } else {
      break
    }
  }

  for (let index = 0; index < allNBEvents.length; index++) {
    const event = allNBEvents[index]
    log.info('Syncing event', event.name)
    let nbPerson = await nationbuilder.makeRequest('GET', `people/${event.author_id}`, {})
    nbPerson = nbPerson.data.person
    const bsdCons = await nbPersonToBSDCons(nbPerson)
    consId = bsdCons.id
    if (!consId) {
      log.error(`Somehow there is no BSD person associated with NB person: ${event.author_id}`)
      break
    }
    const startTime = event.start_time
    const timezone = timezoneMap[event.time_zone]
    const startDatetimeSystem = moment.tz(startTime, timezone).format('YYYY-MM-DD HH:mm:ss')
    const duration = moment.duration(moment(event.end_time).diff(moment(event.start_time))).asMinutes()
    const bsdEvent = {
      name: event.name,
      event_type_id: 1,
      description: event.intro || event.name,
      creator_cons_id: consId,
      local_timezone: timezone,
      is_searchable: 1,
      start_datetime_system: startDatetimeSystem,
      duration: duration.toString()
    }
    if (event.contact) {
      bsdEvent.contact_phone = event.contact.phone
      bsdEvent.public_phone = 1
    }
    if (event.venue) {
      bsdEvent.venue_name = event.venue.name
      const address = event.venue.address
      if (!address || !address.zip || !address.city || !address.state) {
        log.info(`Not syncing event: ${event.name}. Missing address info.`)
        continue
      }
      bsdEvent.venue_addr1 = address.address1
      bsdEvent.venue_addr2 = `${address.address2}%${event.slug}`
      bsdEvent.venue_zip = address.zip
      bsdEvent.venue_city = address.city
      bsdEvent.venue_state_cd = address.state
      bsdEvent.venue_country = address.country_code
    }

    if (event.external_id) {
      bsdEvent.event_id_obfuscated = event.external_id
      try {
        await bsd.updateEvent(bsdEvent)
      } catch (ex) {
        if (ex.name && ex.name === 'BSDExistsError') {
          event.external_id = null
          delete bsdEvent.event_id_obfuscated
        } else {
          throw ex
        }
      }
    }

    // CREATION
    if (!event.external_id) {    
      const createdEvent = await bsd.createEvent(bsdEvent)
      const updateEvent = Object.assign({}, event)
      updateEvent.external_id = createdEvent.event_id_obfuscated
      await nationbuilder.makeRequest('PUT', `sites/brandnewcongress/pages/events/${event.id}`, { body: {
        event: updateEvent
      }})    
    }    
    // SYNC RSVPS TODO
    /*let results = await nationbuilder.makeRequest('GET', `sites/brandnewcongress/pages/events/${event.id}/rsvps`, { params: { limit: 100 }})
    let eventRSVPs = []
    while (true) {
      eventRSVPs.concat(results.data.results)
      if (results.data.next) {
        const next = results.data.next.split('?')    
        results = await nationbuilder.makeRequest('GET', results.data.next, { params: { limit: 100 } })
      } else {
        break
      }
    }
    */
  }
  const bsdEvents = await bsd.searchEvents({
    date_start: '2000-01-01 00:00:00'
  })

  const eventsToDelete = []
  for (let index = 0; index < bsdEvents.length; index++) {
    let foundEvent = false
    const bsdEvent = bsdEvents[index]
    allNBEvents.forEach((nbEvent) => {
      if (nbEvent.external_id === bsdEvent['event_id_obfuscated']) {
        foundEvent = true
      }
    })
    if (foundEvent === false) {
      eventsToDelete.push(bsdEvent.event_id)
    }
  }
  log.info(`Deleting ${eventsToDelete.length} events...`)
  const responses = await bsd.deleteEvents(eventsToDelete)
  console.log(responses)
  log.info('Done syncing events!')
}

async function sync() {
  log.info('Starting sync...')
  await refreshConsGroups()
  await syncPeople()
  await syncEvents()
  setTimeout(sync, 600000)
  log.info('Done syncing!')
}

const timezoneMap = {
  'Eastern Time (US & Canada)' : 'US/Eastern',
  'Central Time (US & Canada)' : 'US/Central',
  'Pacific Time (US & Canada)' : 'US/Pacific',
  'Mountain Time (US & Canada)' : 'US/Mountain'
}

sync().catch((ex) => console.log(ex))
