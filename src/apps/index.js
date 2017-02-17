import express from 'express'
import airgoose from '../airgoose'

const Person = airgoose.model('Person')

const evaluator = express()
evaluator.get('/person/:id', (req, res) => {
  Person
  .findById(req.params.id)
  .populate('evaluations nominations')
  .exec((err, person) => {
    if (err) return res.status(404).json(err)
    return res.json(person)
  })
})

export default [evaluator]
