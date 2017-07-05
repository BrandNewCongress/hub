const redis = require('redis')
const bluebird = require('bluebird')
const log = require('./log')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)
const redisClient = redis.createClient(process.env.REDIS_URL)

redisClient.on("error", function (err) {
  log.error("Error " + err)
})

async function logTSPoint(metric, timestamp, value) {
  log.info(metric, timestamp, value)
  const obj = {
    timestamp: timestamp,
    value: value
  }
  await redisClient.zaddAsync(metric, timestamp, JSON.stringify(obj))
}

module.exports = {
  client: redisClient,
  logTSPoint: logTSPoint
}