const express = require('express')
const monk = require('monk')
const cors = require('cors')
const ltl = require('../airgoose/ltl')
const tl = require('../airgoose/tl')

const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')
const Evaluations = db.get('Nominee Evaluations')
const Nominations = db.get('Nominations')
const People = db.get('People')
const Tickets = db.get('Tickets')
const ContactLogs = db.get('Contact Logs')

const models = {
  'Nominee Evaluations': Evaluations,
  Nominations,
  People,
  Tickets,
  'Contact Logs': ContactLogs
}

const metrics = express()
metrics.use(cors())

const addDay = date => {
  date.setDate(date.getDate() + 1)
  return date
}

const dateFields = {
  'Nominee Evaluations': 'evaluationDate',
  'People': 'dateCreated',
  'Nominations': 'dateSubmitted',
  'Tickets': 'date',
  'Contact Logs': 'dateContacted'
}

const querify = (params, model) => {
  const query = {}

  Object.keys(params).forEach(p => {
    if (p == 'dateRange') {
      query[dateFields[model]] = {
        $gte: new Date(params.dateRange[0]),
        $lt: addDay(new Date(params.dateRange[1]))
      }
    } else {
      if (params[p])
        query[p] = { $in: Array.isArray(params[p])
          ? params[p]
          : [params[p]]
        }
    }
  })

  return query
}

metrics.get('/metrics/query', async (req, res) => {
  try {
    const {
      operation, model, attribute, secondaryAttribute
    } = req.query

    const query = {}
    for (let key of req.query) {
      if (!['operation', 'model', 'attribute', 'secondaryAttribute'].includes(key))
        query[key] = req.query[key]
    }

    let docs

    const firstDocs = await models[model].find(querify(query, model), { fields: ['id', attribute] })
    if (operation == 'count') {
      return res.json(firstDocs.length)
    }

    const attr = secondaryAttribute || attribute

    if (secondaryAttribute) {
      const sing = Object.keys(tl).filter(s => tl[s] == req.query.model)[0]
      const secondaryModel = ltl[sing][attribute]
      const secondaryModelField = Object.entries(ltl[secondaryModel])
        .filter(([k, v]) => v == sing).map(([a, b]) => a)

      const secondDocs = await models[tl[secondaryModel]].find({
        [secondaryModelField]: { $in: firstDocs.map(d => d.id) }
      })

      docs = secondDocs
    }

    if (!docs) docs = firstDocs

    const data = { [attr]: {} }
    docs.forEach(d => {
      const values = Array.isArray(d[attr])
        ? d[attr]
        : [d[attr]]

      values.forEach(v => {
        if (!data[attr][v]) data[attr][v] = 0
        data[attr][v]++
      })
    })

    return res.json(data)
  } catch (err) {
    console.log('error')
    console.log(err)
    return res.status(500).json(err)
  }
})

metrics.get('/metrics/model-options', (req, res) => {
  const singular = Object.keys(tl).filter(sing => tl[sing] == req.query.model)[0]

  models[req.query.model].find({}, { limit: 50 })
  .then(docs => {
    const attributes = new Set()
    docs.forEach(d => {
      Object.keys(d).forEach(attr => attributes.add(attr))
    })

    attributes.delete('_id')
    attributes.delete('id')

    const linkedModels = Object.keys(ltl[singular])

    return res.json({
      attributeOptions: [...attributes].sort().filter(a => !linkedModels.includes(a)),
      linkedModelOptions: linkedModels.map(m => [m, tl[ltl[singular][m]]])
    })
  })
  .catch(err => {
    console.error(err)
    res.status(500).json(err)
  })
})

metrics.get('/metrics/attribute-options', (req, res) => {
  const attribute = req.query.attribute

  models[req.query.model].find({}, { limit: 50, fields: [attribute] })
  .then(docs => {
    const values = new Set()
    docs.forEach(d => {
      const local = Array.isArray(d[attribute])
        ? d[attribute]
        : [d[attribute]]

      local.forEach(a => values.add(a))
    })

    res.json([...values].filter(v => v))
  })
})

module.exports = metrics
