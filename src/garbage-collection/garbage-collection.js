import airgoose from '../airgoose'

const mainBase = process.env.AIRTABLE_BASE
const garbageBase = process.env.GARBAGE_BASE

const garbageModel = model => airgoose.model(model, garbageBase)

const garbage = {
  Person: garbageModel('Person')
}

const main = {
  Person: airgoose.model('Person')
}

main.Person
.find({
  $or: [
    {nominationStatus: 'R1 - Rejected'},
    {nominationStatus: 'R2 - Rejected'}
  ]
})
.populate('evaluations nominations addresses')
.exec((err, rejections) => {
  garbage.Person.create(rejections[0])
  .then(person => {
    console.log('created person')
    console.log(person)
  })
  .catch(err => {
    console.log(err)
    console.log(JSON.stringify(err))
  })
})
