const fs = require('fs')
const monk = require('monk')
const toAirCase = require('../airgoose/to-air-case')
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const Evaluations = db.get('Nominee Evaluations')
const People = db.get('People')

const evaluators = {}
const promises = []

const fields = [
  'name', 'profile', 'facebook', 'linkedIn', 'twitter', 'otherLinks',
  'assignment', 'gender', 'politicalParty', 'religion'
]

const niceOutput = data => `
Evaluations Completed: ${data.length}

${data.map(evaluated => `
-------------------------- ${evaluated.name} -----------------------------
${fields
  .map(f => evaluated[f] ? `${toAirCase(f)}: ${evaluated[f]}` : undefined)
  .filter(f => f)
  .join('\n')}

-------- Evaluation ------
${evaluated.evaluations.map(e => `
${['score', 'districtScore', 'round', 'moveToNextRound'].map(f => `${toAirCase(f)}: ${e[f]}`).join('\n')}`).join('\n')}`).join('\n')}`

const sources = {}

const query = {
  $or: [
    '2017-02-26', '2017-02-27', '2017-02-28', '2017-03-01', '2017-03-02', '2017-03-03'
  ].map(evaluationDate => ({ evaluationDate }))
}

let numBad = 0
People
.find(query)
.then(people => {
  people.forEach(p => {
    if (!p.evaluatorsPlainText) {
      numBad++
      return console.log(`No evaluator name for ${JSON.stringify(p)}`)
    }
    //
    // const personsSources = [...new Set(p.source)]
    // const round = p.nominationStatus
    //
    // personsSources.forEach(source => {
    //   if (!sources[source]) sources[source] = {}
    //   if (!sources[source][round]) sources[source][round] = 0
    //   sources[source][round]++
    // })

    promises.push(new Promise((resolve, reject) =>
      Evaluations
      .find({ id: { $in: p.evaluations } })
      .then(evaluations => {
        const individuals = p.evaluatorsPlainText.split(',').map(s => s.trim().toLowerCase().replace(/ /g, '-'))
        individuals.forEach(i => {
          if (!evaluators[i])
            evaluators[i] = []

          evaluators[i].push(Object.assign(p, { evaluations }))
        })

        resolve(null)
      })
      .catch(reject)
    ))
  })
  console.log(JSON.stringify(sources, null, 2))

  Promise.all(promises)
  .then(_ => {
    for (let person in evaluators) {
      console.log(`Writing ./${person}.json`)
      fs.writeFileSync(`./${person}.txt`, niceOutput(evaluators[person]))
    }
  })
  .catch(err => {
    console.log('Error')
    console.log(err)
    process.exit()
  })
})
