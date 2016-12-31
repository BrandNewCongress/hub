import airtable from '../airtable'
import Baby from 'babyparse'
import { formatText } from '../lib'

async function findEvaluator(name) {
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
  const formattedName = formatText(name)
  console.log(formattedName, name)
  if (formattedName) {
    const evaluatorObj = evaluators[formattedName.toLowerCase()]
    let evaluator = await airtable.matchPerson(evaluatorObj.email)
    if (!evaluator) {
      evaluator = await airtable.createOrUpdatePerson(null, {
        emails: [evaluatorObj.email],
        name: evaluatorObj.name,
        facebook: evaluatorObj.facebook
      })
      return evaluator
    }
  }
  return null
}

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

    const nomination = await airtable.createNomination(rawNomination)
    const profile = formatText(row['Round 1 EVALUATION NOTES'])
    const score = parseInt(formatText(row['Round 1 Score for NOMINEE (1 - 4)']), 10)
    console.log(row)
    console.log(row['Round 1 Score for FIT FOR DISTRICT (1 - 4)'], row['Round 1 EVALUATOR'])
    const districtScore = parseInt(formatText(row['Round 1 Score for FIT FOR DISTRICT (1 - 4)']), 10)
    let moveOn = formatText(row['Move on to ROUND 2? (Y/N)'])
    if (moveOn === 'Y') {
      moveOn = 'Yes'
    } else if (moveOn === 'N') {
      moveOn = 'No'
    } else {
      moveOn = null
    }
    if (score || districtScore || moveOn) {
      if (profile) {
        await airtable.update('People', nomination.get('Person')[0], {
          Profile: profile
        })
      }

      const evaluator = await findEvaluator(row['Round 1 EVALUATOR'])
      console.log(evaluator.id, nomination.get('Person'))
      const round1Evaluation = {
        Nominee: nomination.get('Person'),
        Round: 'R1 - Initial Eval',
        Score: score,
        'District Score': districtScore.toString(),
        'Move To Next Round': moveOn,
        'Evaluation Date (Legacy)': new Date(row['Round 1 EVALUATION DATE']),
        Evaluator: evaluator ? [evaluator.id] : null
      }
      console.log(round1Evaluation)
      await airtable.create('Nominee Evaluations', round1Evaluation)
    }

    break
  }
}

parse()
