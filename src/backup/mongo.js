import monk from 'monk'
import collections from './collections'
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const e = {}

collections.forEach(obj => {
  const c = Object.keys(obj)[0]
  e[c] = db.get(c)
})

const metadata = db.get('metadata')
const setMetadata = (collection, lastDate) => metadata.update({collection}, {lastDate}, {upsert: true})
const getMetadata = (collection) => metadata.findOne({collection})

export {setMetadata, getMetadata}
export default e
