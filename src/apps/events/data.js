const candidateMap = {
  coribush: 6
}

const calendarMap = Object.keys(candidateMap).reduce(
  (acc, candidate) =>
    Object.assign(acc, { [candidateMap[candidate]]: candidate }),
  {}
)

const originMap = {
  'votecoribush.com': 6
}

module.exports = { candidateMap, calendarMap, originMap }
