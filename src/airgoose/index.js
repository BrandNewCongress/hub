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

  /*
   * Used internally in exports.update and exports.create
   * Will automatically create records in linked fields
   * and replace them with the created id if necessary
   */
  const editCore = (data, cb) => {
    const copy = Object.assign({}, data)
    const promises = []

    const linkedFields = Object.keys(copy).filter(field =>
      schema.fields[field] &&
      schema.fields[field]._type == 'array' &&
      schema.fields[field]._subType._type == 'string'
    )

    linkedFields.forEach(field => {
      const linkedModel = model(ltl[field])

      copy[field].forEach((member, idx) => {
        // If it's a value that needs to be posted to the db
        // and set in copy as an id
        if (typeof member == 'object') {
          promises.push(new Promise((resolve, reject) => {
            const resolver = (err, obj) => {
              if (err) return reject(err)
              copy[field][idx] = obj.id
              return resolve(true)
            }

            if (member.id) linkedModel.update(member.id, member, resolver)
            else linkedModel.create(member, resolver)
          }))
        }
      })
    })

    Promise.all(promises)
    .then(_ => {
      // now all linked fields should be ids
      const transformed = keyMap(schema.cast(copy), toAirCase)
      cb(null, transformed)
    })
    .catch(cb)
  }

  /*
   * Set of functions returned by `model`
   * Access common `bn, ltl, and schema` through closures
   */
  return {
    findById: id => {
      const toPopulate = []

      /*
       * Exec defined here so it and `populate` share an enclosed
       * array
       */
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

      /*
       * A query returns the ability to call to populate some fields
       * and to immediately execute the query
       */
      return ({
        // populate returns exec for chaining
        populate: fields => {
          fields.split(' ').forEach(f => toPopulate.push(f))
          return {exec}
        },
        exec
      })
    },

    create: (data) => new Promise((resolve, reject) => {
      editCore(data, (err, transformed) => {
        if (err) return cb(err)
        return bn.create(transformed, (err, _) =>
          err ? reject(err) : resolve(_))
      })
    }),

    update: (id, data) => new Promise((resolve, reject) => {
      editCore(data, (err, transformed) => {
        if (err) return cb(err)
        return bn.update(id, transformed, (err, _) =>
          err ? reject(err) : resolve(_))
      })
    })
  }
}

export default {model}
