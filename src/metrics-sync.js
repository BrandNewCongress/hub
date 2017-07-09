var axios = require('axios')
var log = require('./log')
const { parseString } = require('xml2js')
const bluebird = require('bluebird')
const { client, flushMetric, logMetric, latestMetric } = require('./redis')
const parseStringPromise = bluebird.promisify(parseString)
const moment = require('moment')
const gecko = require('geckoboard')(process.env.GECKOBOARD_SECRET)
const geckoboard = bluebird.promisifyAll(gecko.datasets)
const Baby = require('babyparse')
const BSD = require('./bsd')
const airtable = require('./airtable')

const campaigns = [{
  name: 'TX-14: Adrienne Bell',
  actblueEntity: 50725,
  supporters: 277,
  district_phones: 359,
  district_supporters: 358,
  donors: 205,
  airtableId: 'rec0cA3UpWanqeFUI'
}, {
  name: 'NY-14: Alexandria Ocasio-Cortez',
  actblueEntity: 50295,
  supporters: 275,
  district_phones: 317,
  district_supporters: 316,
  donors: 166,
  airtableId: 'recmyHDen2Gkaipp4'
}, {
  name: 'IL-07: Anthony Clark',
  actblueEntity: 50745,
  supporters: 274,
  district_phones: 319,
  district_supporters: 318,
  donors: 167,
  airtableId: 'rec12iY9KYXEqohka'
}, {
  name: 'FL-07: Chardo Richardson',
  actblueEntity: 50546,
  supporters: 286,
  district_phones: 323,
  district_supporters: 322,
  donors: 163,
  airtableId: 'recVmYfdmvJala8G9'
}, {
  name: 'MO-01: Cori Bush',
  actblueEntity: 49905,
  supporters: 282,
  district_phones: 327,
  district_supporters: 326,
  donors: 187,
  airtableId: 'recyCR3LoGExLsHBC'
}, {
  name: 'TX-29: Hector Morales',
  actblueEntity: 49941,
  supporters: 279,
  district_phones: 330,
  district_supporters: 331,
  donors: 206,
  airtableId: 'recwlSNYz8IJI5zD9'
}, {
  name: 'TX-22: Letitia Plummer',
  actblueEntity: 50744,
  supporters: 278,
  district_phones: 335,
  district_supporters: 334,
  donors: 164,
  airtableId: 'recjmlCYpJqK3rawK'
}, {
  name: 'PA-07: Paul Perry',
  actblueEntity: 51003,
  supporters: 289,
  district_phones: 339,
  district_supporters: 338,
  donors: 410,
  airtableId: 'receAPD7xIqpySt2y'
}, {
  name: 'WV-SN-1: Paula Jean Swearengin',
  actblueEntity: 50279,
  supporters: 284,
  district_phones: 343,
  district_supporters: 342,
  donors: 207,
  airtableId: 'recNMKaQSWZdobocV'
}, {
  name: 'TX-10: Ryan Stone',
  actblueEntity: 49943,
  supporters: 281,
  district_phones: 351,
  district_supporters: 350,
  donors: 208,
  airtableId: 'recrsNgrw7cRAaO86'
}, {
  name: 'WA-09: Sarah Smith',
  actblueEntity: 50285,
  supporters: 273,
  district_phones: 355,
  district_supporters: 354,
  donors: 209,
  airtableId: 'recQCW5qgDB80lJ1H'
}, {
  name: 'AR-03: Robb Ryerse',
  supporters: 272,
  district_phones: 347,
  district_supporters: 346,
  airtableId: 'recO65yp0qYZxUY0p'
}, {
  name: 'Brand New Congress',
  supporters: 309,
  donors: 148,
  airtableId: 'recv7HBQqVWCdP8iv'
}, {
  name: 'Justice Democrats',
  supporters: 310,
  donors: 171,
  airtableId: 'rec1ZXkjNyFITbqiy'
}, {
  name: 'Total',
  supporters: 408,
  donors: 414
}]

async function createGeckoDataset(id, fields) {
  let dataset = null
  try {
    dataset = await geckoboard.findOrCreateAsync({
      id: id,
      fields: fields
    })
  } catch (ex) {
    log.info(ex)
    await geckoboard.deleteAsync(id)
    dataset = await geckoboard.findOrCreateAsync({
      id: id,
      fields: fields
    })
  }
  return dataset
}

async function syncRedisToGeckoboard() {
  const geckoTableMapping = {
    'campaigns' : {
      redisGlob: 'metrics:campaign:*',
      fieldMapping: {
        campaign: {
          type: 'string',
          name: 'Campaign',
          optional: false
        },
        amount_raised: {
          type: 'money',
          name: 'Amount Raised',
          optional: true,
          currency_code: 'USD'
        },
        expenses: {
          type: 'money',
          name: 'Expenses',
          currency_code: 'USD',
          optional: true
        },
        donors: {
          type: 'number',
          name: 'Donors',
          optional: true
        },
        supporters: {
          type: 'number',
          name: 'National Supporters (Campaign-only)',
          optional: true
        },
        district_supporters: {
          type: 'number',
          name: 'In-District Supporters',
          optional: true
        },
        district_phones: {
          type: 'number',
          name: 'In-District Phones',
          optional: true
        },
        press_hits: {
          type: 'number',
          name: 'Press Hits',
          optional: true
        },
        contributions: {
          type: 'number',
          name: 'Contributions',
          optional: true
        }
      }
    }
  }

  const geckoTables = Object.keys(geckoTableMapping)
  for (let index = 0; index < geckoTables.length; index++) {
    const table = geckoTables[index]
    const totalsTable = `${table}.totals`
    const mapping = geckoTableMapping[table]
    const geckoFields = Object.assign({
      timestamp: {
        type: 'datetime',
        name: 'Timestamp',
        optional: false
      }
    }, mapping.fieldMapping)

    const keys = await client.keysAsync(mapping.redisGlob)
    const data = []
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex]
      const parts = key.split(':')
      const fields = {}
      parts.forEach((part, index) => {
        if (index !== 0 && index !== parts.length - 1 && index % 2 === 1) {
          fields[part] = parts[index + 1]
        }
      })

      const metric = parts[parts.length - 1]
      const values = await client.zrangeAsync([key, 0, -1])
      let lastVal = null
      let lastDay = null
      for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
        const obj = JSON.parse(values[valueIndex])
        const value = obj.value
        const timestamp = moment.unix(obj.timestamp).endOf('day').toISOString()

        if (timestamp === lastDay) {
          continue
        } else {
          lastDay = timestamp
        }
        const allFields = Object.assign({}, fields)
        allFields.timestamp = timestamp
        let dailyVal = 0
        if (lastVal === null) {
          dailyVal = value
        } else {
          dailyVal = value - lastVal
        }
        lastVal = value
        let foundDatum = null
        data.forEach((datum) => {
          let found = true
          Object.keys(allFields).forEach((field) => {
            if (datum[field] !== allFields[field]) {
              found = false
            }
          })
          if (found === true) {
            foundDatum = datum
          }
        })

        if (foundDatum) {
          foundDatum[metric] = {
            daily: dailyVal,
            total: lastVal
          }
        } else {
          const newVal = Object.assign({}, allFields)
          newVal[metric] = {
            daily: dailyVal,
            total: lastVal
          }
          data.push(newVal)
        }
      }
    }

    const finalDailyData = []
    const finalTotalsData = []
    data.forEach((datum) => {
      const finalDailyDatum = {}
      const finalTotalDatum = {}
      Object.keys(datum).forEach((field) => {
        if (geckoFields[field]) {
          if (datum[field].hasOwnProperty('daily') && datum[field].hasOwnProperty('total')) {
            finalDailyDatum[field] = datum[field].daily
            finalTotalDatum[field] = datum[field].total
          } else {
            finalDailyDatum[field] = datum[field]
            finalTotalDatum[field] = datum[field]
          }
        }
      })
      finalDailyData.push(finalDailyDatum)
      finalTotalsData.push(finalTotalDatum)
    })

    let dataset = await createGeckoDataset(table, geckoFields)
    let totalsDataset = await createGeckoDataset(totalsTable, geckoFields)

    dataset = bluebird.promisifyAll(dataset)
    totalsDataset = bluebird.promisifyAll(totalsDataset)

    await dataset.putAsync(finalDailyData.slice(0, 500))
    await totalsDataset.putAsync(finalTotalsData.slice(0, 500))

    for (let index = 501; index < finalDailyData.length; index += 500) {
      const start = index
      const end = index + 500
      await dataset.postAsync(finalDailyData.slice(start, end), { delete_by: 'timestamp' })
      await totalsDataset.postAsync(finalTotalsData.slice(start, end), { delete_by: 'timestamp' })
    }
  }

  log.info('Finished syncing to Geckoboard.')
}

async function syncActBlueToRedis() {
  const timestamp = moment().unix()  
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    if (campaign.actblueEntity) {
      const response = await axios.get(`https://secure.actblue.com/api/2009-08/entities/${campaign.actblueEntity}`, {
        headers: {
          Accept: 'application/xml'
        },
        auth: {
          username: process.env.ACTBLUE_USER,       
          password: process.env.ACTBLUE_PASSWORD
        }
      })
      const parsed = await parseStringPromise(response.data)
      const totalContributions = parsed.entity.scoreboards[0].scoreboard[0].fact[0].count[0]
      const totalAmountRaised = parsed.entity.scoreboards[0].scoreboard[0].fact[0].total[0]
      await logMetric({ campaign: campaignToKey(campaign.name) }, 'amount_raised', timestamp, Math.round(parseFloat(totalAmountRaised) * 100))
      await logMetric({ campaign: campaignToKey(campaign.name) }, 'contributions', timestamp, parseInt(totalContributions, 10))
    }
  }
}

async function syncPressHitsToRedis() {
  const BNCAirtable = airtable.BNCAirtable
  const teamsBase = new BNCAirtable('app6OLwbE5uJYDyRV')
  const pressHits = await teamsBase.findAll('Press Hits', {
    fields: ['Campaigns', 'Date Published']
  })
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    await flushMetric({ campaign: campaignToKey(campaign.name) }, 'press_hits')
  }

  const pressHitsByCampaign = {}

  for (let index = 0; index < pressHits.length; index++) {
    const pressHit = pressHits[index]
    const atCampaigns = pressHit.get('Campaigns')
    if (atCampaigns) {
      atCampaigns.forEach((atCampaign) => {
        campaigns.forEach((campaign) => {
          if (campaign.airtableId === atCampaign) {
            const campaignName = campaignToKey(campaign.name) 
            if (!pressHitsByCampaign[campaignName]) {
              pressHitsByCampaign[campaignName] = []
            }
            pressHitsByCampaign[campaignName].push(pressHit)
          }
        })
      })
    }
  }
  const campaignKeys = Object.keys(pressHitsByCampaign)
  for (let index = 0; index < campaignKeys.length; index++) {
    const campaignKey = campaignKeys[index]
    const hits = pressHitsByCampaign[campaignKey]
    const sortedHits = hits.sort((a, b) => {
      const ts1 = moment(a.get('Date Published'), 'YYYY-MM-DD').unix()
      const ts2 = moment(b.get('Date Published'), 'YYYY-MM-DD').unix()
      return ts1 - ts2
    })
    let runningTotal = 0
    for (let hitIndex = 0; hitIndex < sortedHits.length; hitIndex++) {
      const hit = sortedHits[hitIndex]
      runningTotal = runningTotal + 1
      const timestamp = moment(hit.get('Date Published'), 'YYYY-MM-DD').unix()
      await logMetric({ campaign: campaignKey }, 'press_hits', timestamp, runningTotal)
    }
  }
}

async function calculateTotalDonations() {
  let totalFundraising = 0
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    if (campaign.name !== 'Total') {
      const campaignKey = campaignToKey(campaign.name)
      const latestVal = await latestMetric({ campaign: campaignKey }, 'amount_raised')
      console.log(latestVal, campaignKey)
      totalFundraising += latestVal
    }
  }
  console.log(totalFundraising)  
//  await logMetric({ campaign: campaignToKey('Total') }, 'amount_raised', moment().unix(), totalFundraising)
}

async function calculateTotalPressHits() {
  let totalHits = 0
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    if (campaign.name !== 'Total') {
      const campaignKey = campaignToKey(campaign.name)
      const latestVal = await latestMetric({ campaign: campaignKey }, 'press_hits')
      totalHits += latestVal
    }
  }
  await logMetric({ campaign: campaignToKey('Total') }, 'press_hits', moment().unix(), totalHits)
}

async function syncSupportersToRedis() {
  const timestamp = moment().unix()
  const bsd = new BSD(
    process.env.BSD_API_URL,
    process.env.BSD_API_ID,
    process.env.BSD_API_SECRET
  )
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    const campaignName = campaignToKey(campaign.name)
    if (campaign.supporters) {
      const consGroup = await bsd.getConstituentGroup(campaign.supporters)
      await logMetric({ campaign: campaignName }, 'supporters', timestamp, parseInt(consGroup.members, 10) || 0)
    }
    if (campaign.district_phones) {
      const consGroup = await bsd.getConstituentGroup(campaign.district_phones)
      await logMetric({ campaign: campaignName }, 'district_phones', timestamp, parseInt(consGroup.members, 10) || 0)
    }
    if (campaign.district_supporters) {
      const consGroup = await bsd.getConstituentGroup(campaign.district_supporters)
      await logMetric({ campaign: campaignName }, 'district_supporters', timestamp, parseInt(consGroup.members, 10) || 0)
    }
    if (campaign.donors) {
      const consGroup = await bsd.getConstituentGroup(campaign.donors)
      await logMetric({ campaign: campaignName }, 'donors', timestamp, parseInt(consGroup.members, 10) || 0)
    }
  }
}

async function syncRobbDonationsToRedis() {
  const response = await axios.get('https://sheetsu.com/apis/v1.0/7ac56516d309')
  const contributions = []
  const donors = []
  await flushMetric({ campaign: 'ar-03-robb-ryerse' }, 'amount_raised')
  await flushMetric({ campaign: 'ar-03-robb-ryerse' }, 'donors')

  for (let index = 0; index < response.data.length; index++) {
    const datum = response.data[index]
    const timestamp = moment(datum.Date, 'MM/DD/YYYY').unix()
    if (datum.Amount !== '') {
      await logMetric({ campaign: 'ar-03-robb-ryerse' }, 'amount_raised', timestamp, Math.round(parseInt(datum.Amount.replace(/\D/g,''), 10) * 100))
    }
    if (datum.Donors !== '') {
      await logMetric({ campaign: 'ar-03-robb-ryerse' }, 'donors', timestamp, parseInt(datum.Donors.replace(/\D/g,''), 10))
    }
  }
}

function campaignToKey(campaignName) {
  return campaignName.replace(/\s/g, '-').replace(/:/g, '').toLowerCase()
}

async function syncHistoricalDataToRedis() {
  files = [ 'brand-new-congress',
  'fl-07-chardo-richardson',
  'il-07-anthony-clark',
  'justice-democrats',
  'mo-01-cori-bush',
  'ny-14-alexandria-ocasio-cortez',
  'pa-07-paul-perry',
  'tx-10-ryan-stone',
  'tx-14-adrienne-bell',
  'tx-22-letitia-plummer',
  'tx-29-hector-morales',
  'wa-09-sarah-smith',
  'wv-sn-1-paula-jean-swearengin' ]
  for (let index = 0; index < files.length; index++)   {
    const file = files[index]
    log.info(`Processing ${file}...`)
    let totalAmountRaised = 0
    let totalContributions = 0
    let currentDate = null
    const csv = Baby.parseFiles(`/Users/saikat/Downloads/${file}.csv`, {
      header: true }).data
    for (let inner = 0; inner < csv.length; inner++) {
      let newDate = moment(csv[inner]['Date'])
      if (currentDate !== null && newDate.date() !== currentDate.date()) {
        const timestamp = currentDate.unix()
        await logMetric({ campaign: campaignToKey(file) }, 'amount_raised', timestamp, Math.round(parseFloat(totalAmountRaised) * 100))
        currentDate = newDate        
      }
      currentDate = newDate
      totalAmountRaised += parseFloat(csv[inner]['Amount'])
      totalContributions += 1
    }
  }
}

async function syncPACDonationsToRedis() {
  
}

async function calculateTotalExpenses() {

}

async function syncExpensesToRedis() {

}

async function syncTeamMetricsToRedis() {

}

async function sync() {
  log.info('Generating metrics...')
  await syncRobbDonationsToRedis()
  await syncActBlueToRedis()
  await syncPACDonationsToRedis()
  await syncExpensesToRedis()
  await syncSupportersToRedis()
  await syncPressHitsToRedis()
  await calculateTotalDonations()
  await calculateTotalPressHits()
//  await syncRedisToGeckoboard()
  log.info('Done syncing.')
}

sync().catch((ex) => log.error(ex))
