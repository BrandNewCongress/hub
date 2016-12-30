import airtable from '../airtable'
import Baby from 'babyparse'
import { PhoneNumberFormat as PNF, PhoneNumberUtil } from 'google-libphonenumber'
import { toTitleCase, formatEmail, formatText, formatPhoneNumber, formatLink, formatState, formatDistrict } from './lib'
import normalizeUrl from 'normalize-url'

const phoneUtil = PhoneNumberUtil.getInstance()

const parsedData = Baby.parseFiles(process.argv[3], {
  header: true
})

function formatDistrict(district) {
  const districtParts = district.split('-')
  if (districtParts[1]) {

  }
}

for (let index = 0; index < parsedData.length; index++) {
  const row = parsedData[index]
  let runForOffice = formatText(row['Have they run for office before?'])
  if (runForOffice === 'Not sure') {
    runForOffice = 'Unknown'
  }

  const rawNomination = {
    'Date Submitted (Legacy)': new Date(row.Timestamp),
    'Nominator Name': formatText(row['Your Name']),
    'Nominator Email': formatEmail(row['Your Email']),
    'Nominator Phone': formatPhoneNumber(row['Your Phone Number']),
    Name: formatText(row['Name of Nominee']),
    Email: formatEmail(row['Nominee\'s Email (if you have it)']),
    Phone: formatPhoneNumber(row['Nominee\'s Phone Number (if you have it)']),
    City: toTitleCase(formatText(row['Nominee\'s City'])),
    State: formatText(row['Nominee\'s State']).toUpperCase(),
    'Congressional District': formatDistrict(row['Corrected CD info']),
    Facebook: formatLink(row['Nominee\'s Facebook link (if you can find it)']),
    LinkedIn: formatLink(row['Nominee\'s LinkedIn link (if you can find it)']),
    'Relationship to Nominee': formatText(row['How do you know your nominee? How did you first meet them?']),
    Leadership: formatText(row['Leadership: How has your nominee served or been a leader in his/her community? How has your nominee sought to help others and make the world a better place? (Please give us at least one specific example.)']),
    'Work History': formatText(row['Work and Career:  What is your nominee\'s occupation? In what careers/industries has your nominee previously worked? ']),
    'Public Speaking': formatText(row['Public Speaking: Do you think your nominee would do well on TV, in a candidate debate, etc...?']),
    'Political Views': formatText(row["Political Views: Do you know their politics? Do you think they would generally support Bernie's program? Do they identify with any particular political party? (If you don't know, that's ok — we'll find out!)"]),
    'Run for Office': runForOffice,
    'Office Run Results': formatText(row['If yes, what office did they run for? Did they win or lose? Was it a close race?']),
    'Other Info': formatText(row["Is there anything else you'd like to tell us about your nominee?"]),
    'District Info': formatText(row['What are the most important things we need to know about this district? Or is there anything special we need to know? (Optional)']),    
  }
}
