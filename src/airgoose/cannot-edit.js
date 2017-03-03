const fields = [
  'id', 'dateSubmitted', 'timeToNowHrs', 'nominationStatus',
  'rounds', 'likelySelfNom', 'relationshipToNominator', 'runForOffice'
]

const e = {}
fields.forEach(f => e[f] = undefined)

export default e
