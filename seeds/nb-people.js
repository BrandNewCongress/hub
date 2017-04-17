// Seed db with first 10 people in nation builder
const nbClient = require('nation-pool').client
const log = require('debug')('bnc:seed:nb-people')
const toCamelCase = require('to-camel-case')

module.exports.seed = db => new Promise((resolve, reject) => {
  log('Starting NB seed')

  nbClient.get('people')
  .then(({results}) => Promise.all(
    results.map(p => db.insert(filterNullFields(p)).into('people'))
  ))
  .then(resolve)
  .catch(reject)
})

function filterNullFields (obj) {
  const result = {}
  for (let key in obj) {
    if (obj[key] != null) {
      result[toCamelCase(key)] = obj[key]
    }
  }
  return result
}
