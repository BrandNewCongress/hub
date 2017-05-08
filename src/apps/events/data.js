const candidateMap = {
  coribush: 6,
  paulajean: 7
}

const calendarMap = Object.keys(candidateMap).reduce(
  (acc, candidate) =>
    Object.assign(acc, { [candidateMap[candidate]]: candidate }),
  {}
)

const originMap = {
  'votecoribush.com': 6,
  'paulajean2018.com': 7
}

module.exports = { candidateMap, calendarMap, originMap }
