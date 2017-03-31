const yup = require('yup')

module.exports = yup.object().shape({
  city: yup.string(),
  state: yup.array().of(yup.string()),
  zip: yup.string()
})
