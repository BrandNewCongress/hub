const monk = require('monk')
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

module.exports = (req, res, next) => {
  const data = {
    method: req.method,
    path: req.path,
    data: req.body,
    headers: req.headers
  }

  next()

  if (!req.query.dontLog) {
    db.get('API Logs').insert(data)
    .then(ok => {
      log.info(`Successfully logged ${req.path}`)
    })
    .catch(err => {
      console.log(`Found error ${err}`)
      console.log(err)
    })
  } else {
    console.log(`Not logging ${req.path}`)
  }
}
