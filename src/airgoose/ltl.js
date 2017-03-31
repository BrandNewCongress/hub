module.exports = {
  Person: {
    evaluations: 'Evaluation',
    nominations: 'Nomination',
    district: 'District',
    addresses: 'Address',
    contactLogs: 'Contact'
  },
  Evaluation: {
    nominee: 'Person',
    evaluator: 'Person'
  },
  District: {},
  Addresses: {},
  Nomination: {
    person: 'Person'
  },
  Contact: {
    person: 'Person'
  }
}
