import axios from 'axios'
import log from './log'

const monthNames = ['Invalid', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

class Maestro {
  formattedData(conferenceData) {
    const datum = {}
    // parse conference Id
    datum.conferenceId = conferenceData.value.UID

    // parse name
    datum.name = conferenceData.value.name

    // parse date
    const conferenceDateTimeParts = conferenceData.value.scheduledStartTime.split(' ')
    datum.date = `${conferenceDateTimeParts[0]}, ${conferenceDateTimeParts[1]} ${parseInt(conferenceDateTimeParts[2], 10)}, ${conferenceDateTimeParts[5]}`

    // parse time
    const conferenceTimeParts = conferenceDateTimeParts[3].split(':')
    const conferenceHourPst = parseInt(conferenceTimeParts[0], 10)
    const conferenceHourEst = conferenceHourPst + 3
    const conferenceMinutePst = conferenceTimeParts[1]
    datum.time = `${this.from24hourFormatTo12hourFormat(conferenceHourEst)}:${conferenceMinutePst}${this.getPeriodFrom24hour(conferenceHourEst)} ET / ${this.from24hourFormatTo12hourFormat(conferenceHourPst)}:${conferenceMinutePst}${this.getPeriodFrom24hour(conferenceHourPst)} PT`

    // parse signups count
    let participantsCount = 0
    const persons = conferenceData.value.person
    if (typeof persons !== 'undefined') {
      persons.forEach((person) => {
        if (person.role === 'PARTICIPANT') {
          participantsCount++
        }
      })
    }

    datum.currentSignups = participantsCount

    // set conference registration link
    datum.registrationLink = `http://myaccount.maestroconference.com/conference/register/${datum.conferenceId}`

    // set creation time
    datum.creationTimeInSeconds = new Date().getTime() / 1000

    // set js datetime
    const monthNum = monthNames.indexOf(conferenceDateTimeParts[1])
    const monthDate = parseInt(conferenceDateTimeParts[2], 10)
    const year = parseInt(conferenceDateTimeParts[5], 10)
    const hour = conferenceHourPst
    const minute = parseInt(conferenceMinutePst, 10)
    datum.timeInSeconds = new Date(year, monthNum, monthDate, hour, minute, 0, 0).getTime() / 1000
    return datum
  }

  from24hourFormatTo12hourFormat(hour) {
    let h = hour
    if (h >= 12) {
      h = hour - 12
    }
    if (h === 0) {
      h = 12
    }

    return h
  }

  getPeriodFrom24hour(hour) {
    let dd = 'am'
    if (hour >= 12) {
      dd = 'pm'
    }
    return dd
  }

  async getConferenceData(conferenceId) {
    const response = await axios.get(`${process.env.MAESTRO_API_URL}/getConferenceData?type=json&customer=${process.env.MAESTRO_CUSTOMER_UID}&key=${process.env.MAESTRO_SECURITY_TOKEN}&conferenceUID=${conferenceId}`)
    if (response.status === 200 && response.data.code === 0) {
      return response.data
    }
    log.error(`Bad Maestro Request in getConferenceData: ${JSON.stringify(response)}`)
    return null
  }

  async getUpcomingConferences(nameContains) {
    const response = await axios.get(`${process.env.MAESTRO_API_URL}/getUpcomingConference?type=json&customer=${process.env.MAESTRO_CUSTOMER_UID}&key=${process.env.MAESTRO_SECURITY_TOKEN}`)
    if (response.status === 200 && response.data.code === 0) {
      const upcomingConferenceIds = []
      response.data.value.conference.forEach((entry) => {
        if (entry.name.includes(nameContains)) {
          upcomingConferenceIds.push(entry.UID)
        }
      })
      return upcomingConferenceIds
    }
    log.error(`Bad Maestro Request in getUpcomingConferences: ${JSON.stringify(response)}`)
    return null
  }
}

const maestroSingleton = new Maestro

export default maestroSingleton
