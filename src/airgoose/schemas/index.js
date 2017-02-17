import yup from 'yup'

const Evaluation = yup.object().shape({
  Score: yup.number().required().positive().integer(),
  Round: yup.string().matches(/R[0-9]/),
  'Move To Next Round': yup.string(),
  Nominee: yup.array().of(yup.string())
})

const Address = yup.object().shape({
  State: yup.array().of(yup.string()),
  City: yup.string()
})

const Person = yup.object().shape({
  'emailAddresses': yup.array().of(yup.string().transform((value) => value.replace(/\s/g, '')).email()),
  'phoneNumbers': yup.array().of(yup.string()),
  'facebook': yup.string().url(),
  'linkedIn': yup.string().url(),
  'profile': yup.string(),
  'otherLinks': yup.string(),
  'gender': yup.string(),
  'race': yup.string(),
  'politicalParty': yup.string(),
  'religion': yup.string(),
  'occupations': yup.string(),
  'potentialVolunteer': yup.boolean(),
  'evaluations': yup.array().of(yup.string()),
  'addresses': yup.array().of(yup.string()),
  'nominations': yup.array().of(yup.string())
})

export default {
  Person,
  Evaluation,
  Address,
}
