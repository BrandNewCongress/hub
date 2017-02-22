import yup from 'yup'

const Evaluation = yup.object().shape({
  score: yup.number().positive().integer(),
  round: yup.string().matches(/R[0-9]/),
  districtScore: yup.string(),
  moveToNextRound: yup.string(),
  nominee: yup.array().of(yup.string()),
  evaluator: yup.array().of(yup.string())
})

const Person = yup.object().shape({
  'emailAddresses': yup.array().of(yup.string().transform((value) => value.replace(/\s/g, '')).email()),
  'phoneNumbers': yup.array().of(yup.string()),
  'facebook': yup.string().url(),
  'linkedIn': yup.string().url(),
  'profile': yup.string(),
  'otherLinks': yup.string(),
  'gender': yup.string(),
  'race': yup.array().of(yup.string()).transform((_, val) => [val]),
  'politicalParty': yup.string(),
  'religion': yup.string(),
  'occupations': yup.string(),
  'potentialVolunteer': yup.boolean(),
  'evaluations': yup.array().of(yup.string()),
  'addresses': yup.array().of(yup.string()),
  'nominations': yup.array().of(yup.string())
})

const wrapModel = model => ({
  fields: model.fields,
  cast: obj => model.cast(Object.keys(obj)
    .filter(key => model.fields[key])
    .reduce((acc, key) =>
      Object.assign({[key]: obj[key]}, acc)
    , {})),
})

export default {
  Person: wrapModel(Person),
  Evaluation: wrapModel(Evaluation),
  Address: wrapModel(Address),
}
