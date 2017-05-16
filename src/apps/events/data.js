const reverseMap = map =>
  Object.keys(map).reduce(
    (acc, key) => Object.assign(acc, { [map[key]]: key }),
    {}
  )

const slugToName = {
  coribush: 'Cori Bush',
  paulajean: 'Paula Jean Swearengin',
  sarahsmith: 'Sarah Smith',
  letitiaplummer: 'Letitia Plummer',
  anthonyclark: 'Anthony Clark',
  richardrice: 'Richard Rice',
  demonddrummer: 'Demond Drummer',
  robbryerse: 'Robb Ryerse',
  michaelhephburn: 'Michael Hephburn',
  chardorichardson: 'Chardo Richardon',
  dannyellyson: 'Danny Ellyson',
  ericterrell: 'Eric Terrell',
  adrienneebell: 'Adriene Bell',
  alexandriaocasio: 'Alexandra Ocasio',
  brandnewcongress: 'General Brand New Congress'
}

const nameToSlug = reverseMap(slugToName)

const candidateToCalendar = {
  coribush: 6,
  paulajean: 7,
  alexandriaocasio: 8,
  brandnewcongress: 9,
  dannyellyson: 10,
  chardorichardson: 11,
  michaelhephburn: 12,
  robbryerse: 13,
  demonddrummer: 14,
  richardrice: 15,
  anthonyclark: 16,
  letitiaplummer: 17,
  ericterrell: 18,
  sarahsmith: 19,
  adrienneebell: 20
}

const followers = {
  coribush: 'brendan@brandnewcongress.org'
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
  },
  followers
}
