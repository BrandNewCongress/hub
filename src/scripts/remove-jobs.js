var kue = require('kue')

kue.redis.configureFactory({
  redis: process.env.REDIS_URL
})
console.log('Deleting jobs:', process.argv[2])
kue.Job.rangeByState('complete', 0, process.argv[2], 'asc', (err, jobs) => {
  jobs.forEach((job) => {
    job.client = kue.redis.client()
    job.remove(() => {
      console.log('removed ', job.id)
    })
  })
})
