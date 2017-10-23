const bsdConstructor = require('../bsd')
const moment = require('moment')
const log = require('../log')
const osdi = require('./osdi-people')
const { syncEvents } = require('./osdi-events')

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

const multiClients = new Array(5)
  .fill(null)
  .map(
    (_, idx) =>
      new bsdConstructor(
        process.env.BSD_API_URL,
        `syncer-10-${idx + 1}`,
        process.env[`BSD_${idx + 1}`]
      )
  )

redisClient.on('error', function(err) {
  log.error('Error ' + err)
})

/*
 * This is a big file! It has two action points –
 * `npm run nation-sync` runs the `sync` function via line 538
 * the file also exports sync at the very bottom
 *
 * -------------------- TOC --------------------
 * globals
 * sync
 * refreshConsGroups
 * syncPeople
 * personToBSDCons
 */

let CONS_GROUP_MAP = {}
const tagPrefixWhitelist = ['Action', 'Availability', 'Skill']

async function sync() {
  log.info('Starting sync...')
  await refreshConsGroups()
  await syncPeople()
  await syncEvents()
  log.info('Done syncing!')
}

if (require.main === module) {
  sync().catch(ex => log.error(ex))
}

async function refreshConsGroups() {
  log.info('Refreshing cons groups...')

  CONS_GROUP_MAP = {}
  const groups = await bsd.listConstituentGroups()
  groups.forEach(group => {
    const groupName = group['name'][0]
    if (CONS_GROUP_MAP.hasOwnProperty(groupName)) {
      log.error(`Duplicate cons groups: ${groupName}`)
    }
    CONS_GROUP_MAP[groupName.toLowerCase()] = group['$'].id
  })

  log.info('Done refreshing cons!')
}

async function syncPeople() {
  const now = moment()
    .subtract(1, 'day')
    .format('YYYY-MM-DDTHH:mm:ssZ')

  let syncSince = await redisClient.getAsync('nationsync:lastsync')
  log.info('Syncing people to BSD updated since', syncSince)
  if (!syncSince) {
    syncSince = now
  }

  let page = 0
  let people = await osdi.people(syncSince, page)
  let progress

  while (people.length > 0) {
    log.info(`Syncing page ${page}`)

    const batches = batch(people)
    await Promise.all(batches.map((batch, idx) => promiseBatch(batch, idx)))

    page = page + 1

    progress = people[people.length - 1].updated_at
    log.info(`Synced up to ${progress}`)
    await redisClient.setAsync('nationsync:lastsync', progress)

    people = await osdi.people(syncSince, page)
  }

  log.info('Done syncing people!')
}

async function personToBSDCons(person, options) {
  // local instance of bsd constructor with potentially different key
  const b = options.bsd || bsd
  const consGroups = person.tags
    .filter(tag => tagPrefixWhitelist.includes(tag.name.split(':')[0]))
    .map(tag => tag.name)

  const needsCreation = consGroups.filter(
    group => CONS_GROUP_MAP[group.toLowerCase()] === undefined
  )

  needsCreation.map(group =>
    log.error(
      `WARNING: New cons group created: ${group}. Be sure to add this to the appropriate BSD dynamic cons group or people with this tag won't get e-mailed. @cmarchibald`
    )
  )

  if (needsCreation.length > 0) {
    await b.createConstituentGroups(needsCreation)
    await refreshConsGroups()
  }

  if (consGroups.length === 0) {
    log.error(
      `WARNING: NB Person: ${person.id} did not sync. Either has no e-mail address or no suitable tags.`
    )
    return null
  }

  const consData = {
    firstname: person.given_name || null,
    lastname: person.family_name || null,
    ext_id: person.id,
    ext_type: 'custom'
  }

  const primaryEmail = person.email_addresses.filter(em => em.primary)[0]
  if (primaryEmail) {
    consData.cons_email = {
      email: primaryEmail.address,
      is_subscribed: primaryEmail.status == 'subscribed' ? 1 : 0,
      is_primary: 1
    }
  }

  const primaryAddress = person.postal_addresses[0]
  const addressLines = primaryAddress ? primaryAddress.address_lines || [] : []
  if (primaryAddress) {
    consData.cons_addr = [
      {
        addr1: addressLines[0] || null,
        addr2: addressLines[1] || null,
        city: primaryAddress.locality || null,
        state_cd: primaryAddress.region || null,
        zip: primaryAddress.region || null,
        country: 'US'
      }
    ]
  }

  const phones = person.phone_numbers.map(p => ({
    phone: p.number,
    phone_type: p.number_type,
    is_primary: p.primary
  }))

  if (phones.length > 0) {
    consData.cons_phone = phones
  }

  consData.cons_group = consGroups.map(group => ({ id: CONS_GROUP_MAP[group] }))

  let cons = null

  try {
    cons = await b.setConstituentData(consData)
  } catch (ex) {
    log.error(ex)
  }

  return cons
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
      log.info(`Syncing person ${p.id} ${p.given_name} with syncer ${syncer}`)
      return personToBSDCons(p, { bsd: multiClients[syncer] })
    })
  )
}
