export function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

export function isEmpty(val) {
  if (typeof val === 'undefined' || val === null || val === '') {
    return true
  }
  if (val.hasOwnProperty('length') && val.length === 0) {
    return true
  }
  return false
}
