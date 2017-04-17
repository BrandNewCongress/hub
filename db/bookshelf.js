const config = require('../knexfile')
const knex = require('knex')(config)
const bookshelf = require('bookshelf')(knex)

bookshelf.plugin('virtuals')
bookshelf.plugin('visibility')
bookshelf.plugin('registry')

knex.migrate.latest()

module.exports = bookshelf
