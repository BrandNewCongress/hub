import airtable from '../airtable'
import Baby from 'babyparse'
import { toTitleCase, formatText } from '../lib'

async function parse() {
  let toImport = []
  const airtableEvaluations = Baby.parseFiles(`${process.argv[3]}/airtable-evaluations.csv`, {
    header: true
  })

  const round1Nominations = Baby.parseFiles(`${process.argv[3]}/round1.csv`, {
    header: true
  })
  const round2Nominations = Baby.parseFiles(`${process.argv[3]}/round2.csv`, {
    header: true
  })

  round1Nominations.data.forEach((nom) => {
    const moveOn = nom["Move on to ROUND 2?\n(Y/N)"].trim()
    if (moveOn !== '') {
      const name = nom['Name of Nominee'].toLowerCase()
      let index = 0
      for (index = 0; index < airtableEvaluations.data.length; index++) {
        const airtableRow = airtableEvaluations.data[index]
        if (airtableRow['Nominee Name'].toLowerCase() === name) {
          const moveToNextRound = moveOn.toLowerCase() === 'y' ? 'Yes' : 'No'
          if (airtableRow['Move To Next Round'] === moveToNextRound && airtableRow['Round'] === 'R1') {
            break
          }
        }
      }
      if (index === airtableEvaluations.length) {
        toImport.push(nom)
      }
    }
  })

  console.log('Round 1 to import: ', toImport.length)
  toImport = []
  round2Nominations.data.forEach((nom) => {
    const moveOn = nom["Move on to ROUND 3?"].trim()
    if (moveOn !== '') {
      const name = nom['Nominee Name'].toLowerCase()
      let index = 0
      for (index = 0; index < airtableEvaluations.data.length; index++) {
        const airtableRow = airtableEvaluations.data[index]
        if (airtableRow['Nominee Name'].toLowerCase() === name) {
          const moveToNextRound = moveOn.toLowerCase() === 'y' ? 'Yes' : 'No'
          if (airtableRow['Move To Next Round'] === moveToNextRound && airtableRow['Round'] === 'R2') {
            console.log(name, airtableRow['Move To Next Round'], moveToNextRound)
            break
          }
        }
      }
      if (index === airtableEvaluations.length) {
        toImport.push(nom)
      }
    }
  })
  console.log('Round 2 to import', toImport.length)
}

parse().catch((ex) => console.log(ex))
