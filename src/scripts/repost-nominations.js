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

  posts.slice(posts.length - 1).forEach(p => {
    request
      .post('https://api.brandnewcongress.org/people')
      .query({ dontLog: true })
      .send(p.data)
      .end((err, res) => {
        if (!err)
          console.log(`Success for ${JSON.stringify(p)}`)
        else
          console.error(err)
      })
  })
})
