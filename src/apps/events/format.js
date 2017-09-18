const { candidateMap, calendarMap, originMap } = require('./data')
const moment = require('moment-timezone')

const timeZoneMap = {
  'Alaska': '-09:00',
  'Pacific Time (US & Canada)': '-07:00',
  'Mountain Time (US & Canada)': '-06:00',
  'Central Time (US & Canada)': '-05:00',
  'Eastern Time (US & Canada)': '-04:00'
}

module.exports = {
  event: e => {
    const tz = e.location.time_zone
    const timeZoneOffset = '-' + moment(e.start_time).tz(tz).format().split('-')[3]

    return {
      id: e.id,
      url: `http://now.brandnewcongress.org/events/${e.name}`,
      title: e.title,
      intro: e.summary,
      startTime: new Date(e.start_date).toISOString(),
      endTime: new Date(e.end_date).toISOString(),
      timeZone: tz,
      timeZoneOffset: timeZoneOffset,
      venue: e.venue,
      candidate: calendarMap[e.calendar_id],
      calendar: e.calendar_id
    }
  },
  sam: {
    event: e => {
      const tz = e.location.time_zone
      const timeZoneOffset = '-' + moment(e.start_time).tz(tz).format().split('-')[3]

      const type = e.type || 'Unknown'

      return {
        id: e.id,
        url: `http://now.brandnewcongress.org/events/${e.name}`,
        title: e.title,
        intro: e.summary,
        startTime: e.start_date,
        endTime: e.end_date,
        timeZone: tz,
        timeZoneOffset: timeZoneOffset,
        venue: e.venue,
        candidate: calendarMap[e.calendar_id],
        calendar: e.calendar_id,
        type,
        contact: e.contact
      }
    }
  }
}
