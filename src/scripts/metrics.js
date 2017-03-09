const fs = require('fs')
const monk = require('monk')
const toAirCase = require('../airgoose/to-air-case').default
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const statuses = {}

const People = db.get('People')
People
.find()
.then(people => {
  console.log('hello')

  people.forEach(p =>
    statuses[p.nominationStatus] = statuses[p.nominationStatus] ? statuses[p.nominationStatus] + 1 : 1
  )

  const cleaner = {}
  Object
    .keys(statuses)
    .filter(s => s != 'Not Nominated')
    .sort()
    .forEach(s =>
      cleaner[s] = statuses[s]
    )

  console.log(JSON.stringify(cleaner, null, 2))
})
.catch(err => {
  console.log(err)
})
