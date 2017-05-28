const monk = require('monk')
const db = monk(process.env.MONGODB_URI)
const request = require('superagent')

const query = {
  path: '/nominations',
  // $or: [
  //   { 'data.candidate': 'michaelhepburn' },
  //   { 'data.subscriptions': 'justicedemocrats' }
  // ]
}

db.get('API Logs').find(query).then(posts => {
  console.log(`Got ${posts.length} posts`)
  // console.log(posts.slice(-1))

  posts.slice(-20).forEach(p => {
    request
      .post('localhost:8080/nominations')
      // .post('https://api.brandnewcongress.org/nominations')
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
