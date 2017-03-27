export default {
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
  Address: {},
  Nomination: {
    person: 'Person',
    congressionalDistrict: 'District'
  },
  Contact: {
    person: 'Person'
  }
}
