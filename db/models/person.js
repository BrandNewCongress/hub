const bookshelf = require('../bookshelf')

module.exports = bookshelf.model('Person', {
  tableName: 'people'
  // TODO: Add foreign keys
})
