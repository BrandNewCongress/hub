import keyMap from './key-map'
import toCamelCase from 'to-camel-case'

export default raw => keyMap(Object.assign({id: raw.id}, raw._rawJson.fields), toCamelCase)
