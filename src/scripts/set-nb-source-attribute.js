const nb = require('../nationbuilder')
const axios = require('axios')

const waitASec = () => new Promise((resolve, reject) => setTimeout(() => resolve(true), 10000))

const limit = 10

const go = async () => {
  let response = await nb.makeRequest('GET', 'people')
  let { results, next } = response.data

  results.forEach((p) => console.log(p.source))
  let shouldSet = results.filter(r => !r.source)
  console.log(`Setting ${shouldSet.length} source to BNC`)
  await Promise.all(shouldSet.map(r => nb.makeRequest('PUT', `people/${r.id}`, {
    person: {source: 'Brand New Congress'}
  })))
  console.log('Done')

  while (next) {
    try {
      console.log(`https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com${next}&access_token=${process.env.NATIONBUILDER_TOKEN}$limit=${limit}`)

      response = await axios({
        method: 'GET',
        url: `https://${process.env.NATIONBUILDER_SLUG}.nationbuilder.com${next}&access_token=${process.env.NATIONBUILDER_TOKEN}&limit=${limit}`,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
      })

      results = response.data.results
      next = response.data.next

      let requestMade = false

      results.forEach(p => {
        console.log(p.source)
        if (!p.source)
          requestMade = true
      })

      console.log(results[0].id)

      let shouldSet = results.filter(r => !r.source)
      console.log(`Setting ${shouldSet.length} source to BNC`)
      await Promise.all(shouldSet.map(r => nb.makeRequest('PUT', `people/${r.id}`, {
        person: {source: 'Brand New Congress'}
      })))
      console.log('Done')

      // if (requestMade) {
      //   await waitASec()
      // }

    } catch (err) {
      // next = false
      console.log(err)
    }
  }
}

go()
