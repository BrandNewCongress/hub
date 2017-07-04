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
        supporters_total: {
          type: 'number',
          name: 'Supporters (Emails + Phones, in-district)',
          optional: true
        },
        signups_campaign: {
          type: 'number',
          name: 'Signups (Campaign-only)',
          optional: true
        },
        emails: {
          type: 'number',
          name: 'Emails (In-district)',
          optional: true
        },
        phones: {
          type: 'number',
          name: 'Phones (In-district)',
          optional: true
        },
        press_hits: {
          type: 'number',
          name: 'Press Hits',
          optional: true
        }
      }
    }
  }

  const geckoTables = Object.keys(geckoTableMapping)
  for (let index = 0; index < geckoTables.length; index++) {
    const table = geckoTables[index]
    const mapping = geckoTableMapping[table]
    const geckoFields = Object.assign({
      timestamp: {
        type: 'datetime',
        name: 'Timestamp',
        optional: false
      }
    }, mapping.fieldMapping)
    let dataset = await createGeckoDataset(table, geckoFields)
    const keys = await redisClient.keysAsync(mapping.redisGlob)
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
      const values = await redisClient.zrangeAsync([key, 0, -1, 'WITHSCORES'])
      let lastVal = null
      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 2) {
        const obj = JSON.parse(values[valueIndex])
        const value = obj.value
        const timestamp = moment.unix(obj.timestamp).toISOString()
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
          foundDatum[metric] = dailyVal
        } else {
          const newVal = Object.assign({}, allFields)
          newVal[metric] = dailyVal          
          data.push(newVal)
        }
      }
    }

    const finalData = []
    data.forEach((datum) => {
      const finalDatum = {}
      Object.keys(datum).forEach((field) => {
        if (geckoFields[field]) {
          finalDatum[field] = datum[field]
        }
      })
      finalData.push(finalDatum)
    })

    dataset = bluebird.promisifyAll(dataset)

    await dataset.putAsync(finalData.slice(0, 500))

    for (let index = 501; index < finalData.length; index += 500) {
      const start = index
      const end = index + 500
      await dataset.postAsync(finalData.slice(start, end), { delete_by: 'timestamp' })
    }
  }

  log.info('Finished syncing to Geckoboard.')
}

async function syncActBlueToRedis() {
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
    const contributionsMetric = `metrics:campaign:${campaignToKey(campaign.name)}:contributions`
    const amountRaisedMetric = `metrics:campaign:${campaignToKey(campaign.name)}:amount_raised`
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

async function syncAsanaToRedis() {

}

async function syncExpensesToRedis() {

}

async function syncTeamMetricsToRedis() {

}

async function syncPACDonationsToRedis() {

}

async function syncRobbDonationsToRedis() {
  const response = await axios.get('https://sheetsu.com/apis/v1.0/7ac56516d309')
  const contributions = []
  const donors = []
  const contributionsMetric = 'metrics:campaign:ar-03-robb-ryerse:amount_raised'
  const donorsMetric = 'metrics:campaign:ar-03-robb-ryerse:donors'
  await redisClient.zremrangebyrankAsync(contributionsMetric, 0, -1)
  await redisClient.zremrangebyrankAsync(donorsMetric, 0, -1)
  for (let index = 0; index < response.data.length; index++) {
    const datum = response.data[index]
    const timestamp = moment(datum.Date, 'MM/DD/YYYY').unix()
    if (datum.Amount !== '') {
      const contribution = {
        timestamp: timestamp,
        value: Math.round(parseInt(datum.Amount.replace(/\D/g,''), 10) * 100)
      }
      await redisClient.zaddAsync(contributionsMetric, timestamp, JSON.stringify(contribution))
    }
    if (datum.Donors !== '') {
      const donor = {
        timestamp: timestamp,
        value: parseInt(datum.Donors.replace(/\D/g,''), 10)
      }
      await redisClient.zaddAsync(donorsMetric, timestamp, JSON.stringify(donor))
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
        console.log('Hitting redis...', currentDate)
        const timestamp = currentDate.unix()
        const contributionsMetric = `metrics:campaign:${campaignToKey(file)}:contributions`
        const amountRaisedMetric = `metrics:campaign:${campaignToKey(file)}:amount_raised`
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
  await syncRobbDonationsToRedis()
  await syncActBlueToRedis()
//  await syncExpensesToRedis()
  await syncRedisToGeckoboard()
  await renameKeys()

  log.info('Done syncing.')
}

sync().catch((ex) => log.error(ex))
