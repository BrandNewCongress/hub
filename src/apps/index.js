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

evaluator.post('/person/:id', (req, res) => {
  Person
  .update(req.params.id, req.body)
  .then(res.json)
  .catch(res.status(400).json)
})

export default [evaluator]
