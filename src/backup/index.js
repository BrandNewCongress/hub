import airgoose from '../airgoose'
import tl from '../airgoose/tl'
import mongo, {getMetadata, setMetadata} from './mongo'
import collections from './collections'

const DO = (model) => {
  console.log(model.name)

  model.air
  .findAll({})
  .exec((err, docs) => {
    console.log(`got docs ${docs.length}`)
    model.mongo.bulkWrite(docs.map(d => ({
      updateOne: {
        filter: {id: d.id},
        update: {$set: d},
        upsert: true
      }
    })))
    .then(written => {
      console.log(JSON.stringify(written))
      console.log(`Wrote ${written.length} records to mongo`)

      // const destroyNext = (idx) => {
      //   if (idx < written.length) {
      //     models.People.air.destroy(written[idx].id)
      //     .then(_ => {
      //       console.log(`Destroyed ${idx}: ${written[idx].id}`)
      //       destroyNext(idx + 1)
      //     })
      //     .catch(err => {
      //       console.log(`Could not delete ${JSON.stringify(written[idx])}`)
      //       console.log(err)
      //     })
      //   } else {
      //     console.log(`Done!`)
      //     DO()
      //   }
      // }
      //
      // destroyNext(0)
    }).catch(err => {
      console.log('Err!')
      console.log(JSON.stringify(err))
    })
  })
}

const models = {}
const controllers = {}
// collections.forEach(c => {
const touse = collections.filter(c => c != 'People' && c != 'Nominee Evaluations')
touse.forEach(c => {
  console.log(c)
  const singular = Object.entries(tl).filter(([singular, plural]) => plural == c)[0][0]
  console.log(singular)

  models[c] = {
    name: c,
    mongo: mongo[c],
    air: airgoose.model(singular)
  }

  DO(models[c])
})
