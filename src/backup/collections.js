// Has respective date fields for time series queries in Mongo

module.exports = [
  { 'People': ['dateCreated', 'lastContacted', 'evaluationDate'] },
  { 'States': [] },
  { 'District Data': [] },
  { 'Phone Numbers': [] },
  { 'Addresses': [] },
  { 'Emails': [] },
  { 'Nominee Evaluations': ['evaluationDate'] },
  { 'Nominations': ['dateSubmitted'] },
  { 'Contact Logs': ['dateContacted'] },
  { 'Teams': [] },
  { 'Congressional Districts': [] }
]
