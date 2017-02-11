import kue from 'kue'
import airtable from './airtable'
import nationbuilder from './nationbuilder'
import log from './log'

log.info('kue-processor is running')
const queue = kue.createQueue({
  redis: process.env.REDIS_URL
})

queue.process('createPerson', async (job, done) => {
  try {
    await nationbuilder.createPerson(job.data)
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

queue.process('editPerson', async (job, done) => {
  try {
    const {personId, data} = job
    const updated = await airtable.createOrUpdatePerson(personId, data)
  } catch (ex) {
    log.error(ex)
    return done()
  }
  return done()
})
