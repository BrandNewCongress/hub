const log = require('./log')

const { PhoneNumberFormat, PhoneNumberUtil } = require('google-libphonenumber')
const PNF = PhoneNumberFormat

const normalizeUrl = require('normalize-url')
const moment = require('moment')
const phoneUtil = PhoneNumberUtil.getInstance()

const states = [
  {
    name: 'Alabama',
    code: 'AL'
  },
  {
    name: 'Alaska',
    code: 'AK'
  },
  {
    name: 'American Samoa',
    code: 'AS'
  },
  {
    name: 'Arizona',
    code: 'AZ'
  },
  {
    name: 'Arkansas',
    code: 'AK'
  },
  {
    name: 'California',
    code: 'CA'
  },
  {
    name: 'Colorado',
    code: 'CO'
  },
  {
    name: 'Connecticut',
    code: 'CT'
  },
  {
    name: 'Delaware',
    code: 'DE'
  },
  {
    name: 'District Of Columbia',
    code: 'DC'
  },
  {
    name: 'Florida',
    code: 'FL'
  },
  {
    name: 'Georgia',
    code: 'GA'
  },
  {
    name: 'Guam',
    code: 'GU'
  },
  {
    name: 'Hawaii',
    code: 'HI'
  },
  {
    name: 'Idaho',
    code: 'ID'
  },
  {
    name: 'Illinois',
    code: 'IL'
  },
  {
    name: 'Indiana',
    code: 'IN'
  },
  {
    name: 'Iowa',
    code: 'IA'
  },
  {
    name: 'Kansas',
    code: 'KS'
  },
  {
    name: 'Kentucky',
    code: 'KY'
  },
  {
    name: 'Louisiana',
    code: 'LA'
  },
  {
    name: 'Maine',
    code: 'ME'
  },
  {
    name: 'Maryland',
    code: 'MD'
  },
  {
    name: 'Massachusetts',
    code: 'MA'
  },
  {
    name: 'Michigan',
    code: 'MI'
  },
  {
    name: 'Minnesota',
    code: 'MN'
  },
  {
    name: 'Mississippi',
    code: 'MS'
  },
  {
    name: 'Missouri',
    code: 'MO'
  },
  {
    name: 'Montana',
    code: 'MT'
  },
  {
    name: 'Nebraska',
    code: 'NE'
  },
  {
    name: 'Nevada',
    code: 'NV'
  },
  {
    name: 'New Hampshire',
    code: 'NH'
  },
  {
    name: 'New Jersey',
    code: 'NJ'
  },
  {
    name: 'New Mexico',
    code: 'NM'
  },
  {
    name: 'New York',
    code: 'NY'
  },
  {
    name: 'North Carolina',
    code: 'NC'
  },
  {
    name: 'North Dakota',
    code: 'ND'
  },
  {
    name: 'Northern Mariana Islands',
    code: 'MP'
  },
  {
    name: 'Ohio',
    code: 'OH'
  },
  {
    name: 'Oklahoma',
    code: 'OK'
  },
  {
    name: 'Oregon',
    code: 'OR'
  },
  {
    name: 'Pennsylvania',
    code: 'PA'
  },
  {
    name: 'Puerto Rico',
    code: 'PR'
  },
  {
    name: 'Rhode Island',
    code: 'RI'
  },
  {
    name: 'South Carolina',
    code: 'SC'
  },
  {
    name: 'South Dakota',
    code: 'SD'
  },
  {
    name: 'Tennessee',
    code: 'TN'
  },
  {
    name: 'Texas',
    code: 'TX'
  },
  {
    name: 'Utah',
    code: 'UT'
  },
  {
    name: 'Vermont',
    code: 'VT'
  },
  {
    name: 'Virgin Islands',
    code: 'VI'
  },
  {
    name: 'Virginia',
    code: 'VA'
  },
  {
    name: 'Washington',
    code: 'WA'
  },
  {
    name: 'West Virginia',
    code: 'WV'
  },
  {
    name: 'Wisconsin',
    code: 'WI'
  },
  {
    name: 'Wyoming',
    code: 'WY'
  }
]

const atLargeStates = ['AK', 'DE', 'MT', 'ND', 'SD', 'VT', 'WY']


function toTitleCase (str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

function isEmpty (val) {
  if (typeof val === 'undefined' || val === null || (val.hasOwnProperty('trim') && val.trim() === '')) {
    return true
  }
  if (val.hasOwnProperty('length') && val.length === 0) {
    return true
  }
  return false
}

function formatDate (date) {
  if (isEmpty(date)) {
    return null
  }
  const dateObj = moment(date).toDate()
  if (dateObj.toString() === 'Invalid Date') {
    return null
  }
  return dateObj
}

function formatEmail (email) {
  if (isEmpty(email) || email.match('@') === null) {
    return null
  }
  return email.trim().toLowerCase()
}

function formatText (text) {
  if (isEmpty(text)) {
    return null
  }
  return text.trim()
}

function formatPhoneNumber (number) {
  if (isEmpty(number)) {
    return null
  }
  const formattedNumber = number.trim().replace(/\D/g, '')

  try {
    return phoneUtil.format(phoneUtil.parse(formattedNumber, 'US'), PNF.INTERNATIONAL)
  } catch (ex) {
    log.warn('Badly formatted phone number: ', formattedNumber)
    return null
  }
}

function formatLink (link) {
  if (isEmpty(link)) {
    return null
  }
  const formattedLink = link.trim().toLowerCase()
  if (formattedLink.match('.com')) {
    try {
      return normalizeUrl(formattedLink)
    } catch (ex) {
      log.warn('Badly formatted link: ', link)
      return null
    }
  }
  return null
}

function capitalizeText (text) {
  if (isEmpty(text)) {
    return null
  }
  return toTitleCase(text.trim())
}

function formatStateAbbreviation (state) {
  if (isEmpty(state)) {
    return null
  }
  let formattedState = state.trim()
  if (formattedState.length === 2) {
    return formattedState.toUpperCase()
  }
  formattedState = toTitleCase(formattedState)
  let foundState = false
  states.forEach((stateObj) => {
    if (!foundState && stateObj.name === formattedState) {
      formattedState = stateObj.code
      foundState = true
    }
  })
  if (foundState) {
    return formattedState
  }
  return null
}

function formatDistrictCode (district) {
  if (isEmpty(district)) {
    return null
  }

  let districtNumber = district.trim()
  if (districtNumber.match('-')) {
    districtNumber = districtNumber.split('-')[1]
  }
  if (districtNumber.toUpperCase() === 'AL') {
    return 'AL'
  }

  districtNumber = parseInt(districtNumber.trim(), 10)

  if (!isNaN(districtNumber)) {
    return (`0${districtNumber.toString()}`).slice(-2)
  }
  return null
}

function formatDistrict (stateAbbreviation, districtCode) {
  if (isEmpty(stateAbbreviation)) {
    return null
  }
  if (atLargeStates.indexOf(stateAbbreviation) !== -1) {
    return `${stateAbbreviation}-AL`
  }

  if (isEmpty(districtCode)) {
    return null
  }
  return `${stateAbbreviation}-${districtCode}`
}

function formatPoliticalParty (politicalParty) {
  const validParties = [
    'Democrat',
    'Republican',
    'Green',
    'Independent',
    'Unknown'
  ]
  if (isEmpty(politicalParty)) {
    return null
  }
  let foundParty = null
  validParties.forEach((party) => {
    if (party === toTitleCase(politicalParty.trim())) {
      foundParty = party
    }
  })
  return foundParty
}

function formatSourceTeamName (teamName) {
  const validTeams = [
    'BNC Staff',
    'Call Team',
    'Help Desk',
    'Candidate Research Team',
    'No Team'
  ]
  if (isEmpty(teamName)) {
    return null
  }
  let foundTeam = null
  validTeams.forEach((team) => {
    if (team.toLowerCase() === teamName.trim().toLowerCase()) {
      foundTeam = team
    }
  })
  return foundTeam
}

const bodyRequired = fields => (req, res, next) => {
  const required = fields.split(' ')
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' })
  }

  for (const f of required) {
    if (req.body[f] === undefined) {
      return res.status(400).json({
        error: 'Missing field',
        field: f
      })
    }
  }

  return next()
}

module.exports = {
  formatSourceTeamName, formatPoliticalParty, formatDistrict, formatDistrictCode,
  formatStateAbbreviation, capitalizeText, formatLink, formatPhoneNumber, formatText,
  formatEmail, formatDate, isEmpty, toTitleCase, bodyRequired
}
