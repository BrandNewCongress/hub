const fs = require('fs')
const monk = require('monk')
const toAirCase = require('../airgoose/to-air-case').default
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const Evaluations = db.get('Nominee Evaluations')
const People = db.get('People')
const ContactLogs = db.get('Contact Logs')
const Nominations = db.get('Nominations')

const toDatify = [
  [Evaluations, 'evaluationDate'],
  [People, 'dateCreated'],
  [ContactLogs, 'dateContacted'],
  [Nominations, 'dateSubmitted']
]

const datify = ([Model, dateField]) => new Promise((resolve, reject) => {
  console.log(`Datifying ${dateField}`)

  Model
  .find()
  .then(documents =>
    Model
    .bulkWrite(documents.map(d => typeof d[dateField] == 'string'
      ? ({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { [dateField]: new Date(d[dateField]) } }
        }
      })
      : undefined
    ).filter(u => u))
    .then(_ => {
      console.log(`Datified ${dateField}`)
      resolve(_)
    })
    .catch(reject)
  )
})

Promise
.all(toDatify.map(datify))
.then(results => {
  console.log('Done')
  console.log(JSON.stringify(results))
})
.catch(err => {
  console.log('Failed')
  console.log(JSON.stringify(err))
})
