const sources = [
  ['justicedemocrats.com', 'Justice Democrats'],
  ['votecoribush.com', 'Cori Bush'],
  ['paulajean2018.com', 'Paula Jean Swearengin'],
  ['cori-bush', 'Cori Bush'],
  ['paula-jean', 'Paula Jean Swearengin'],
  ['paula-jean-swearengin', 'Paula Jean Swearengin'],
  ['sarah-smith', 'Sarah Smith'],
  ['letitia-plummer', 'Letitia Plummer'],
  ['anthony-clark', 'Anthony Clark'],
  ['richard-rice', 'Richard Rice'],
  ['demond-drummer', 'Demond Drummer'],
  ['robb-ryerse', 'Robb Ryerse'],
  ['michael-hepburn', 'Michael Hepburn'],
  ['michael-a-hepburn', 'Michael Hepburn'],
  ['chardo-richardson', 'Chardo Richardon'],
  ['danny-ellyson', 'Danny Ellyson'],
  ['eric-terrell', 'Eric Terrell'],
  ['adrienne-bell', 'Adrienne Bell'],
  ['alexandria-ocasio', 'Alexandria Ocasio-Cortez'],
  ['alexandria-cortez', 'Alexandria Ocasio-Cortez'],
  ['alexandria-ocasio-cortez', 'Alexandria Ocasio-Cortez'],
  ['hector-morales', 'Hector Morales'],
  ['brandnewcongress', 'Brand New Congress']
]

const match = str => {
  if (!str || typeof str != 'string') {
    return 'Brand New Congress'
  }

  const m = sources.filter(
    ([slug, name]) =>
      slug
        .toLowerCase()
        .replace(/[ -]/g, '')
        .includes(str.toLowerCase().replace(/[ -]/g, '')) ||
      str
        .toLowerCase()
        .replace(/[ -]/g, '')
        .includes(slug.toLowerCase().replace(/[ -]/g, ''))
  )[0]

  return m ? m[1] : 'Brand New Congress'
}

module.exports = { sources, match }
