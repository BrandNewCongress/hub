var axios = require('axios')
var log = require('./log')
const { parseString } = require('xml2js')
const bluebird = require('bluebird')
const redis = require('redis')
const parseStringPromise = bluebird.promisify(parseString)
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)
const redisClient = redis.createClient(process.env.REDIS_URL)
const moment = require('moment')
const gecko = require('geckoboard')(process.env.GECKOBOARD_SECRET)
const geckoboard = bluebird.promisifyAll(gecko.datasets)
const Baby = require('babyparse')

redisClient.on("error", function (err) {
  log.error("Error " + err)
})

const campaignMetricsSchema = {
  timestamp: {
    type: 'datetime',
    name: 'Timestamp',
    optional: false
  },
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
  contributions: {
    type: 'number',
    name: 'Contributions',
    optional: true
  }
}
  /*
  expenses: {
    type: 'money',
    name: 'Expenses',
    optional: true
  },
  donors: {
    type: 'number',
    name: 'Donors',
    optional: true
  },
  supporters: {
    type: 'number',
    name: 'Supporters',
    optional: true
  },
  emails: {
    type: 'number',
    name: 'Supporters with Emails',
    optional: true
  },
  phones: {
    type: 'number',
    name: 'Supporters with Phones',
    optional: true
  },
  campaign_supporters: {
    type: 'number',
    name: 'Supporters (Campaign List)',
    optional: true
  }
}]*/

const campaigns = [{
  name: 'TX-14: Adrienne Bell',
  actblueEntity: 50725
}, {
  name: 'NY-14: Alexandria Ocasio-Cortez',
  actblueEntity: 50295
}, {
  name: 'IL-07: Anthony Clark',
  actblueEntity: 50745
}, {
  name: 'FL-07: Chardo Richardson',
  actblueEntity: 50546
}, {
  name: 'MO-01: Cori Bush',
  actblueEntity: 49905
}, {
  name: 'TX-29: Hector Morales',
  actblueEntity: 49941
}, {
  name: 'TX-22: Letitia Plummer',
  actblueEntity: 50744
}, {
  name: 'PA-07: Paul Perry',
  actblueEntity: 51003
}, {
  name: 'WV-SN-1: Paula Jean Swearengin',
  actblueEntity: 50279
}, {
  name: 'TX-10: Ryan Stone',
  actblueEntity: 49943
}, {
  name: 'WA-09: Sarah Smith',
  actblueEntity: 50285
}]

async function createGeckoDataset(id, fields) {
  let dataset = null
  try {
    dataset = await geckoboard.findOrCreateAsync({
      id: id,
      fields: fields
    })
  } catch (ex) {
    await geckoboard.deleteAsync(id)
    dataset = await geckoboard.findOrCreateAsync({
      id: id,
      fields: fields
    })
  }
  return dataset
}

async function syncRedisToGeckoboard() {
  const campaignKeys = await redisClient.keysAsync('metrics:campaigns:*')
  campaignKeys.forEach((key) => {
    const parts = key.split(':')    
    const field = parts[parts.length-1]
    if (!campaignMetricsSchema[field]) {
      log.error(`New campaign metric added: ${field}. Specify the type in metrics-sync.js. Defaulting to number`)
    }
  })

  let dailiesDataset = await createGeckoDataset('campaigns.daily', campaignMetricsSchema)
  const dailyMetrics = {}
  for (let index = 0; index < campaignKeys.length; index++) {
    const key = campaignKeys[index]
    const parts = key.split(':')
    const field = parts[parts.length-1]
    const campaign = parts[parts.length-2]
    let lastVal = null
    const values = await redisClient.zrangeAsync([key, 0, -1, 'WITHSCORES'])
    for (let valueIndex = 0; valueIndex < values.length; valueIndex += 2) {
      const value = JSON.parse(values[valueIndex]).value
      const timestamp = values[valueIndex + 1]
      if (!dailyMetrics[timestamp]) {
        dailyMetrics[timestamp] = {}
      }
      if (!dailyMetrics[timestamp][campaign]) {
        dailyMetrics[timestamp][campaign] = {}
      }

      let dailyVal = 0
      if (lastVal === null) {
        dailyVal = value
      } else {
        dailyVal = value - lastVal
      }
      lastVal = value
      dailyMetrics[timestamp][campaign][field] = dailyVal
    }
  }
  const geckoDailies = []

  Object.keys(dailyMetrics).forEach((timestamp) => {
    Object.keys(dailyMetrics[timestamp]).forEach((campaign) => {
      geckoDailies.push({
        timestamp: moment.unix(timestamp).toISOString(),
        campaign: campaign,
        amount_raised: dailyMetrics[timestamp][campaign].amount_raised,
        contributions: dailyMetrics[timestamp][campaign].contributions
      })
    })
  })

  dailiesDataset = bluebird.promisifyAll(dailiesDataset)

  await dailiesDataset.putAsync(geckoDailies.slice(0, 500))

  for (let index = 501; index < geckoDailies.length; index += 500) {
    const start = index
    const end = index + 500
    await dailiesDataset.postAsync(geckoDailies.slice(start, end), { delete_by: 'timestamp' })
  }

  log.info('Finished syncing to Geckoboard.')
}

async function syncActBlueToRedis() {
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    const timestamp = moment().unix()
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
    const contributionsMetric = `metrics:campaigns:${campaignToKey(campaign.name)}:contributions`
    const amountRaisedMetric = `metrics:campaigns:${campaignToKey(campaign.name)}:amount_raised`
    const contributions = {
      timestamp: timestamp,
      value: parseInt(totalContributions, 10)
    }

    const amountRaised = {
      timestamp: timestamp,
      value: Math.round(parseFloat(totalAmountRaised) * 100)
    }
    log.info(`Syncing ${campaign.name} to redis...`)
    await redisClient.zaddAsync(contributionsMetric, timestamp, JSON.stringify(contributions))
    await redisClient.zaddAsync(amountRaisedMetric, timestamp, JSON.stringify(amountRaised))
  }
}

async function syncRobbDonationsToRedis() {

}

async function syncPACDonationsToRedis() {

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
    console.log(`Processing ${file}...`)
    let totalAmountRaised = 0
    let totalContributions = 0
    let currentDate = null
    const csv = Baby.parseFiles(`/Users/saikat/Downloads/${file}.csv`, {
      header: true }).data
    for (let inner = 0; inner < csv.length; inner++) {
      let newDate = moment(csv[inner]['Date'])
      if (currentDate !== null && newDate.date() !== currentDate.date()) {
        console.log('Hitting redis...', currentDate)
        const timestamp = currentDate.unix()
        const contributionsMetric = `metrics:campaigns:${campaignToKey(file)}:contributions`
        const amountRaisedMetric = `metrics:campaigns:${campaignToKey(file)}:amount_raised`
        const contributions = {
          timestamp: timestamp,
          value: parseInt(totalContributions, 10)
        }

        const amountRaised = {
          timestamp: timestamp,
          value: Math.round(parseFloat(totalAmountRaised) * 100)
        }
        await redisClient.zaddAsync(contributionsMetric, timestamp, JSON.stringify(contributions))
        await redisClient.zaddAsync(amountRaisedMetric, timestamp, JSON.stringify(amountRaised))
        currentDate = newDate        
      }
      currentDate = newDate
      totalAmountRaised += parseFloat(csv[inner]['Amount'])
      totalContributions += 1
    }
  }
}

async function sync() {
  log.info('Generating metrics...')
  await syncActBlueToRedis()
  await syncRedisToGeckoboard()
  log.info('Done syncing.')
}

sync().catch((ex) => log.error(ex))
