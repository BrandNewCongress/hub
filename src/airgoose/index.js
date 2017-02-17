import Airtable from 'airtable'
import schemas from './schemas'
import toAirCase from './to-air-case'
import toCamelCase from 'to-camel-case'
import keyMap from './key-map'
import linkedTableLookup from './ltl'
import tableLookup from './tl'
import deAirtable from './de-airtable'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE)

const model = name => {
  const bn = base(tableLookup[name])
  const ltl = linkedTableLookup[name]
  const schema = schemas[name]

  const exports = {
    findById: id => {
      const toPopulate = []

      const exec = cb => {
        bn.find(id, (err, raw) => {
          if (err) return cb(err)
          if (!raw) return cb(new Error('Not found'))

          const result = deAirtable(raw)

          if (toPopulate.length == 0) return cb(result)

          const promises = []
          const toAssign = {}

          toPopulate.forEach(attr => {
            toAssign[attr] = []

            const linkedIds = (result[attr] || [])
            linkedIds.forEach(linkedId => {
              promises.push(new Promise((resolve, reject) => {
                base(ltl[attr]).find(linkedId, (err, linkedObj) => {
                  if (err) return reject(err)

                  if (linkedObj) {
                    const o = deAirtable(linkedObj)
                    toAssign[attr].push(o)
                  }

                  resolve(true)
                })
              }))
            })

          })

          Promise.all(promises)
          .then(_ => cb(null, Object.assign(result, toAssign)))
          .catch(err => cb(err))
        })
      }

      return ({
        populate: fields => {
          fields.split(' ').forEach(f => toPopulate.push(f))
          return {exec}
        },
        exec
      })
    },

    create: (data, cb) => {
      const transformed = keyMap(schema.cast(data), toAirCase)
      bn.create(transformed, cb)
    },

    update: (id, data, cb) => {
      const transformed = keyMap(schema.cast(data), toAirCase)
      bn.update(id, transformed, cb)
    }
  }

  return exports
}

export default {model}
