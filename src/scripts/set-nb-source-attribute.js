const nb = require('../nationbuilder')
const axios = require('axios')

const waitASec = () => new Promise((resolve, reject) => setTimeout(() => resolve(true), 10000))

const limit = 100

const go = async () => {
  let response = await nb.makeRequest('GET', 'people')
  let { results, next } = response.data

  results.forEach((p) => console.log(p.source))
  console.log('Setting all source to BNC')
  await Promise.all(results.filter(r => !r.source).map(r => nb.makeRequest('PUT', `people/${r.id}`, {
    person: {source: 'BNC'}
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

      console.log('Setting all source to BNC')
      await Promise.all(results.filter(r => !r.source).map(r => nb.makeRequest('PUT', `people/${r.id}`, {
        person: {source: 'BNC'}
      })))
      console.log('Done')

      if (requestMade) {
        await waitASec()
      }

    } catch (err) {
      // next = false
      console.log(err)
    }
  }
}

go()
