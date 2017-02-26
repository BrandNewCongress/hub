import toAirCase from './to-air-case'

const airify = query => {
  const key = Object.keys(query)[0]
  return `{${toAirCase(key)}} = "${query[key]}"`
}

const fns = {
  $not: (q, k) => `NOT(${airify(q[k])})`,
  formula: (q, k) => q[k]
}

export default query =>
  `AND(${Object.keys(query).map(k => fns[k]
    ? fns[k](query, k)
    : airify(Object.assign({}, {[k]: query[k]}))
  ).join(',')})`
