const kue = require('kue')
const airtable = require('./airtable')
const nationbuilder = require('./nationbuilder')
const log = require('./log')
const osdi = require('./osdi')

log.info('kue-processor is running')
const queue = kue.createQueue({
  redis: process.env.REDIS_URL
})

queue.process('createPerson', async (job, done) => {
  try {
    await osdi.createPerson(job.data)
  } catch (ex) {
    log.error(ex)
    return done()
  }
  return done()
})

queue.process('createNomination', async (job, done) => {
  try {
    await airtable.createNomination(job.data, (progress) => {
      job.progress(progress, 100)
    })
  } catch (ex) {
    log.error(ex)
    return done()
  }
  return done()
})
