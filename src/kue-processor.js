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
    console.log('Creating person...')
    await nationbuilder.createPerson(job.data)
  } catch (ex) {
    log.error(ex)
    return done()
  }
  return done()
})

queue.process('createNomination', async (job, done) => {
  try {
    console.log('Processing nomination...')
    await airtable.createNomination(job.data, (progress) => {
      job.progress(progress, 100)
    })
  } catch (ex) {
    log.error(ex)
    return done()
  }
  return done()
})
