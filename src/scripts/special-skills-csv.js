const fs = require('fs')
const monk = require('monk')
const db = monk(process.env.MONGODB_URI)

const ApiLogs = db.get('API Logs')

const go = async () => {
  console.log('Fetching submissions...')

  let submissions = []
  let page = 0
  let keepGoing = true

  while (keepGoing) {
    let batch = await ApiLogs.find(
      { path: '/volunteers' },
      { limit: 100, skip: page * 100 }
    )
    page++

    if (batch.length < 99) {
      keepGoing = false
    }

    submissions = submissions.concat(batch)
    console.log(`Got next ${batch.length}: have ${submissions.length} total`)
  }

  console.log('...done.')

  const output = submissions
    .filter(submission => submission.headers)
    .filter(submission => submission.headers.host.includes('brandnewcongress'))
    .map(submission => {
      let {
        volunteerName,
        volunteerEmail,
        volunteerPhone,
        volunteerAddress,
        volunteerCity,
        volunteerState,
        volunteerZip,
        volunteerAvailability,
        volunteerFrequency,
        volunteerSkills,
        volunteerProfile
      } = submission.data

      volunteerFrequency = volunteerFrequency
        ? volunteerFrequency.join(',')
        : ''

      volunteerSkills = volunteerSkills ? volunteerSkills.join(',') : ''

      const brand = submission.headers.host.includes('justicedemocrats')
        ? 'jd'
        : 'bnc'

      return [
        volunteerName,
        volunteerEmail,
        volunteerPhone,
        volunteerAddress,
        volunteerCity,
        volunteerState,
        volunteerZip,
        volunteerAvailability,
        volunteerFrequency,
        volunteerSkills,
        volunteerProfile,
        brand
      ]
        .map(s => `"${s}"`)
        .join(',')
    })
    .join('\n')

  fs.writeFileSync(`./special-skills-${new Date().toISOString()}.csv`, output)
}

go()
  .then(console.log)
  .catch(console.error)
