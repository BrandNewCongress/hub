const toSpaceCase = require('to-space-case')

const specialCases = {
  linkedIn: 'LinkedIn'
}

module.exports = str => {
  if (specialCases[str]) {
    return specialCases[str]
  }

  return toSpaceCase(str)
    .replace(/\w\S*/g,
      letter => letter.charAt(0).toUpperCase() + letter.substr(1).toLowerCase()
    )
}
