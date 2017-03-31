const monk = require('monk')
const collections = require('./collections')
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const e = {}

collections.forEach(obj => {
  const c = Object.keys(obj)[0]
  e[c] = db.get(c)
})

module.exports = e e
