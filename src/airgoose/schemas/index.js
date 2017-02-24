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
  /* SIMPLE FIELDS */
  'facebook': yup.string().url(),
  'linkedIn': yup.string().url(),
  'twitter': yup.string().url(),
  'profile': yup.string(),
  'otherLinks': yup.string(),
  /* ENUMS */
  'gender': yup.string(),
  'politicalParty': yup.string(),
  'religion': yup.string(),
  /* MULTI-SELECT ENUMS */
  'potentialVolunteer': yup.array().of(yup.string()),
  'race': yup.array().of(yup.string()),
  'occupations': yup.array().of(yup.string()),
  /* LINKED FIELDS */
  'evaluations': yup.array().of(yup.string()),
  'nominations': yup.array().of(yup.string()),
  'emailAddresses': yup.array().of(yup.string().transform((value) => value.replace(/\s/g, '')).email()),
  'phoneNumbers': yup.array().of(yup.string()),
})

const District = yup.object().shape({
  // just needs to exist, district should not be editing by the api though so
  // no need for validation
})

const wrapModel = model => ({
  fields: model.fields,
  cast: obj => model.cast(Object.keys(obj)
    .filter(key => model.fields[key])
    .reduce((acc, key) =>
      Object.assign({[key]: obj[key]}, acc)
    , {}))
})

export default {
  Person: wrapModel(Person),
  Evaluation: wrapModel(Evaluation),
  District: wrapModel(District)
}
