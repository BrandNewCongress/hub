const monk = require('monk')
const db = monk(process.env.MONGODB_URI)
const request = require('superagent')

const query = {
  path: '/people',
  $or: [
    { 'data.candidate': 'michaelhepburn' },
    { 'data.subscriptions': 'justicedemocrats' }
  ]
}

db.get('API Logs').find(query).then(posts => {
  console.log(`Got ${posts.length} posts`)
  console.log(posts.slice(posts.length - 1))
  process.exit()

  posts.slice(posts.length - 1).forEach(p => {
    request
      .post('https://api.brandnewcongress.org/nominations')
      .query({ dontLog: true })
      .send(p.data)
      .end((err, res) => {
        console.log(`Success for ${JSON.stringify(p)}`)
      })
  })
})
