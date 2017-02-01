var kue = require('kue')

console.log('Deleting jobs:', process.argv[2])
kue.Job.rangeByState('complete', 0, process.argv[2], 'asc', (err, jobs) => {
  jobs.forEach((job) => {
    job.remove(() => {
      console.log('removed ', job.id)
    })
  })
})
