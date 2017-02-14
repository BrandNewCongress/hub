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

export default {
  'Nominee Evaluations': Evaluation,
  'Addresses': Address
}
