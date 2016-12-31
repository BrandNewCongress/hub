import airtable from '../airtable'
import Baby from 'babyparse'
import { toTitleCase, formatEmail, formatText, formatPhoneNumber, formatLink, formatState, formatDistrict, isEmpty } from '../lib'
import log from '../log'

async function parse() {
  const parsedData = Baby.parseFiles(process.argv[3], {
    header: true
  })

  for (let index = 0; index < parsedData.data.length; index++) {
    const row = parsedData.data[index]

    let runForOffice = formatText(row['Have they run for office before?'])
    if (runForOffice === 'Not sure') {
      runForOffice = 'Unknown'
    }

    let sourceTeam = row['Nomination Source']
    if (sourceTeam === 'External') {
      sourceTeam = 'No Team'
    } else if (sourceTeam === 'Call Team Contact') {
      sourceTeam = 'Call Team'
    } else if (sourceTeam === 'BNC WG') {
      sourceTeam = 'BNC Staff'
    }
    let district = row['Corrected CD info']
    const state = district.split('-')[0]
    district = district.split('-')[1]
    const rawNomination = {
      'Date Submitted (Legacy)': new Date(row.Timestamp),
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
      'Political Views': row["Political Views: Do you know their politics? Do you think they would generally support Bernie's program? Do they identify with any particular political party? (If you don't know, that's ok — we'll find out!)"],
      'Run for Office': runForOffice,
      'Office Run Results': row['If yes, what office did they run for? Did they win or lose? Was it a close race?'],
      'Other Info': row["Is there anything else you'd like to tell us about your nominee?"],
      'District Info': row['What are the most important things we need to know about this district? Or is there anything special we need to know? (Optional)'],
      Source: 'BNC Website',
      'Source Team Name': sourceTeam
    }

    await airtable.createNomination(rawNomination)
    if (index === 10) {
      break
    }
  }
}

parse()
