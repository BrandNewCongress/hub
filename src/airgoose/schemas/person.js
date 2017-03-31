const yup = require('yup')

module.exports = yup.object().shape({
  /* SIMPLE FIELDS */
  name: yup.string(),
  photos: yup.array().of(yup.object()),

  facebook: yup.string().url(),
  linkedIn: yup.string().url(),
  twitter: yup.string().url(),
  profile: yup.string(),
  otherLinks: yup.string(),
  assignment: yup.string(),
  /* ENUMS */
  gender: yup.string(),
  politicalParty: yup.string(),
  religion: yup.string(),
  /* MULTI-SELECT ENUMS */
  potentialVolunteer: yup.array().of(yup.string()),
  race: yup.array().of(yup.string()),
  occupations: yup.array().of(yup.string()),
  /* LINKED FIELDS */
  emails: yup.array().of(yup.string()),
  evaluations: yup.array().of(yup.string()),
  nominations: yup.array().of(yup.string()),
  addresses: yup.array().of(yup.string()),
  emailAddresses: yup.array().of(yup.string().transform((value) => value.replace(/\s/g, '')).email()),
  phoneNumbers: yup.array().of(yup.string())
})
