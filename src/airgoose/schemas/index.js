const yup = require('yup')

const Evaluation = require('./evaluation')
const Nomination = require('./nomination')
const Person = require('./person')
const Address = require('./address')

const District = yup.object().shape({
  // just needs to exist, district should not be editing by the api though so
  // no need for validation
})

const wrapModel = model => ({
  fields: model.fields,
  cast: obj => model.cast(Object.keys(obj)
    .filter(key => model.fields[key])
    .reduce((acc, key) =>
      Object.assign({ [key]: obj[key] }, acc)
    , {}))
})

module.exports = {
  Person: wrapModel(Person),
  Evaluation: wrapModel(Evaluation),
  Address: wrapModel(Address),
  Nomination: wrapModel(Nomination),
  District: wrapModel(District)
}
