import express from 'express'
import airgoose from '../airgoose'
import cors from 'cors'

const Person = airgoose.model('Person')

const evaluator = express()

evaluator.use(cors())

evaluator.get('/person/byname', (req, res) => {
  Person
  .findOne({name: req.query.name})
  .exec((err, person) => {
    if (err) return res.status(404).json(err)
    return res.json(person)
  })
})

evaluator.get('/person/:id', (req, res) => {
  Person
  .findById(req.params.id)
  .populate('evaluations nominations district')
  .exec((err, person) => {
    if (err) return res.status(404).json(err)
    return res.json(person)
  })
})

evaluator.get('/assignments/todo', (req, res) => {
  Person
  .find({
    assignment: req.query.name,
    formula: 'COUNT(EVALUATIONS) = 0'
  })
  .sort({dateCreated: -1})
  .exec((err, people) => {
    if (err) return res.status(404).json(err)
    return res.json(people)
  })
})

evaluator.get('/assignments/done', (req, res) => {
  Person
  .find({
    assignment: req.query.name,
    formula: 'COUNT(EVALUATIONS) > 0'
  })
  .sort({lastEvaluated: 1})
  .exec((err, people) => {
    if (err) return res.status(404).json(err)
    return res.json(people)
  })
})

evaluator.put('/person/:id', (req, res) => {
  Person
  .update(req.params.id, req.body)
  .then(_ => {
    Person
    .findById(req.params.id)
    .populate('evaluations nominations district')
    .exec((err, person) => {
      if (err) return res.status(404).json(err)
      return res.json(person)
    })
  })
  .catch(err => res.status(400).json(err))
})

export default [evaluator]
