const bsdConstructor = require('../bsd')
const nationbuilder = require('../nationbuilder') 
const moment = require('moment')
const log = require('../log')
const { convertTags } = require('../legacy-tag-map')
const Baby = require('babyparse')

const bsd = new bsdConstructor(process.env.BSD_HOST, process.env.BSD_ID, process.env.BSD_SECRET)

async function nbPersonToBSDCons(person) {
  consGroups = consGroups.map((group) => consGroupIdMap[group])
    .map((group) => ({ id: group }))
  if (person.email && consGroups.length > 0) {
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
    if (person.external_id) {
      consData.id = person.external_id
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
    consData.cons_group = consGroups
    const cons = await bsd.setConstituentData(consData)
    if (!person.external_id) {
      await nationbuilder.makeRequest('PUT', `people/${person.id}`, { body: { person: {
        external_id: cons.id
      }}})
    }
    return cons
  }
  return null
}
async function syncPeople() {
  let tagResults = await nationbuilder.makeRequest('GET', 'tags', { params: { limit: 100 } })
  let allTags = []
  const tagPrefixWhitelist = [
    'Signup',
    'Donor',
    'Action',
    'Available',
    'Skill',
    'Petition'
  ]
  while (true) {
    log.info('Getting tags...')
    const tags = tagResults.data.results
    tags.forEach((tag) => {
      tagPrefixWhitelist.forEach((prefix) => {
        if (tag.name.indexOf(prefix) === 0) {
          allTags.push(tag.name)
        }
      })
    })

    if (tagResults.data.next) {
      const next = tagResults.data.next.split('?')    
      tagResults = await nationbuilder.makeRequest('GET', tagResults.data.next, { params: { limit: 100 } })
    } else {
      break
    }
  }

  let allConsGroups = Object.keys(TagMap).map((tag) => TagMap[tag])
    .filter((ele) => ele !== null)
  allConsGroups = allConsGroups.filter((ele, pos) => allConsGroups.indexOf(ele) === pos)
  const groupsToCreate = []
  const groups = {}
  for (let index = 0; index < allConsGroups.length; index++) {
    const group = await bsd.getConstituentGroupByName(allConsGroups[index])
    if (group === null) {
      groupsToCreate.push(allConsGroups[index])
    } else {
      groups[group.name] = group.cons_group_id
    }
  }
  for (let index = 0; index < groupsToCreate.length; index++) {
    const group = groupsToCreate[index]
    await bsd.createConstituentGroups([group])
  }

  // SYNC PEOPLE
  let results = await nationbuilder.makeRequest('GET', 'people/search', { params: { limit: 100 , updated_since: moment('2017-06-09').toISOString()}})
  const peopleRecords = []

  let count = 0
  while (true) {
    log.info(`Processing results: ${count}...`)
    const people = results.data.results
    const length = people.length
    for (let index = 0; index < length; index++) {
      const person = people[index]
      await nbPersonToBSDCons(person)      
    }
    if (results.data.next) {
      const next = results.data.next.split('?')    
      results = await nationbuilder.makeRequest('GET', results.data.next, { params: { limit: 100 } })
      count = count + 100
    } else {
      break
    }
  }
}

async function syncEvents() {
  let results = await nationbuilder.makeRequest('GET', 'sites/brandnewcongress/pages/events', { params: {
    starting: moment().format('YYYY-MM-DD'),
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

  console.log(allNBEvents.length)
  for (let index = 0; index < allNBEvents.length; index++) {
    const event = allNBEvents[index]
    let nbPerson = await nationbuilder.makeRequest('GET', `people/${event.author_id}`, {})
    let consId = nbPerson.external_id
    if (!consId) {
      nbPerson = nbPerson.data.person
      const bsdCons = await nbPersonToBSDCons(nbPerson)
      consId = bsdCons.id
    }
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

    console.log(event.id, event.name)
    // CREATION
    if (!event.external_id) {    
      const createdEvent = await bsd.createEvent(bsdEvent)
      const updateEvent = Object.assign({}, event)
      updateEvent.external_id = createdEvent.event_id_obfuscated
      await nationbuilder.makeRequest('PUT', `sites/brandnewcongress/pages/events/${event.id}`, { body: {
        event: updateEvent
      }})          
    // UPDATE
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
  // DELETE BSD EVENTS TODO
}

function deletePress() {
  const peopleToDelete = []
  const pressCSV = Baby.parseFiles('/Users/saikat/Development/Source/brandnewcongress/hub/src/press_list.csv', {
    header: true
  })

  const people = pressCSV.data
  for (let index = 0; index < people.length; index++) {
    person = people[index]
    const tags = person.tag_list.split(',')
    const newTags = convertTags(tags)
    if (newTags.length === 0) {
      peopleToDelete.push(person)
    }
  }
  const deleteCSV = Baby.unparse(peopleToDelete, {
    header: true
  })
  console.log(deleteCSV)
}

async function cleanUpNBTags() {
  let tagResults = await nationbuilder.makeRequest('GET', 'tags', { params: { limit: 100 } })
  let allTags = []
  while (true) {
    log.info('Getting tags...')
    const tags = tagResults.data.results
    allTags = allTags.concat(tags.map((tag) => tag.name))
    if (tagResults.data.next) {
      const next = tagResults.data.next.split('?')    
      tagResults = await nationbuilder.makeRequest('GET', tagResults.data.next, { params: { limit: 100 } })
    } else {
      break
    }
  }
  let count = 0
  for (let index = 0; index < allTags.length; index++) {
    console.log(`Processing ${allTags[index]}...`)
    const tag = allTags[index]
    if (tag.indexOf('Donor: ') === 0 || 
      tag.indexOf('Signup: ') === 0 || 
      tag.indexOf('Action: ') === 0 || 
      tag.indexOf('Petition: ') === 0 || 
      tag.indexOf('Skill: ') === 0 || 
      tag.indexOf('Available: ') === 0 || 
      tag.indexOf('Field: ') === 0 ||
      tag === 'Supporter' ||
      tag === 'movoters:MO-Federal-1 - 04/20/2017 14:15:34:439') {
      continue
    }
    let peopleResults = await nationbuilder.makeRequest('GET', `tags/${tag}/people`, { params: { limit: 100 } })
    while (true) {
      const people = peopleResults.data.results
      for (let pIndex = 0; pIndex < people.length; pIndex++) {
        const person = people[pIndex]
        const newTags = convertTags(person.tags)
        await nationbuilder.makeRequest('DELETE', `people/${person.id}/taggings`, {
          body: {
            tagging: {
              tag: person.tags
            }
          }
        })
        await nationbuilder.makeRequest('PUT', `people/${person.id}/taggings`, { 
          body: { 
            tagging: {
              tag: newTags
            }
          }
        })
        console.log(person.email)
      }

      if (peopleResults.data.next) {
        const next = peopleResults.data.next.split('?')
        peopleResults = await nationbuilder.makeRequest('GET', peopleResults.data.next, { params: { limit: 100 } })
      } else {
        break
      }
    }
    console.log(tag)
    console.log(count)
    count = count + 1
  }
}

async function sync() {
  await cleanUpNBTags()
}


const timezoneMap = {
  'Eastern Time (US & Canada)' : 'US/Eastern',
  'Central Time (US & Canada)' : 'US/Central',
  'Pacific Time (US & Canada)' : 'US/Pacific',
  'Mountain Time (US & Canada)' : 'US/Mountain'
}

sync().catch((ex) => console.log(ex))
