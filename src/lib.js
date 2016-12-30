import log from './log'
import { PhoneNumberFormat as PNF, PhoneNumberUtil } from 'google-libphonenumber'
import normalizeUrl from 'normalize-url'
const phoneUtil = PhoneNumberUtil.getInstance()

export function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

export function isEmpty(val) {
  if (typeof val === 'undefined' || val === null || (val.hasOwnProperty('trim') && val.trim() === '')) {
    return true
  }
  if (val.hasOwnProperty('length') && val.length === 0) {
    return true
  }
  return false
}

export function formatEmail(email) {
  if (isEmpty(email)) {
    return null
  }
  return email.trim().toLowerCase()
}

export function formatText(text) {
  if (isEmpty(text)) {
    return null
  }
  return text.trim()
}

export function formatPhoneNumber(number) {
  if (isEmpty(number)) {
    return null
  }
  let formattedNumber = number.trim()
  try {
    formattedNumber = phoneUtil.format(phoneUtil.parse(formattedNumber, 'US'), PNF.INTERNATIONAL)
  } catch (ex) {
    console.log(ex)
    log.warn('Badly formatted phone number: ', number)
  }
  return formattedNumber
}

export function formatLink(link) {
  if (isEmpty(link)) {
    return null
  }
  let formattedLink = link.trim().toLowerCase()
  if (formattedLink.match('.com')) {
    try {
      formattedLink = normalizeUrl(formattedLink)
    } catch (ex) {
      log.warn('Badly formatted link: ', link)
      return null
    }
  }
  return formattedLink
}

export function capitalizeText(text) {
  if (isEmpty(text)) {
    return null
  }
  return toTitleCase(text.trim())
}

export function formatState(state) {
  if (isEmpty(state) || state.length !== 2) {
    return null
  }
  return state.trim().toUpperCase()
}

export function formatDistrict(state, district) {
  if (isEmpty(district) || isEmpty(state)) {
    return null
  }

  let districtNumber = district
  if (districtNumber.trim().toUpperCase() === 'AL') {
    districtNumber = districtNumber.trim().toUpperCase()
  } else {
    districtNumber = parseInt(district.trim(), 10).toString()
  }
  return `${formatState(state)}-${districtNumber}`
}
