const keyMap = require('./key-map')
const toCamelCase = require('to-camel-case')

module.exports = raw => keyMap(Object.assign({ id: raw.id }, raw._rawJson.fields), toCamelCase)
