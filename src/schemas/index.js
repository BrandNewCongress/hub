import yup from 'yup'

const Evaluation = yup.object().shape({
  Score: yup.number().required().positive().integer(),
  Round: yup.string().matches(/R[0-9]/),
  'Move To Next Round': yup.string(),
  Nominee: yup.array().of(yup.string())
})

export default {'Nominee Evaluations': Evaluation}
