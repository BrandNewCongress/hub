import monk from 'monk'
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

export default (req, res, next) => {
  const data = {
    method: req.method,
    path: req.path,
    data: req.body
  }

  next()

  db.get('API Logs').insert(data)
  .then(ok => {
    console.log(`Successfully logged ${req.path}`)
  })
  .catch(err => {
    console.log(`Found error ${err}`)
    console.log(err)
  })
}
