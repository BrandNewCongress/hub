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
const airtableSingleton = require('./airtable')
const gecko = require('geckoboard')(process.env.GECKOBOARD_SECRET)
const geckoboard = bluebird.promisifyAll(gecko.datasets)

redisClient.on("error", function (err) {
  log.error("Error " + err)
})

const metricsSchema = {
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

const totalsSchema = {
  timestamp: {
    type: 'datetime',
    name: 'Timestamp'
  },
  campaign: {
    type: 'string',
    name: 'Campaign',
    optional: false
  },
  total_amount_raised: {
    type: 'money',
    name: 'Total Amount Raised',
    optional: true,
    currency_code: 'USD'
  },
  total_contributions: {
    type: 'number',
    name: 'Total Contributions',
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

async function syncAirtableToGeckoboard() {
  const airtable = new airtableSingleton.BNCAirtable('app6OLwbE5uJYDyRV')
  const atCampaigns = await airtable.findAll('Campaigns')  
  const campaignsHash = {}
  atCampaigns.forEach((campaign) => {
    campaignsHash[campaign.id] = campaign.get('Campaign')
  })

  let totalsDataset = null
  let dailiesDataset = null
  const metrics = await airtable.findAll('Metrics')

  try {
    dailiesDataset = await geckoboard.findOrCreateAsync({
      id: 'campaigns.metrics.daily',
      fields: metricsSchema
    })
  } catch (ex) {
    console.log(ex)
    await geckoboard.deleteAsync('campaigns.metrics.daily')
    dailiesDataset = await geckoboard.findOrCreateAsync({
      id: 'campaigns.metrics.daily',
      fields: metricsSchema
    })
  }

  try {
    totalsDataset = await geckoboard.findOrCreateAsync({
      id: 'campaigns.metrics.totals',
      fields: totalsSchema
    })
  } catch (ex) {
    await geckoboard.deleteAsync('campaigns.metrics.totals')
    totalsDataset = await geckoboard.findOrCreateAsync({
      id: 'campaigns.metrics.totals',
      fields: totalsSchema
    })
  }

  const dailyMetrics = []
  const totalMetrics = []
  const sortedMetrics = metrics.sort((ele1, ele2) => ele1.get('Date') <= ele2.get('Date') ? -1: 1)
  let lastTotals = {}
  sortedMetrics.forEach((metric) => {
    const campaign = campaignsHash[metric.get('Campaign')]
    const date = metric.get('Date')
    console.log(metric.get('Total Contributions'))
    const totalMetric = {
      timestamp: date,
      campaign: campaign,
      total_amount_raised: Math.round(metric.get('Total Amount Raised') * 100),
      total_contributions: metric.get('Total Contributions')
    }
    console.log(totalMetric)
    let amountRaised = 0
    let contributions = 0
    if (lastTotals[campaign]) {
      amountRaised = totalMetric.total_amount_raised - lastTotals[campaign].total_amount_raised
      contributions = totalMetric.contributions - lastTotals[campaign].contributions
    } else {
      amountRaised = totalMetric.total_amount_raised
      contributions = totalMetric.total_contributions
    }
    console.log(metric.get('Date'), campaign, amountRaised, contributions)
    lastTotals[campaign] = totalMetric
    totalMetrics.push(totalMetric)
    dailyMetrics.push({
      timestamp: date,
      campaign: campaign,
      amount_raised: Math.round(amountRaised),
      contributions: contributions
    })
  })
  totalsDataset = bluebird.promisifyAll(totalsDataset)
  dailiesDataset = bluebird.promisifyAll(dailiesDataset)
  await totalsDataset.putAsync(totalMetrics)
  await dailiesDataset.putAsync(dailyMetrics)
}

async function syncActBlueToAirtable() {
  const airtable = new airtableSingleton.BNCAirtable('app6OLwbE5uJYDyRV')
  const atCampaigns = await airtable.findAll('Campaigns')  
  const campaignsHash = {}
  atCampaigns.forEach((campaign) => {
    campaignsHash[campaign.get('Campaign')] = campaign.id
  })

  for (let index = 0; index < campaigns.length; index++) {
    const campaign = campaigns[index]
    const timestamp = moment().toISOString()
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

    await airtable.create('Metrics', {
      'Campaign': [campaignsHash[campaign.name]],
      'Date': timestamp,
      'Total Amount Raised': parseFloat(totalAmountRaised, 10),
      'Total Contributions': parseInt(totalContributions, 10)
    })
  }
}

async function sync() {
  await syncActBlueToAirtable()
  await syncAirtableToGeckoboard()
}

sync().catch((ex) => log.error(ex))
