import airtable from '../airtable'
import Baby from 'babyparse'
import { formatText, isEmpty } from '../lib'
import fs from 'fs'
import log from '../log'

const evaluators = {
  alex: {
    email: 'alex@brandnewcongress.org',
    name: 'Alexandra Rojas',
    facebook: 'http://facebook.com/alex.rojas.526',
    city: 'Fullerton'
  },
  corbin: {
    email: 'corbin@brandnewcongress.org',
    name: 'Corbin Trent',
    facebook: 'http://facebook.com/corbintrent',
    city: 'Morristown'
  },
  issy: {
    email: 'isra@brandnewcongress.org',
    name: 'Isra Allison',
    facebook: 'http://facebook.com/profile.php?id=100007761944903',
    city: 'Charlotte'
  },
  haley: {
    email: 'haley@brandnewcongress.org',
    name: 'Haley Zink',
    facebook: 'http://facebook.com/haley.zink.9',
    city: 'St. Charles'
  },
  liam: {
    email: 'liam@brandnewcongress.org',
    name: 'Liam Clive',
    facebook: 'http://facebook.com/liam.declivelowe'
  },
  nasim: {
    email: 'nasim@brandnewcongress.org',
    name: 'Nasim Thompson',
    facebook: 'http://facebook.com/nasimthompson'
  },
  mary: {
    email: 'mary@brandnewcongress.org',
    name: 'Mary Nishimuta',
    facebook: 'http://facebook.com/mary.nishimuta'
  },
  judie: {
    email: 'judieschumacher@gmail.com',
    name: 'Judie Schumacher',
    facebook: 'http://facebook.com/judie.schumacher'
  },
  zack: {
    email: 'zack@brandnewcongress.org',
    name: 'Zack Exley',
    facebook: 'http://facebook.com/zack.exley'
  },
  'alex/nasim': {
    email: 'alex@brandnewcongress.org'
  },
  'corbin trent': {
    email: 'corbin@brandnewcongress.org'
  },
  haly: {
    email: 'haley@brandnewcongress.org'
  },
  isay: {
    email: 'isra@brandnewcongress.org'
  }
}
async function findEvaluator(name) {
  const formattedName = formatText(name)
  if (formattedName) {
    const evaluatorObj = evaluators[formattedName.toLowerCase()]
    let evaluatorId = evaluatorObj.evaluatorId
    if (!evaluatorId) {
      evaluatorId = await airtable.matchPerson({
        emails: [evaluatorObj.email]
      })
      evaluatorObj.evaluatorId = evaluatorId
    }

    if (!evaluatorId) {
      const evaluator = await airtable.createOrUpdatePerson(null, {
        emails: [evaluatorObj.email],
        name: evaluatorObj.name,
        facebook: evaluatorObj.facebook
      })
      evaluatorObj.evaluatorId = evaluatorId
      return evaluator.id
    }
    return evaluatorId
  }
  return null
}

function formatMoveOn(moveOn) {
  let formattedMoveOn = formatText(moveOn)
  if (moveOn === 'Y') {
    formattedMoveOn = 'Yes'
  } else if (formattedMoveOn === 'N') {
    formattedMoveOn = 'No'
  } else {
    formattedMoveOn = null
  }
  return formattedMoveOn
}

function formatScore(score) {
  let formattedScore = parseInt(formatText(score), 10)
  if (isNaN(formattedScore)) {
    return null
  }
  if (formattedScore > 4) {
    formattedScore = 4
  }
  return formattedScore
}

async function parse() {
  async function createLog(contacterId, person, notes) {
    const formattedNotes = formatText(notes)
    if (!formattedNotes) {
      return
    }
    const log = await airtable.create('Contact Logs', {
      Contacter: [contacterId],
      Person: [person.id]
    })

    const phoneNumbers = person.get('Phone Numbers')
    await airtable.create('Call Logs', {
      'Contact Log': [log.id],
      'Phone Number': !isEmpty(phoneNumbers) ? [phoneNumbers[0]] : null,
      Direction: null,
      Result: null,
      Notes: notes
    })
  }
  const parsedData = Baby.parseFiles(`${process.argv[3]}/round1.csv`, {
    header: true
  })

  const round2DataRaw = Baby.parseFiles(`${process.argv[3]}/round2.csv`, {
    header: true
  })

  const round2Data = {}

  round2DataRaw.data.forEach((datum) => {
    const name = datum['Nominee Name'].toLowerCase()
    if (round2Data.hasOwnProperty(name)) {
      log.warn(`Duplicate name ${name}`)
    } else {
      round2Data[name] = datum
    }
  })

  const round3DataRaw = Baby.parseFiles(`${process.argv[3]}/round3.csv`, {
    header: true
  })

  const round3Data = {}

  round3DataRaw.data.forEach((datum) => {
    const name = datum['Nominee Name'].toLowerCase()
    if (round3Data.hasOwnProperty(name)) {
      log.warn(`Duplicate name ${name}`)
    } else {
      round3Data[name] = datum
    }
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
    } else if (sourceTeam === 'Research Team') {
      sourceTeam = 'Candidate Research Team'
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
      'Political Views': row["Political Views: Do you know their politics? Do you think they would generally support Bernie's program? Do they identify with any particular political party? (If you don't know, that's ok — we'll find out!)"],
      'Run for Office': runForOffice,
      'Office Run Results': row['If yes, what office did they run for? Did they win or lose? Was it a close race?'],
      'Other Info': row["Is there anything else you'd like to tell us about your nominee?"],
      'District Info': row['What are the most important things we need to know about this district? Or is there anything special we need to know? (Optional)'],
      Source: 'BNC Website',
      'Source Team Name': sourceTeam
    }
    if (isEmpty(rawNomination.Name)) {
      continue
    }
    console.log(`Processing ${rawNomination.Name}...`)

    const nomination = await airtable.createNomination(rawNomination)
    const profile = formatText(row['Round 1 \nEVALUATION NOTES'])
    const score = formatScore(row['Round 1 Score for\nNOMINEE\n(1 - 4, 5 for famous people)'])
    const districtScore = formatScore(row['Round 1 Score for\nFIT FOR DISTRICT\n(1 - 4)'])
    let moveOn = formatMoveOn(row['Move on to ROUND 2?\n(Y/N)'])

    if (score || districtScore || moveOn || profile) {
      const nominee = await airtable.findById('People', nomination.get('Person')[0])
      const nominator = await airtable.findById('People', nomination.get('Nominator')[0])
      if (profile) {
        await airtable.update('People', nominee.id, {
          Profile: profile
        })
      }

      const evaluator = await findEvaluator(row['Round 1\nEVALUATOR'])
      if (moveOn === null && score !== null) {
        if (score === 4) {
          moveOn = 'Yes'
        } else {
          moveOn = 'No'
        }
      }
      const round1Evaluation = {
        Nominee: [nominee.id],
        Round: 'R1',
        Score: score,
        'District Score': districtScore ? districtScore.toString() : null,
        'Move To Next Round': moveOn,
        'Evaluation Date (Legacy)': new Date(row['Round 1\nEVALUATION DATE']),
        Evaluator: evaluator ? [evaluator] : null
      }
      await airtable.create('Nominee Evaluations', round1Evaluation)
      let nomineeName = nominee.get('Name')
      if (!isEmpty(nomineeName)) {
        nomineeName = nomineeName.toLowerCase()
      }
      const round2EvaluationData = round2Data[nomineeName]
      if (round2EvaluationData) {
        let round2Score = formatScore(round2EvaluationData['Round 2 Score of\nNOMINEE'])
        const round2DistrictScore = parseInt(formatText(round2EvaluationData['Round 2 Score of\nFIT FOR DISTRICT\n(override if this changed since Round 1)']), 10)
        const nominatorNotes = formatText(round2EvaluationData['Round 2 \nCommunication and Evaluation Notes with the\n\nNOMINATOR'])
        const nomineeNotes = formatText(round2EvaluationData['Round 2 \nCommunication and Evaluation \nNotes with the\n\nNOMINEE'])
        let round2MoveOn = formatMoveOn(round2EvaluationData['Move on to ROUND 3?'])
        if (round2Score || round2DistrictScore || nomineeNotes || nominatorNotes || round2MoveOn) {
          if (round2Score === 0) {
            round2Score = null
            round2MoveOn = 'Hold'
          }
          if (round2MoveOn === null && round2Score !== null) {
            if (round2Score >= 3) {
              round2MoveOn = 'Yes'
            } else {
              round2MoveOn = 'No'
            }
          }
          if (round2MoveOn === null && round2DistrictScore !== null) {
            if (round2DistrictScore < 3) {
              round2MoveOn = 'No'
            }
          }
          if (round2MoveOn === null) {
            round2MoveOn = 'Hold'
          }

          let round2Evaluator = await findEvaluator(round2EvaluationData['Round 2 Evaluator'])
          if (round2Evaluator === null) {
            round2Evaluator = evaluator
          }
          const round2Evaluation = {
            Nominee: [nominee.id],
            Round: 'R2',
            Score: round2Score,
            'District Score': round2DistrictScore ? round2DistrictScore.toString() : null,
            'Move To Next Round': round2MoveOn,
            'Evaluation Date (Legacy)': new Date(round2EvaluationData['Date Evaluated (date you rated the person in column I)']),
            Evaluator: round2Evaluator ? [round2Evaluator] : null
          }
          await airtable.create('Nominee Evaluations', round2Evaluation)
          await createLog(round2Evaluator, nominator, nominatorNotes)
          await createLog(round2Evaluator, nominee, nomineeNotes)
          delete round2Data[nomineeName]
        }
      }
      const round3EvaluationData = round3Data[nomineeName]
      if (round3EvaluationData) {
        const round3MoveOn = formatMoveOn(round3EvaluationData['Board Decision to Move on to ROUND 4?'])
        const round3Evaluation = {
          Nominee: [nominee.id],
          Round: 'R3',
          'Move To Next Round': round3MoveOn
        }
        await airtable.create('Nominee Evaluations', round3Evaluation)
        delete round3Data[nomineeName]
      }
    }
    if (index % 100 === 0) {
      console.log(index, '/', parsedData.data.length)
    }
  }
  fs.writeFileSync('round2-updated.json', JSON.stringify(round2Data))
  fs.writeFileSync('round3-updated.json', JSON.stringify(round3Data))
}

parse()
.catch((ex) => console.log(ex))
