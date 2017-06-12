const bsdConstructor = require('../bsd')
const nationbuilder = require('../nationbuilder') 
const moment = require('moment')
const log = require('../log')

const bsd = new bsdConstructor(process.env.BSD_HOST, process.env.BSD_ID, process.env.BSD_SECRET)
const REFRESH_CONS_GROUPS = false

async function nbPersonToBSDCons(person) {
  // TODO fix this to use blacklist
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
  while (tagResults.data.next) {
    log.info('Getting tags...')
    const tags = tagResults.data.results
    allTags = allTags.concat(tags.map((tag) => tag.name))
    const next = tagResults.data.next.split('?')    
    tagResults = await nationbuilder.makeRequest('GET', tagResults.data.next, { params: { limit: 100 } })
  }
  const notFoundTags = []
  allTags.forEach((tag) => {
    let found = false
    Object.keys(TagMap).forEach((currentTag) => {
      if (currentTag === tag) {
        found = true
      }
    })
    if (found === false) {
      throw new Error(`TAG NOT FOUND, CANNOT SYNC: ${tag}`)
    }
  })

  if (REFRESH_CONS_GROUPS) {
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
async function sync() {
  await syncEvents()
}

const consGroupIdMap = { 
  'Signup: Alexandria Ocasio-Cortez': '14',
  'Available: 0-5 Hours': '33',
  'Available: 10-20 Hours': '34',
  'Available: 20-30 Hours': '35',
  'Available: 30+ Hours': '36',
  'Available: 5-10 Hours': '37',
  'Action: Attended CC: Nomination': '27',
  'Action: Attended CC: Orientation': '38',
  'Action: Attended CC: Research': '39',
  'Action: Attended CC: Social Media': '40',
  'Action: Attended CC: State of BNC': '41',
  'Action: Attended CC: Help Desk': '42',
  'Action: Attended CC: Event Host': '43',
  'Skill: Programming': '44',
  'Skill: Video': '45',
  'Skill: Data Entry': '46',
  'Action: Attended Event: 2016/08/24 @ Oakland, CA': '47',
  'Action: Attended Event: 2016/07/22 @ Olympia, WA': '48',
  'Action: Attended Event: 2016/07/11 @ Omaha, NE': '49',
  'Action: Attended Event: 2016/06/29 @ Orlando, FL': '50',
  'Action: Attended Event: 2016/07/11 @ Overland Park, KS': '51',
  'Action: Attended Event: 2016/07/23 @ Philadelphia, PA': '52',
  'Action: Attended Event: 2016/08/20 @ Pittsburgh, PA': '53',
  'Action: Attended Event: 2016/08/14 @ Providence, RI': '54',
  'Action: Attended Event: 2016/06/04 @ Raleigh, NC': '55',
  'Action: Attended Event: 2016/08/11 @ Rochester, NY': '56',
  'Action: Attended Event: 2016/08/25 @ Sacramento, CA': '57',
  'Action: Attended Event: 2016/07/24 @ Salt Lake City, UT': '58',
  'Action: Attended Event: 2016/07/01 @ San Antonio, TX': '59',
  'Action: Attended Event: 2016/06/14 @ San Bernardino, CA': '60',
  'Action: Attended Event: 2016/08/26 @ San Diego, CA': '61',
  'Action: Attended Event: 2016/08/23 @ San Francisco, CA': '62',
  'Action: Attended Event: 2016/08/22 @ San Jose, CA': '63',
  'Action: Attended Event: 2016/07/19 @ Santa Ana, CA': '64',
  'Action: Attended Event: 2016/08/27 @ Santa Barbara, CA': '65',
  'Action: Attended Event: 2016/07/11 @ Savannah, GA': '66',
  'Action: Attended Event: 2016/07/20 @ Seattle, WA': '67',
  'Action: Attended Event: 2016/07/12 @ Sioux Falls, SD': '68',
  'Action: Attended Event: 2016/08/12 @ Spokane, WA': '69',
  'Action: Attended Event: 2016/06/26 @ Stamford, CT': '70',
  'Action: Attended Event: 2016/08/09 @ Syracuse, NY': '71',
  'Action: Attended Event: 2016/07/21 @ Tacoma, WA': '72',
  'Action: Attended Event: 2016/06/28 @ Tampa, FL': '73',
  'Action: Attended Event: 2016/06/28 @ Dallas, TX': '74',
  'Action: Attended Event': '75',
  'Skill: Event Host': '76',
  'Action: Hosted Event': '77',
  'Action: Attended Event: 2016/07/30 @ Washington, DC': '78',
  'Action: Attended Event: 2016/08/06 @ Worcester, MA': '79',
  'Availability: Week Days': '80',
  'Availability: Weekends': '81',
  'Availability: Week Nights': '82',
  'Skill: Graphic Design': '83',
  'Skill: Help Desk': '84',
  'Skill: Start Local Group': '85',
  'Petition: Muslim Ban': '86',
  'Skill: Nationbuilder': '87',
  'Action: Nominated Candidate': '88',
  'Candidate Nominee': '89',
  'Skill: Photography': '90',
  'Potential Leader': '91',
  'Skill: Printing': '92',
  'Skill: Process Engineer': '93',
  'Skill: Research': '94',
  'Signup: Ryan Stone': '20',
  'Petition: Draft Cori Bush': '95',
  'Petition: Kick out Joe Manchin': '96',
  'Petition: Letter to Keith Ellison': '97',
  'Petition: Medicare for All': '98',
  'Petition: Syrian War': '99',
  'Skill: Calling': '100',
  'Skill: Field Outreach': '101',
  'Skill: Flyering': '102',
  'Skill: Door Knocking': '103',
  'Skill: HR': '104',
  'Skill: Legal': '105',
  'Skill: Community Management': '106',
  'Skill; Nationbuilder': '107',
  'Skill: Office Help': '108',
  'Skill: Press': '109',
  'Skill: Texting': '110',
  'Skill: Social Media Sharing': '111',
  'Skill: Speaker': '112',
  'Skill: Supporter Housing': '113',
  'Skill: Travel Management': '114',
  'Skill: Event Venue': '115',
  'Skill: Web Design': '116',
  'Skill: Writing': '117',
  'Skill: Social Media': '118',
  'Signup: Adrienne Bell': '17',
  'Donor: Adrienne Bell': '119',
  'Donor: Alexandria Ocasio-Cortez': '120',
  'Signup: Anthony Clark': '18',
  'Donor: Anthony Clark': '121',
  'Signup: Brand New Congress': '11',
  'Donor: Brand New Congress': '122',
  'Signup: Chardo Richardson': '23',
  'Donor: Chardo Richardson': '123',
  'Signup: Cori Bush': '12',
  'Donor: Cori Bush': '124',
  'Signup: Danny Ellyson': '21',
  'Donor: Danny Ellyson': '125',
  'Signup: Demond Drummer': '126',
  'Donor: Demond Drummer': '127',
  'Signup: Eric Terrell': '128',
  'Donor: Eric Terrell': '129',
  'Source: Facebook': '130',
  'Signup: Hector Morales': '24',
  'Donor: Hector Morales': '131',
  'Source: Incoming Call': '132',
  'Signup: Justice Democrats': '10',
  'Donor: Justice Democrats': '133',
  'Signup: Letitia Plummer': '22',
  'Donor: Letitia Plummer': '134',
  'Signup: Michael Hepburn': '135',
  'Donor: Michael Hepburn': '136',
  'Signup: Paula Jean Swearengin': '13',
  'Donor: Paula Jean Swearengin': '137',
  'Signup: Paul Perry': '25',
  'Donor: Paul Perry': '138',
  'Signup: Richard Rice': '26',
  'Donor: Richard Rice': '139',
  'Signup: Robb Ryerse': '15',
  'Donor: Robb Ryerse': '140',
  'Donor: Ryan Stone': '141',
  'Signup: Sarah Smith': '19',
  'Donor: Sarah Smith': '142',
  'Signup: Tamarah Begay': '143',
  'Donor: Tamarah Begay': '144',
  'Source: Incoming Text Message': '145',
  'Source: Twitter': '146',
  'Action: Attended Event: 4/30/2017 @ St. Louis, MO': '32',
  'Action: Attended Event: 2017/05/06 @ St. Louis, MO': '31',
  'Action: Attended Event: 2017/05/07 @ St. Louis, MO': '30',
  'Action: Attended Event: 2017/05/13 @ St. Louis, MO': '29',
  'Action: Attended Event: 2017/05/03 @ St. Louis, MO': '28' 
}

const timezoneMap = {
  'Eastern Time (US & Canada)' : 'US/Eastern',
  'Central Time (US & Canada)' : 'US/Central',
  'Pacific Time (US & Canada)' : 'US/Pacific',
  'Mountain Time (US & Canada)' : 'US/Mountain'
}

sync().catch((ex) => console.log(ex))
