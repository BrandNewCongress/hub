var kue = require('kue')

const queue = kue.createQueue({
  redis: process.env.REDIS_URL
})
console.log('Deleting jobs:', process.argv[2])
queue.Job.rangeByState('complete', 0, process.argv[2], 'asc', (err, jobs) => {
  jobs.forEach((job) => {
    job.remove(() => {
      console.log('removed ', job.id)
    })
  })
})
