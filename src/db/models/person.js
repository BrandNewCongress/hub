const bookshelf = require('../bookshelf')
const {
  DateTimeField, StringField, BooleanField, NumberField, EmailField
} = require('bookshelf-schema/lib/fields')

module.exports = bookshelf.model('Person', {
  tableName: 'people',
  schema: [
    // TODO generate this based on nation builder dump
  ],
})
