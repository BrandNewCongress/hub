const airgoose = require('../airgoose')
const tl = require('../airgoose/tl')
const mongo = require('./mongo')
const collections = require('./collections')

const transform = (json, dateFields) => Object.assign(json, dateFields.reduce((acc, field) =>
  Object.assign(acc, json[field]
    ? {[field]: new Date(json[field])}
    : {}
  )
, {}))

const backup = model => new Promise((resolve, reject) => {
  console.log(`Fetching ${model.name}`)

  model.air
  .findAll()
  .exec((err, docs) => {
    if (err) return reject(err)

    console.log(`Got ${docs.length} records`)

    model.mongo.bulkWrite(docs.map(d => ({
      updateOne: {
        filter: {id: d.id},
        update: {$set: transform(d, model.dateFields)},
        upsert: true
      }
    })))
    .then(written => {
      console.log(JSON.stringify(written))
      console.log(`Modified ${written.nModified} records`)
      console.log(`${written.nUpserted} were new`)
      resolve(written.nModified)
    }).catch(err => {
      console.log('Err!')
      console.log(JSON.stringify(err))
      reject(err)
    })
  })
})

const models = {}
const controllers = {}
collections.forEach(obj => {
  const c = Object.keys(obj)[0]
  const singular = Object.keys(tl).filter(singular => tl[singular] == c)[0]

  models[c] = {
    name: c,
    mongo: mongo[c],
    air: airgoose.model(singular, undefined, true),
    dateFields: obj[c]
  }
})

const go = async () => {
  for (let name in models) {
    try {
      let results = await backup(models[name])
    } catch(ex) {
      console.log(ex)
      return ex
    }
  }

  console.log('Done!')
  process.exit()
}

go()
