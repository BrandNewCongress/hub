// Has respective date fields for time series queries in Mongo

export default [
  {'People': ['dateCreated', 'lastContacted', 'evaluationDate']},
  {'States': []},
  {'District Data': []},
  {'Phone Numbers': []},
  {'Addresses': []},
  {'Emails': []},
  {'Nominee Evaluations': ['evaluationDate']},
  {'Nominations': ['dateSubmitted']},
  {'Contact Logs': ['dateContacted']},
  {'Teams': []},
  {'Congressional Districts': []}
]
