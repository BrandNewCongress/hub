module.exports.up = async (db) => {
  await db.schema.createTable('people', table => {
    table.date('createdAt')
    table.boolean('doNotCall')
    table.boolean('doNotContact')
    table.string('email')
    table.boolean('emailOptIn')
    table.boolean('hasFacebook')

    table.integer('id')
    table.unique('id')
    table.index('id')

    table.boolean('isTwitterFollower')
    table.boolean('isVolunteer')
    table.boolean('mobileOptIn')

    table.string('phone')
    table.string('profileImageUrlSsl')
    table.enu('signupType', ['0', '1'])

    table.string('firstName')
    table.string('lastName')
  })
}

module.exports.down = async (db) => {
  await db.schema.dropTable('people')
}

module.exports.configuration = { transaction: true }
