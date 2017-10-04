const request = require('superagent')
const secret = process.env.CRM_SYNC_SECRET

const people = (since, page) =>
  new Promise((resolve, reject) =>
    request
      .get('https://crm-sync.gigalixirapp.com/api/people')
      .query({ page, secret, since })
      .end((err, res) => {
        if (err) reject(err)
        if (res.body.error) reject(res.body.error)

        resolve(res.body)
      })
  )

module.exports = { people }
