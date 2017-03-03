import airgoose from '../airgoose'
import tl from '../airgoose/tl'
import mongo, {getMetadata, setMetadata} from './mongo'
import collections from './collections'

const models = {}
const controllers = {}
// collections.forEach(c => {
const touse = ['People']
touse.forEach(c => {
  const singular = Object.entries(tl).filter(([singular, plural]) => plural == c)[0][0]
  console.log(singular)

  models[c] = {
    mongo: mongo[c],
    air: airgoose.model(singular)
  }
})

const DO = () =>
  models.People.air
  .find({
    $or: [
      {nominationStatus: 'R1 - Rejected'},
      {nominationStatus: 'R2 - Rejected'} ]
  })
  .exec((err, rejections) => {
    models.People.mongo.insert(rejections)
    .then(written => {
      console.log(`Wrote ${written.length} records to mongo`)

      const destroyNext = (idx) => {
        if (idx < written.length) {
          models.People.air.destroy(written[idx].id)
          .then(_ => {
            console.log(`Destroyed ${idx}: ${written[idx].id}`)
            destroyNext(idx + 1)
          })
          .catch(err => {
            console.log(`Could not delete ${JSON.stringify(written[idx])}`)
            console.log(err)
          })
        } else {
          console.log(`Done!`)
          DO()
        }
      }

      destroyNext(0)
    })
  })

DO()
