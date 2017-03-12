import express from 'express'
import monk from 'monk'
import cors from 'cors'
const db = monk(process.env.MONGODB_URI || 'localhost:27017/bnc')

const Evaluations = db.get('Nominee Evaluations')
const People = db.get('People')

const metrics = express()
metrics.use(cors())

const addDay = date => {
  date.setDate(date.getDate() + 1)
  return date
}

const querify = params => {
  const query = {}

  if (params.round)
    query.round = params.round

  if (params.dateRange)
    query.evaluationDate = {
      $gte: new Date(params.dateRange[0]),
      $lt: addDay(new Date(params.dateRange[1]))
    }

  if (params.evaluators)
    query.evaluatorName = {
      $in: Array.isArray(params.evaluators)
        ? params.evaluators
        : [params.evaluators]
    }

  return query
}

metrics.get('/metrics', async (req, res) => {
  try {
    const evaluations = await Evaluations
      .find(querify(req.query), {
        sort: {evaluationDate: 1},
        fields: ['id', 'round', 'evaluationDate', 'moveToNextRound']
      })

    const nominees = await People
      .find({evaluations: {
        $in: evaluations.filter(e => e.moveToNextRound == 'Yes').map(e => e.id)
      }}, {
        fields: ['gender', 'race']
      })

    const days = {}
    const breakdown = { Yes: 0, No: 0, Hold: 0 }
    const gender = {Unknown: 0}
    const race = {Unknown: 0}

    evaluations.forEach(d => {
      const day = d.evaluationDate.toDateString()
      if (!days[day]) days[day] = 0
      days[day]++

      if (breakdown[d.moveToNextRound] !== undefined) breakdown[d.moveToNextRound]++
    })

    nominees.forEach(n => {
      if (n.gender) {
        if (!gender[n.gender]) gender[n.gender] = 0
        gender[n.gender]++
      } else {
        gender.Unknown++
      }

      if (n.race) {
        n.race.forEach(r => {
          if (!race[r]) race[r] = 0
          race[r]++
        })
      } else {
        race.Unknown++
      }
    })

    return res.json({
      total: days.length,
      breakdown,
      gender,
      race,
      days
    })
  } catch (err) {
    console.log(err)
    res.status(500).json(err)
  }
})

metrics.get('/metrics/evaluators', async (req, res) => {
  try {
    const evaluations = await Evaluations.find({}, {fields: 'evaluatorName'})
    const evaluators = new Set()
    evaluations.forEach(e => {
      if (e.evaluatorName)
        e.evaluatorName.forEach(name => evaluators.add(name))
    })
    evaluators.delete(null)
    res.json([...evaluators])
  } catch (err) {
    console.log(err)
    res.status(500).json(err)
  }
})

export default metrics
