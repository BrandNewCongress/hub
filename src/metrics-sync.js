var axios = require('axios')
var log = require('./log')
const { parseString } = require('xml2js')
const bluebird = require('bluebird')
const { client, logTSPoint } = require('./redis')
const parseStringPromise = bluebird.promisify(parseString)
const moment = require('moment')
const gecko = require('geckoboard')(process.env.GECKOBOARD_SECRET)
const geckoboard = bluebird.promisifyAll(gecko.datasets)
const Baby = require('babyparse')
const BSD = require('./bsd')

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
      const values = await client.zrangeAsync([key, 0, -1, 'WITHSCORES'])
      let lastVal = null
      let lastDay = null
      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 2) {
        const obj = JSON.parse(values[valueIndex])
        const value = obj.value

        // We send data with day granularity
        const timestamp = moment.unix(obj.timestamp).startOf('day').toISOString()
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
      console.log(finalDatum)
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
  const timestamp = moment().unix()
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
    await logTSPoint(amountRaisedMetric, timestamp, Math.round(parseFloat(totalAmountRaised) * 100))
    await logTSPoint(contributionsMetric, timestamp, parseInt(totalContributions, 10))
  }
}

async function syncExpensesToRedis() {

}

async function syncPressHitsToRedis() {

}

async function syncTeamMetricsToRedis() {

}

async function syncPACDonationsToRedis() {

}

async function syncSupportersToRedis() {
  const timestamp = moment().unix()
  const campaigns = [{
    name: 'TX-14: Adrienne Bell',
    supporters: 277,
    district_phones: 359,
    district_supporters: 358
  }, {
    name: 'NY-14: Alexandria Ocasio-Cortez',
    supporters: 275,
    district_phones: 317,
    district_supporters: 316
  }, {
    name: 'IL-07: Anthony Clark',
    supporters: 274,
    district_phones: 319,
    district_supporters: 318
  }, {
    name: 'FL-07: Chardo Richardson',
    supporters: 286,
    district_phones: 323,
    district_supporters: 322
  }, {
    name: 'MO-01: Cori Bush',
    supporters: 282,
    district_phones: 327,
    district_supporters: 326
  }, {
    name: 'TX-29: Hector Morales',
    supporters: 279,
    district_phones: 330,
    district_supporters: 331
  }, {
    name: 'TX-22: Letitia Plummer',
    supporters: 278,
    district_phones: 335,
    district_supporters: 334
  }, {
    name: 'PA-07: Paul Perry',
    supporters: 289,
    district_phones: 339,
    district_supporters: 338
  }, {
    name: 'WV-SN-1: Paula Jean Swearengin',
    supporters: 284,
    district_phones: 343,
    district_supporters: 342
  }, {
    name: 'TX-10: Ryan Stone',
    supporters: 281,
    district_phones: 351,
    district_supporters: 350
  }, {
    name: 'WA-09: Sarah Smith',
    supporters: 273,
    district_phones: 355,
    district_supporters: 354
  }, {
    name: 'AR-03: Robb Ryerse',
    supporters: 272,
    district_phones: 347,
    district_supporters: 346
  }, {
    name: 'Justice Democrats',
    supporters: 310
  }, {
    name: 'Brand New Congress',
    supporters: 309
  }, {
    name: 'Total',
    supporters: 408
  }]
  const bsd = new BSD(
    process.env.BSD_API_URL,
    process.env.BSD_API_ID,
    process.env.BSD_API_SECRET
  )
  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    const campaignName = campaignToKey(campaign.name)
    const supportersMetric = `metrics:campaign:${campaignName}:supporters`
    const districtSupportersMetric = `metrics:campaign:${campaignName}:district_supporters`
    const districtPhonesMetric = `metrics:campaign:${campaignName}:district_phones`
    if (campaign.supporters) {
      const consGroup = await bsd.getConstituentGroup(campaign.supporters)
      await logTSPoint(supportersMetric, timestamp, parseInt(consGroup.members, 10) || 0)
    }
    if (campaign.district_phones) {
      const consGroup = await bsd.getConstituentGroup(campaign.district_phones)
      await logTSPoint(districtPhonesMetric, timestamp, parseInt(consGroup.members, 10) || 0)
    }
    if (campaign.district_supporters) {
      const consGroup = await bsd.getConstituentGroup(campaign.district_supporters)
      await logTSPoint(districtSupportersMetric, timestamp, parseInt(consGroup.members, 10) || 0)
    }
  }
}

async function syncRobbDonationsToRedis() {
  const response = await axios.get('https://sheetsu.com/apis/v1.0/7ac56516d309')
  const contributions = []
  const donors = []
  const contributionsMetric = 'metrics:campaign:ar-03-robb-ryerse:amount_raised'
  const donorsMetric = 'metrics:campaign:ar-03-robb-ryerse:donors'
  await client.zremrangebyrankAsync(contributionsMetric, 0, -1)
  await client.zremrangebyrankAsync(donorsMetric, 0, -1)
  for (let index = 0; index < response.data.length; index++) {
    const datum = response.data[index]
    const timestamp = moment(datum.Date, 'MM/DD/YYYY').unix()
    if (datum.Amount !== '') {
      await logTSPoint(contributionsMetric, timestamp, Math.round(parseInt(datum.Amount.replace(/\D/g,''), 10) * 100))
    }
    if (datum.Donors !== '') {
      await logTSPoint(donorsMetric, timestamp, parseInt(datum.Donors.replace(/\D/g,''), 10))
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
        const contributionsMetric = `metrics:campaign:${campaignToKey(file)}:contributions`
        const amountRaisedMetric = `metrics:campaign:${campaignToKey(file)}:amount_raised`
        await logTSPoint(amountRaisedMetric, timestamp, Math.round(parseFloat(totalAmountRaised) * 100))
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
  await syncExpensesToRedis()
  await syncSupportersToRedis()
  await syncRedisToGeckoboard()
  log.info('Done syncing.')
}

sync().catch((ex) => log.error(ex))
