import toAirCase from './to-air-case'

const airify = (key, value) => Array.isArray(key)
    ? `{${toAirCase(key[0])}} = "${key[1]}"`
    : `{${toAirCase(key)}} = "${value}"`

const fns = {
  $not: (key, value) => `NOT(${airify(key, value)})`,
  formula: (key, value) => value,
  $or: (key, value) => `${construct(value, true)}`
}

const construct = (query, or) => {
  const normalized = Array.isArray(query)
    ? [].concat.apply(query.map(Object.entries))
    : Object.entries(query)

  const result = `${!or ? 'AND' : 'OR'}(
    ${normalized.map(([key, value]) => fns[key]
      ? fns[key](key, value)
      : airify(key, value)
    ).join(',')})`

  return result
}

module.exports = construct
