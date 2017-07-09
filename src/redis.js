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
  let key = 'metric'
  const metadataKeys = Object.keys(metadata).sort()
  metadataKeys.forEach((datum) => {
    key = `${key}:${datum}:${metadata[datum]}`
  })
  key = `${key}:metric`
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
  await redisClient.zaddAsync(metric, timestamp, JSON.stringify(obj))
}

module.exports = {
  client: redisClient,
  logMetric: logMetric,
  flushMetric: flushMetric
}