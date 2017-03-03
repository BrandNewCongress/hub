import yup from 'yup'

export default yup.object().shape({
  score: yup.number().positive().integer(),
  round: yup.string().matches(/R[0-9]/),
  districtScore: yup.string(),
  moveToNextRound: yup.string(),
  nominee: yup.array().of(yup.string()),
  evaluator: yup.array().of(yup.string())
})
