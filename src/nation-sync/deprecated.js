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
const bsd = new bsdConstructor(
  process.env.BSD_API_URL,
  process.env.BSD_API_ID,
  process.env.BSD_API_SECRET
)

/*
 * This is a big file! It has two action points –
 * `npm run nation-sync` runs the `sync` function via line 538
 * the file also exports sync at the very bottom
 */

const multiClients = new Array(5)
  .fill(null)
  .map(
    (_, idx) =>
      new bsdConstructor(
        process.env.BSD_API_URL,
        `syncer-${idx + 1}`,
        process.env[`BSD_${idx + 1}`]
      )
  )

redisClient.on('error', function(err) {
  log.error('Error ' + err)
})

let CONS_GROUP_MAP = {}
const tagPrefixWhitelist = ['Action:', 'Availability:', 'Skill:']

async function refreshConsGroups() {
  log.info('Refreshing cons groups...')

  CONS_GROUP_MAP = {}
  const groups = await bsd.listConstituentGroups()
  groups.forEach(group => {
    const groupName = group['name'][0]
    if (CONS_GROUP_MAP.hasOwnProperty(groupName)) {
      log.error(`Duplicate cons groups: ${groupName}`)
    }
    CONS_GROUP_MAP[groupName] = group['$'].id
  })

  log.info('Done refreshing cons!')
}

async function deleteEmptyConsGroups() {
  await refreshConsGroups()

  let tags = []
  let results = await nationbuilder.makeRequest('GET', 'tags', {
    params: {
      limit: 100
    }
  })

  while (true) {
    tags = tags.concat(results.data.results)
    if (results.data.next) {
      let next = results.data.next.split('?')
      results = await nationbuilder.makeRequest('GET', results.data.next, {
        params: { limit: 100 }
      })
    } else {
      break
    }
  }

  tags = tags.map(t => t.name)

  const consGroupsToDelete = Object.keys(CONS_GROUP_MAP)
    .filter(
      group =>
        tagPrefixWhitelist.filter(prefix => group.startsWith(prefix)).length > 0
    )
    .filter(group => !tags.includes(group))
    .map(group => CONS_GROUP_MAP[group])

  let result
  if (consGroupsToDelete.length > 0) {
    result = await bsd.deleteConstituentGroups(consGroupsToDelete)
  } else {
    result = 'No cons groups to delete'
  }

  console.log(result)
  return result
}

async function nbPersonToBSDCons(person, options) {
  const forceSync = options.forceSync || false

  // local instance of bsd constructor with potentially different key
  const b = options.bsd || bsd

  const consGroups = person.tags.filter(tag => {
    let foundPrefix = false
    tagPrefixWhitelist.forEach(prefix => {
      if (tag.indexOf(prefix) === 0) {
        foundPrefix = true
      }
    })
    return foundPrefix
  })

  for (let index = 0; index < consGroups.length; index++) {
    const group = consGroups[index]
    if (!CONS_GROUP_MAP.hasOwnProperty(group)) {
      await b.createConstituentGroups([group])
      await refreshConsGroups()
      log.error(
        `WARNING: New cons group created: ${group}. Be sure to add this to the appropriate BSD dynamic cons group or people with this tag won't get e-mailed. @cmarchibald`
      )
    }
  }

  if (consGroups.length === 0 && !forceSync) {
    log.error(
      `WARNING: NB Person: ${person.id} did not sync. Either has no e-mail address or no suitable tags.`
    )
    return null
  }

  const consGroupIds = consGroups.map(group => ({ id: CONS_GROUP_MAP[group] }))
  const names = person.first_name.split(' ')
  const address = person.primary_address
  const email = person.email
  const consData = {
    firstname: names[0] || null,
    middlename: names[1] || null,
    lastname: person.last_name || null,
    create_dt: person.created_at,
    gender: person.sex || null,
    ext_id: person.id,
    ext_type: 'nationbuilder_id',
    employer: person.employer || null,
    occupation: person.occupation || null
  }

  if (email) {
    consData.cons_email = {
      email: person.email,
      is_subscribed: person.email_opt_in ? 1 : 0,
      is_primary: 1
    }
  }

  if (address) {
    consData.cons_addr = [
      {
        addr1: address.address1 || null,
        addr2: address.address2 || null,
        city: address.city || null,
        state_cd: address.state || null,
        zip: address.zip || null,
        country: address.country_code || null
      }
    ]
  }
  const phones = []

  // Longer phone number should be primary
  if (person.mobile) {
    phones.push({
      phone: person.mobile,
      phone_type: 'mobile',
      is_primary:
        !person.phone || person.mobile.length > person.phone.length ? 1 : 0
    })
  }

  if (person.phone) {
    phones.push({
      phone: person.phone,
      phone_type: 'home',
      is_primary:
        !person.mobile || person.phone.length > person.mobile.length ? 1 : 0
    })
  }
  if (person.external_id) {
    consData.cons_id = person.external_id
  }
  if (phones.length > 0) {
    consData.cons_phone = phones
  }
  consData.cons_group = consGroupIds
  let cons = null
  try {
    cons = await b.setConstituentData(consData)
  } catch (ex) {
    log.info(consData)
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
  let results = await nationbuilder.makeRequest('GET', 'people/search', {
    params: {
      limit: 100,
      updated_since: syncSince
    }
  })
  const peopleRecords = []

  let count = 0
  while (true) {
    const people = results.data.results
    const length = people.length

    // Split into groups of 5
    const batches = batch(people)

    console.time('one batch')
    await Promise.all(batches.map((batch, idx) => promiseBatch(batch, idx)))
    console.timeEnd('one batch')

    if (results.data.next) {
      const next = results.data.next.split('?')
      results = await nationbuilder.makeRequest('GET', results.data.next, {
        params: {
          limit: 100
        }
      })
      count = count + 100
    } else {
      break
    }
    log.info('Done syncing people!')
  }
  await redisClient.setAsync('nationsync:lastsync', now)
}

async function assignConsGroups() {
  await refreshConsGroups()
  const tagPrefixWhitelist = ['Action:', 'Availability:', 'Skill:']
  function hasPrefix(tag) {
    let foundPrefix = false
    tagPrefixWhitelist.forEach(prefix => {
      if (tag.indexOf(prefix) === 0) {
        foundPrefix = true
      }
    })
    return foundPrefix
  }

  let consIDMap = {}
  let count = 0
  const csv = Baby.parseFiles(
    '/Users/saikat/Downloads/nationbuilder-people-export-1261-2017-06-16.csv',
    {
      header: true,
      step: function(results) {
        count = count + 1
        console.log('Count', count)
        const person = results.data[0]
        const tags = person.tag_list.split(',').map(t => t.trim())
        let foundTag = false
        for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
          const tag = tags[tagIndex]
          if (!CONS_GROUP_MAP.hasOwnProperty(tag) && hasPrefix(tag)) {
            log.error(`Tag not found: ${tag}`)
          } else if (hasPrefix(tag)) {
            foundTag = true
            const consID = CONS_GROUP_MAP[tag]
            if (!consIDMap.hasOwnProperty(consID)) {
              consIDMap[consID] = []
            }
            consIDMap[consID].push(person.nationbuilder_id)
          }
        }
      }
    }
  )

  console.log('done parsing')
  let consGroups = Object.keys(consIDMap)
  for (let index = 0; index < consGroups.length; index++) {
    const groupId = consGroups[index]
    let idsToAdd = []
    for (
      let innerIndex = 0;
      innerIndex < consIDMap[groupId].length;
      innerIndex++
    ) {
      if (innerIndex > 0 && innerIndex % 500 === 0) {
        console.log('Adding ids', idsToAdd.length, groupId, idsToAdd[10])
        await bsd.addExtIdsToConstituentGroup(groupId, idsToAdd)
        idsToAdd = []
      }
      idsToAdd.push(consIDMap[groupId][innerIndex])
    }
    if (idsToAdd.length > 0) {
      console.log(
        'Adding ids at the end',
        idsToAdd.length,
        groupId,
        idsToAdd[10]
      )
      await bsd.addExtIdsToConstituentGroup(groupId, idsToAdd)
      idsToAdd = []
    }
  }
  console.log('done')
}

async function sync() {
  log.info('Starting sync...')
  await refreshConsGroups()
  await syncPeople()
  await syncEvents()
  log.info('Done syncing!')
}

const timezoneMap = {
  'Eastern Time (US & Canada)': 'US/Eastern',
  'Central Time (US & Canada)': 'US/Central',
  'Pacific Time (US & Canada)': 'US/Pacific',
  'Mountain Time (US & Canada)': 'US/Mountain'
}

if (require.main === module) {
  sync().catch(ex => log.error(ex))
}

// deleteEmptyConsGroups().catch(ex => console.log(ex))

/*
 * ––––––––
 * One time use
 * --------
 */

async function reimportNBPeople() {
  await refreshConsGroups()
  const csv = Baby.parseFiles('/Users/saikat/Downloads/email-less.csv', {
    header: true
  })
  let count = 0
  const data = csv.data
  for (let index = 0; index < data.length; index++) {
    const person = data[index]
    console.log(index, person.nationbuilder_id)
    const newPerson = {}
    Object.assign(newPerson, person)
    newPerson.tags = person.tag_list.split(',')
    newPerson.id = person.nationbuilder_id
    const address = {
      address1: person.primary_address1,
      address2: person.primary_address2,
      city: person.primary_city,
      state: person.primary_state,
      zip: person.primary_zip,
      country: person.primary_country
    }
    newPerson.phone = person.phone_number
    newPerson.mobile = person.mobile_number
    newPerson.primary_address = address
    console.log(person.created_at)
    newPerson.created_at = moment(
      person.created_at,
      'MM/DD/YYYY hh:mm a'
    ).format('YYYY-MM-DDTHH:mm:ssZ')
    await nbPersonToBSDCons(newPerson)
  }
  console.log('done!')
}

/*
 * Helper zone for speeding up sync
 */

// [1,2,3,4,5,6,7] -> [[1,2,3,4,5], [6,7]]
function batch(arr) {
  let start = 0
  let result = []
  while (start < arr.length) {
    result.push(arr.slice(start, start + 5))
    start = start + 5
  }
  return result
}

function promiseBatch(batch, n) {
  const syncer = n % 5
  return Promise.all(
    batch.map(p => {
      log.info(`Syncing person ${p.id} ${p.email} with syncer ${syncer}`)
      return nbPersonToBSDCons(p, { bsd: multiClients[syncer] })
    })
  )
}

module.exports = sync
