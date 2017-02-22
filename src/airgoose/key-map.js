export default (obj, transform) => Object.keys(obj).reduce((acc, key) =>
  Object.assign({[transform(key)]: obj[key]}, acc)
, {})
