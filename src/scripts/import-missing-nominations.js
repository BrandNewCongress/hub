import airtable from '../airtable'
import Baby from 'babyparse'
import { toTitleCase, formatText } from '../lib'

async function parse() {
  const toImport = []
  const airtableNominations = Baby.parseFiles(`${process.argv[3]}/airtable-nominations.csv`, {
    header: true
  })

  const sheetsNominations = Baby.parseFiles(`${process.argv[3]}/nominations.csv`, {
    header: true
  })
  sheetsNominations.data.forEach((nom) => {
    const yourName = nom['Your Name'].trim()
    const nomineeName = nom['Name of Nominee'].trim()
    const leadership = nom['Leadership: How has your nominee served or been a leader in his/her community? How has your nominee sought to help others and make the world a better place? (Please give us at least one specific example.)'].trim()
    let found = false
    airtableNominations.data.forEach((airtableNom) => {
      const airtableName = airtableNom['Nominator Name'].trim()
      const airtableNomineeName = airtableNom['Name'].trim()
      const airtableLeadership = airtableNom['Leadership'].trim()
      if (yourName === '' || nomineeName === '') {
        found = true
      }
      if (yourName === airtableName && toTitleCase(nomineeName) == toTitleCase(airtableNomineeName) && leadership === airtableLeadership) {
        found = true
      }
      if (nom['TImestamp'] === 'left intentionally blank. old responses from previous form on top. new form on bottom.') {
        found = true
      }
      if (new Date(nom['TImestamp']) < new Date('1/1/2017 15:28:15')) {
        found = true
      }
    })
    if (!found) {
      toImport.push(nom)
    }
  })
  const arr = toImport.map((nom) => nom['TImestamp'])
  for (let index = 0; index < arr.length; index++) {
    const row = toImport[index]
    let runForOffice = formatText(row['Have they run for office before?'])
    const nominatorName = row['Your Name']
    let sourceTeam = 'No Team'
    if (nominatorName === 'Isra Allison' || nominatorName === 'Alexandra Rojas') {
      sourceTeam = 'BNC Staff'
    }
    if (runForOffice === 'Not sure') {
      runForOffice = 'Unknown'
    }

    let district = row['Corrected CD info']
    const state = district.split('-')[0]
    district = district.split('-')[1]
    const rawNomination = {
      'Date Submitted (Legacy)': new Date(row.TImestamp),
      'Nominator Name': row['Your Name'],
      'Nominator Email': row['Your Email'],
      'Nominator Phone': row['Your Phone Number'],
      Name: row['Name of Nominee'],
      Email: row['Nominee\'s Email (if you have it)'],
      Phone: row['Nominee\'s Phone Number (if you have it)'],
      City: row['Nominee\'s City'],
      'State Abbreviation': state,
      'Congressional District Code': district,
      Facebook: row['Nominee\'s Facebook link (if you can find it)'],
      LinkedIn: row['Nominee\'s LinkedIn link (if you can find it)'],
      'Relationship to Nominator': row['How do you know your nominee? How did you first meet them?'],
      Leadership: row['Leadership: How has your nominee served or been a leader in his/her community? How has your nominee sought to help others and make the world a better place? (Please give us at least one specific example.)'],
      'Work History': row['Work and Career:  What is your nominee\'s occupation? In what careers/industries has your nominee previously worked? '],
      'Public Speaking': row['Public Speaking: Do you think your nominee would do well on TV, in a candidate debate, etc...?'],
      'Political Views': row["Political Views: Do you know their politics? Do you think they would generally support Bernie's program? Do they identify with any particular political party? (If you don't know, that's ok — we'll find out!) "],
      'Run for Office': runForOffice,
      'Office Run Results': row['If yes, what office did they run for? Did they win or lose? Was it a close race?'],
      'Other Info': row["Is there anything else you'd like to tell us about your nominee?"],
      'District Info': row['What are the most important things we need to know about this district? Or is there anything special we need to know? (Optional)'],
      Source: 'BNC Website',
      'Source Team Name': sourceTeam
    }
    console.log(`Processing ${rawNomination.Name}...`)
    await airtable.createNomination(rawNomination)
  }
}

parse()
