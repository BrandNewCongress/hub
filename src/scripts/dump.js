const fs = require('fs')
const monk = require('monk')
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')
const airgoose = require('../airgoose').default

const statuses = {}

const People = db.get('People')
const States = db.get('States')
const CDs = db.get('Congressional Districts')

People
.find({state: {$in: [
  'recjiShvI281OHRj4', 'recyGxc2uUaEzAaSR', 'recvEuYEHeM0rchDI'
]}})
.then(people => {
  const dump = []

  let fields = new Set()
  for (let p of people) {
    Object.keys(p).forEach(k => fields.add(k))
    const s = await States.findOne({id: {$in: p.states}})
    const cd = await CDs.findOne({id: {$in: p.district}})
    people.state = s].name
  }

  people.forEach(p => {
  })

  fields = [...fields].sort()
  dump.push(fields)

  people.forEach(p => {
    dump.push(fields.map(f => p[f]
      ? `"${p[f].toString().replace(/"/g, `'`)}"`
      : `""`
    ).join(','))
  })

  fs.writeFileSync('./dump.csv', dump.join('\n'))

  console.log('done')
})
.catch(err => {
  console.log(err)
})
