import Airtable from 'airtable'
import schemas from './schemas'
import toAirCase from './to-air-case'
import toCamelCase from 'to-camel-case'
import keyMap from './key-map'
import linkedTableLookup from './ltl'
import tableLookup from './tl'
import deAirtable from './de-airtable'
import airQuery from './air-query'
import cannotEdit from './cannot-edit'

const model = (name, BASE) => {
  const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
  }).base(BASE || process.env.AIRTABLE_BASE)

  if (!tableLookup[name]) {
    throw new Error(`No entry for ${name}`)
  }

  const bn = base(tableLookup[name])
  const ltl = linkedTableLookup[name]
  const schema = schemas[name]

  /*
   * Used internally in exports.update and exports.create
   * Will automatically create records in linked fields
   * and replace them with the created id if necessary
   */
  const editCore = (data, cb) => {
    const copy = Object.assign({}, data, cannotEdit)
    const promises = []

    const linkedFields = ltl
      ? Object.keys(copy).filter(field =>
          schema.fields[field] &&
          schema.fields[field]._type == 'array' &&
          schema.fields[field]._subType._type == 'string' &&
          !(['race', 'occupations', 'potentialVolunteer'].includes(field))
        )
      : []

    linkedFields.forEach(field => {
      const linkedModel = model(ltl[field])

      copy[field].forEach((member, idx) => {
        // If it's a value that needs to be posted to the db
        // and set in copy as an id
        if (typeof member == 'object') {
          promises.push(new Promise((resolve, reject) => {
            const onsuccess = (obj) => {
              copy[field][idx] = obj.id
              return resolve(true)
            }

            const onerr = (err) => {
              return reject(err)
            }

            if (member.id) linkedModel.update(member.id, member).then(onsuccess).catch(onerr)
            else linkedModel.create(member).then(onsuccess).catch(onerr)
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
    .catch(err => {
      cb(err)
    })
  }

  const findCore = method => {
      const toPopulate = []
      const sortObjects = []

      const doPopulate = (obj, fields) => new Promise((resolve, reject) => {
        const promises = []
        const toAssign = {}

        fields.forEach(attr => {
          toAssign[attr] = []

          const linkedIds = (obj[attr] || [])
          linkedIds.forEach(linkedId => {
            promises.push(new Promise((resolve, reject) => {
              base(tableLookup[ltl[attr]]).find(linkedId, (err, linkedObj) => {
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
        .then(_ => resolve(Object.assign(obj, toAssign)))
        .catch(reject)
      })

      /*
       * Exec defined here so it, `populate`, and `sortObjects`, share an enclosed
       * array
       */
      const exec = cb => {
        method(sortObjects, (err, raw) => {
          if (err) return cb(err)
          if (!raw) return cb(new Error('Not found'))

          const promise = Array.isArray(raw)
            ? Promise.all(raw.map(r => doPopulate(deAirtable(r), toPopulate)))
            : doPopulate(deAirtable(raw), toPopulate)

          promise
          .then(final => cb(null, final))
          .catch(cb)
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
        sort: fields => {
          Object.keys(fields).forEach(f => sortObjects.push({
            field: toAirCase(f),
            direction: fields[f] == 1 ? 'asc' : 'desc'
          }))
          return {exec}
        },
        exec
      })
    }

  /*
   * Set of functions returned by `model`
   * Access common `bn, ltl, and schema` through closures
   */
  return {
    findById: id => {
      return findCore((sort, fn) => bn.find(id, fn))
    },

    findOne: query => findCore((sort, fn) => bn
      .select({
        sort,
        filterByFormula: airQuery(query),
        maxRecords: 1
      })
      .firstPage((err, results) => err
        ? fn(err)
        : fn(null, results[0])
      )),

    find: query => findCore((sort, fn) => bn
      .select({
        sort,
        filterByFormula: airQuery(query),
        maxRecords: 100
      })
      .firstPage((err, results) => err
        ? fn(err)
        : fn(null, results)
      )),

    findAll: query => findCore((sort, fn) => {
      const cached = []

      bn.select({
        sort,
        filterByFormula: airQuery(query)
      }).eachPage((records, fetchNextPage) => {
        console.log(`Cached has ${cached.length}`)
        cached.push(...records)
        fetchNextPage()
      }, err => fn(err, cached))
    }),

    create: (data) => new Promise((resolve, reject) => {
      editCore(data, (err, transformed) => {
        if (err) return reject(err)
        return bn.create(transformed, (err, _) =>
          err ? reject(err) : resolve(deAirtable(_)))
      })
    }),

    update: (id, data) => new Promise((resolve, reject) => {
      editCore(data, (err, transformed) => {
        if (err) return reject(err)
        return bn.update(id, transformed, (err, _) =>
          err ? reject(err) : resolve(deAirtable(_)))
      })
    }),

    destroy: (id) => new Promise((resolve, reject) =>
      bn.destroy(id, (err, _) => err ? reject(err) : resolve(_))
    )
  }
}

export default {model}
