import airgoose from '../airgoose'
import ltl from '../airgoose/ltl'
import tl from '../airgoose/tl'
import monk from 'monk'
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const Person = airgoose.model('Person', false, true)

const query = {state: {$in: [
  'recjiShvI281OHRj4',
]}}

const populate = (obj, fields) => Promise.all(fields.map(f => new Promise((resolve, reject) => {
  if (!obj[f]) return resolve(true)

  const modelName = ltl.Person[f]
  const table = tl[modelName]
  db.get(table).find({id: {$in: arrify(obj[f])}})
  .then(linked => {
    obj[f] = linked.map(e => {
      delete e.evaluator
      return e
    })
    resolve(true)
  })
  .catch(reject)
})))

try {
  db.get('People')
  .find(query, {fields: ['name', 'gender', 'race', 'profile', 'nominationStatus', ]})
  .then(async people => {
    console.log(`Found ${people.length}`)

    for (let p of people) {
      let airp

      console.log('Populating')
      await populate(p, toPopulate)
      console.log('populated')

      try {
        airp = await Person.update(p.id, p)
        console.log('updated')

        if (airp) {
          console.log(`Had ${p.id}`)
        } else {
          console.log(`Not sure what happened here ${JSON.stringify(p, null, 2)}`)
        }
      } catch (err) {
        console.log(err)

        airp = await Person.create(p)
        console.log(`Now have ${p.id}`)
      }
    }
  })
} catch (err) {
  console.log(err)
}

function arrify (val) {
  return Array.isArray(val) ? val : [val]
}
