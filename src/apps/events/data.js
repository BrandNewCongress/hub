const reverseMap = map => Object.keys(map).reduce(
  (acc, key) =>
    Object.assign(acc, { [map[key]]: key }),
  {}
)

const slugToName = {
  coribush: 'Cori Bush',
  paulajean: 'Paula Jean Swearengin',
  brandnewcongress: 'General Brand New Congress'
}

const nameToSlug = reverseMap(slugToName)

const candidateToCalendar = {
  coribush: 6,
  paulajean: 7,
  brandnewcongress: 9
}

const calendarToCandidate = reverseMap(candidateToCalendar)

module.exports = {
  nameMap: {
    fromSlug: nameToSlug,
    toSlug: slugToName
  },
  calendarMap: {
    fromCandidate: candidateToCalendar,
    toCandidate: calendarToCandidate
  }
}
