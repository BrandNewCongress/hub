const monk = require('monk')
const db = monk(process.env.MONGODB_URI)
const client = require('nation-pool/client')
client.forceStandalone()
const fs = require('fs')
const jds = fs.createWriteStream('jd.txt', {
  flags: 'a'
})

const Logs = db.get('API Logs')

// const candidateSources = [
//   'Cori Bush',
//   'Paula Jean Swearengin',
//   'Sarah Smith',
//   'Letitia Plummer',
//   'Anthony Clark',
//   'Richard Rice',
//   'Demond Drummer',
//   'Robb Ryerse',
//   'Michael Hepburn',
//   'Chardo Richardon',
//   'Danny Ellyson',
//   'Eric Terrell',
//   'Adrienne Bell',
//   'Alexandria Ocasio-Cortez',
//   'Hector Morales',
//   'Ryan Stone'
// ]
//
// const fnToPotentiallyJD = async fn => {
//   let matches = []
//   let response = await client.get(`/lists/1673/people`, {
//     query: { limit: 100 }
//   })
//
//   let { next, results } = response
//
//   for (let person of results) {
//     await fn(person)
//   }
//
//   while (next) {
//     console.log(`Next`)
//     response = await client.get(next)
//     next = response.next
//     results = response.results
//     results.forEach(fn)
//
//     for (let person of results) {
//       await fn(person)
//     }
//
//   }
//
//   return true
// }
//
// let shouldBeJd = 0
//
// fnToPotentiallyJD(async person => {
//   const log = await Logs.findOne({ 'data.phone': person.phone })
//   if (log) {
//     const timestamp = new Date( parseInt( log._id.toString().substring(0,8), 16 ) * 1000 )
//     console.log(timestamp)
//     console.log(`${person.phone} is true bnc`)
//     return person
//   } else {
//     console.log(`${person.phone} should be JD`)
//     // await client.put(`people/${person.id}/taggings`, {
//     //   taggings: 'Source: Justice Democrats'
//     // })
//     shouldBeJd++
//     console.log(shouldBeJd)
//     jds.write(`${person.id}, ${person.email}, ${person.phone}\n`)
//     return person
//   }
// }).then(() => jds.end())

Logs.find({ 'data.subscriptions': 'justicedemocrats' }, {skip: 384}).then(async logs => {
  const toRemoveFromJD = logs.filter(l => {
    const d = new Date(parseInt(l._id.toString().substring(0, 8), 16) * 1000)
    return new Date('May 11, 2017 ') < d && new Date('May 31, 2017') > d
  })

  let here = 0
  for (let p of toRemoveFromJD) {
    let nb = await client.put('people/push', {
      body: {
        person: {
          email: p.data.email,
          phone: p.data.phone
        }
      }
    })

    let response = await client.delete(`people/${nb.person.id}/taggings`, {
      body: {
        tagging: {
          tag: 'Source: Justice Democrats'
        }
      }
    })

    console.log(response)
    here++
    console.log(here)
  }
})
