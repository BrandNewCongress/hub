const Baby = require('babyparse')

async function parse() {
  const nominations = Baby.parseFiles(`${process.argv[3]}/nominations.csv`, {
    header: true
  })
  const people = Baby.parseFiles(`${process.argv[3]}/people.csv`, {
    header: true
  })

  const peopleById = {}
  people.data.forEach((person) => {
    const ID = person[Object.keys(person)[0]]
    if (peopleById.hasOwnProperty(ID)) {
      console.warn(`already there ${ID}`)
    }
    peopleById[ID] = person
  })

  nominations.data.forEach((nomination) => {
    if (nomination['Person']) {
      const correspondingPerson = peopleById[nomination['Person']]
      if (correspondingPerson) {
        if (correspondingPerson['Name'].toLowerCase().trim() !== nomination['Name'].toLowerCase().trim()) {
          console.log(`${correspondingPerson['Name']} : ${nomination['Name']}`)
        }
      }
    }
  })
}

parse().catch((ex) => console.log(ex))
