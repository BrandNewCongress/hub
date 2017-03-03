import yup from 'yup'

export default yup.object().shape({
  city: yup.string(),
  state: yup.array().of(yup.string()),
  zip: yup.string()
})
