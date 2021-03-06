const reverseMap = map =>
  Object.keys(map).reduce(
    (acc, key) => Object.assign(acc, { [map[key]]: key }),
    {}
  )

const candidateToCalendar = {
  'Cori Bush': 6,
  'Paula Jean Swearengin': 7,
  'Alexandria Ocasio-Cortez': 8,
  'Brand New Congress': 9,
  'Danny Ellyson': 10,
  'Chardo Richardson': 11,
  'Michael Hepburn': 12,
  'Robb Ryerse': 13,
  'Demond Drummer': 14,
  'Richard Rice': 15,
  'Anthony Clark': 16,
  'Letitia Plummer': 17,
  'Eric Terrell': 18,
  'Sarah Smith': 19,
  'Adrienne Bell' : 20,
  'Hector Morales': 1021,
  'Ryan Stone': 1022,
  'Paul Perry': 1026
}

const followers = {
  coribush: 'brendan@brandnewcongress.org'
}

const calendarToCandidate = reverseMap(candidateToCalendar)

module.exports = {
  calendarMap: {
    fromCandidate: candidateToCalendar,
    toCandidate: calendarToCandidate
  },
  followers
}
