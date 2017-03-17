import express from 'express'
import monk from 'monk'
import cors from 'cors'
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const Evaluations = db.get('Nominee Evaluations')
const Nominations = db.get('Nominations')
const People = db.get('People')
const Tickets = db.get('Tickets')
const ContactLogs = db.get('Contact Logs')

const models = {
  'Nominee Evaluations': Evaluations,
  'Nominations': Nominations,
  'People': People,
  'Tickets': Tickets,
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
  'Tickets': 'date'
}

const querify = (params, model) => {
  const query = {}

  Object.keys(params).forEach(p => {
    if (p == 'dateRange') {
      query[dateFields[model]] = {
        $gte: new Date(params.dateRange[0]),
        $lt: addDay(new Date(params.dateRange[1]))
      }
    } else if (p == 'evaluators') {
      query.evaluatorName = {
        $in: Array.isArray(params.evaluators)
          ? params.evaluators
          : [params.evaluators]
      }
    } else {
      if (params[p])
        query[p] = params[p]
    }
  })

  return query
}

metrics.get('/metrics/query', async (req, res) => {
  try {
    const { operation, model, attributes, ...query } = req.query
    const attrs = Array.isArray(attributes)
      ? attributes
      : [attributes]

    const docs = await models[model].find(querify(query), {fields: attrs})
    if (operation == 'count') {
      return res.json(docs.length)
    }

    if (operation == 'breakdown') {
      const data = {}
      attrs.forEach(attr => {
        data[attr] = {}
        docs.forEach(d => {
          const values = Array.isArray(d[attr])
            ? d[attr]
            : [d[attr]]

          values.forEach(v => {
            if (!data[attr][v]) data[attr][v] = 0
            data[attr][v]++
          })
        })
      })

      return res.json(data)
    }
  } catch (err) {
    return res.status(500).json(err)
  }
})

metrics.get('/metrics/model-options', (req, res) => {
  console.log(`getting options for model ${req.query.model}`)
  models[req.query.model].find({}, {limit: 50})
  .then(docs => {
    const attributes = new Set()
    docs.forEach(d => {
      Object.keys(d).forEach(attr => attributes.add(attr))
    })
    attributes.delete('_id')
    attributes.delete('id')
    return res.json([...attributes].sort())
  })
  .catch(err => res.status(500).json(err))
})

metrics.get('/metrics/attribute-options', (req, res) => {
  console.log(`getting options for model ${req.query.model}'s ${req.query.attribute}`)
  const attribute = req.query.attribute

  models[req.query.model].find({}, {limit: 50, fields: [attribute]})
  .then(docs => {
    const values = new Set()
    docs.forEach(d => {
      const local = Array.isArray(d[attr])
        ? Array.isArray(d[attr])
        : [d[attr]]

      local.forEach(values.add)
    })

    res.json([...values])
  })
})

export default metrics
