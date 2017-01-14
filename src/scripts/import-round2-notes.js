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
    const createdLog = await airtable.create('Contact Logs', {
      Contacter: [contacterId],
      Person: [person.id]
    })

    const phoneNumbers = person.get('Phone Numbers')
    await airtable.create('Call Logs', {
      'Contact Log': [createdLog.id],
      'Phone Number': !isEmpty(phoneNumbers) ? [phoneNumbers[0]] : null,
      Direction: null,
      Result: null,
      Notes: notes
    })
  }

  const inputData = fs.readFileSync(process.argv[3])
  const jsonData = JSON.parse(inputData)
  const people = Object.keys(jsonData)
  

}

parse()
.catch((ex) => console.log(ex))
