const airtable = require('../airtable')
const Baby = require('babyparse')
const { toTitleCase, formatText } = require('../lib')
const moment = require('moment')

async function parse() {
  const toImport = []
  const airtableNominations = Baby.parseFiles(`${process.argv[3]}/airtable-nominations.csv`, {
    header: true
  })

  const sheetsNominations = Baby.parseFiles(`${process.argv[3]}/nominations.csv`, {
    header: true
  })
  for (let sheetsIndex = 0; sheetsIndex < sheetsNominations.data.length; sheetsIndex++) {
    const nom = sheetsNominations.data[sheetsIndex]
    const timestamp = moment(nom['Timestamp'], 'M/D/YYYY H:mm')
    const nominee = nom['Name of Nominee'].toLowerCase()
    const nominator = nom['Your Name'].toLowerCase()

    let skip = false
    let found = false
    let index = 0
    for (index = 0; index < airtableNominations.data.length; index++) {
      const airtableNom = airtableNominations.data[index]
      const ID = airtableNom[Object.keys(airtableNom)[0]]
      let airtableTimestamp = airtableNom['Date Submitted (Legacy)']
      airtableTimestamp = moment(airtableTimestamp, 'M/D/YYYY h:mma')
      const airtableNominee = airtableNom['Name'].toLowerCase()
      const airtableNominator = airtableNom['Nominator Name'].toLowerCase()
      if (airtableTimestamp.isSame(timestamp) && airtableNominee === nominee && airtableNominator === nominator) {
        console.log('ID: ', ID)
        const noms = await airtable.findAll('Nominations', {
          filterByFormula: `ID="${airtable.escapeString(ID)}"`
        })
        if (noms.length === 0) {
          console.log('No records found for', ID, airtableNom['Date Submitted (Legacy)'])
        }
        if (noms.length > 1) {
          console.log('Multiple records for', ID, airtableNom['Date Submitted (Legacy)'])
        }
        const identifier = noms[0].id
        const ts = airtableTimestamp.toDate()
        const polViews = nom["Political Views: Do you know their politics? Do you think they would generally support Bernie's program? Do they identify with any particular political party? (If you don't know, that's ok — we'll find out!) "]
        await airtable.update('Nominations', identifier, {
          'Political Views': polViews,
          'Date Submitted (Legacy)': ts
        })
        break
      }
    }
    if (index === airtableNominations.data.length) {
      toImport.push(nom)
    }
  }

  console.log(toImport)
}

parse().catch((ex) => console.log(ex))
