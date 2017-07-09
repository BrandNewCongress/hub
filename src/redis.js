const redis = require('redis')
const bluebird = require('bluebird')
const log = require('./log')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)
const redisClient = redis.createClient(process.env.REDIS_URL)

redisClient.on("error", function (err) {
  log.error("Error " + err)
})

function metricStringFromHash(metadata, metric) {
  let key = 'metrics'
  const metadataKeys = Object.keys(metadata).sort()
  metadataKeys.forEach((datum) => {
    key = `${key}:${datum}:${metadata[datum]}`
  })
  key = `${key}:${metric}`
  return key
}

async function flushMetric(metadata, metric) {
  const key = metricStringFromHash(metadata, metric)
  await redisClient.zremrangebyrankAsync(key, 0, -1)
}

async function logMetric(metadata, metric, timestamp, value) {
  const key = metricStringFromHash(metadata, metric)

  const obj = {
    timestamp: timestamp,
    value: value
  }
  await redisClient.zaddAsync(key, timestamp, JSON.stringify(obj))
}

async function latestMetric(metadata, metric) {
  const key = metricStringFromHash(metadata, metric)
  console.log(key)
  const lastVal = await redisClient.zrevrangeAsync(key, 0, 0)
  if (lastVal && lastVal.length > 0) {
    return JSON.parse(lastVal[0]).value
  }
  return 0
}

module.exports = {
  client: redisClient,
  logMetric: logMetric,
  latestMetric: latestMetric,
  flushMetric: flushMetric
}