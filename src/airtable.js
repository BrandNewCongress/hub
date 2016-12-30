import Airtable from 'airtable'
import log from './log'
import {
  isEmpty,
  toTitleCase,
  formatDate,
  formatEmail,
  formatText,
  formatPhoneNumber,
  formatLink,
  formatStateCode,
  formatDistrictCode,
  formatDistrict,
  formatPoliticalParty,
  formatSourceTeamName
} from './lib'

class BNCAirtable {
  constructor() {
    this.base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base(process.env.AIRTABLE_BASE)
  }

  async findAll(table, filterOptions) {
    return new Promise((resolve, reject) => {
      let results = []
      this.base(table)
        .select(filterOptions)
        .eachPage((records, fetchNextPage) => {
          results = results.concat(records)
          fetchNextPage()
        }, (err) => {
          if (err) {
            log.error(err)
            reject(err)
          }
          resolve(results)
        })
    })
  }

  async findById(table, id) {
    return new Promise((resolve, reject) => {
      this.base(table)
        .find(id, (err, record) => {
          if (err) {
            log.error(err)
            reject(err)
          }
          resolve(record)
        })
    })
  }

  async findOne(table, formula) {
    const result = await this.findAll(table, {
      filterByFormula: formula,
      maxRecords: 1
    })
    return result[0]
  }

  async update(table, id, fields) {
    return new Promise((resolve, reject) => {
      this.base(table)
        .update(id, fields, (err, record) => {
          if (err) {
            log.error(err)
            reject(err)
          }
          resolve(record)
        })
    })
  }

  async create(table, fields) {
    return new Promise((resolve, reject) => {
      this.base(table)
        .create(fields, (err, record) => {
          if (err) {
            log.error(err)
            reject(err)
          }
          resolve(record)
        })
    })
  }

  async createOrUpdatePerson(personId, {
    email,
    phone,
    facebook,
    linkedin,
    twitter,
    name,
    city,
    politicalParty,
    stateId,
    districtId
  }) {
    let person = null
    if (personId) {
      person = await this.findById('People', personId)
    } else {
      person = await this.create('People', {
        Name: name,
        Facebook: facebook,
        LinkedIn: linkedin,
        Twitter: twitter,
        'Political Party': politicalParty
      })
    }

    const recordsToCreate = {}

    if (phone) {
      recordsToCreate['Phone Numbers'] = {
        'Phone Number': phone,
        Person: [person.id]
      }
    }

    if (email) {
      recordsToCreate.Emails = {
        Email: email,
        Person: [person.id]
      }
    }

    if (city || stateId || districtId) {
      recordsToCreate.Addresses = {
        City: city,
        State: stateId ? [stateId] : null,
        'Congressional District': districtId ? [districtId] : null,
        Person: [person.id]
      }
    }

    const personFieldsToUpdate = {}
    if (isEmpty(person.get('Name')) && name) {
      personFieldsToUpdate.Name = name
    }
    if (isEmpty(person.get('Facebook')) && facebook) {
      personFieldsToUpdate.Facebook = facebook
    }
    if (isEmpty(person.get('LinkedIn')) && linkedin) {
      personFieldsToUpdate.LinkedIn = linkedin
    }
    if (isEmpty(person.get('Twitter')) && twitter) {
      personFieldsToUpdate.Twitter = twitter
    }
    if (isEmpty(person.get('Political Party')) && politicalParty) {
      personFieldsToUpdate['Political Party'] = politicalParty
    }
    if (Object.keys(personFieldsToUpdate).length > 0) {
      await this.update('People', person.id, personFieldsToUpdate)
    }

    const existingEmail = await this.findOne('Emails', `{Email} = '${email}'`)
    if (existingEmail) {
      delete recordsToCreate.Emails
    }

    const existingPhone = await this.findOne('Phone Numbers', `{Phone Number} = '${phone}'`)
    if (existingPhone) {
      delete recordsToCreate['Phone Numbers']
    }

    const addressIds = person.get('Addresses')
    if (!isEmpty(addressIds)) {
      let index = 0
      for (index = 0; index < addressIds.length; index++) {
        const address = await this.findById('Addresses', addressIds[index])
        if ((!isEmpty(address.get('Congressional District')) && address.get('Congressional District')[0] === districtId) ||
            (!isEmpty(address.get('City')) && !isEmpty(city) && address.get('City').toLowerCase() === city.toLowerCase()) ||
            (!isEmpty(address.get('State')) && address.get('State')[0] === stateId && isEmpty(city) && isEmpty(districtId))) {
          const addressFieldsToUpdate = {}
          if (isEmpty(address.get('Congressional District')) && districtId) {
            addressFieldsToUpdate['Congressional District'] = [districtId]
          }
          if (isEmpty(address.get('City')) && city) {
            addressFieldsToUpdate.City = city
          }
          if (isEmpty(address.get('State')) && stateId) {
            addressFieldsToUpdate.State = [stateId]
          }
          await this.update('Addresses', address.id, addressFieldsToUpdate)
          break
        }
      }
      if (index !== addressIds.length) {
        delete recordsToCreate.Addresses
      }
    }
    const tablesToUpdate = Object.keys(recordsToCreate)
    for (let index = 0; index < tablesToUpdate.length; index++) {
      const tableToUpdate = tablesToUpdate[index]
      await this.create(tableToUpdate, recordsToCreate[tableToUpdate])
    }
    return person
  }

  async matchPerson({
    email, phone, facebook, linkedin, twitter, name, city, stateId, districtId
  }) {
    if (email) {
      const emailRecord = await this.findOne('Emails', `{Email} = '${email}'`)
      if (emailRecord) {
        return emailRecord.get('Person')[0]
      }
    }
    if (phone) {
      const phoneRecord = await this.findOne('Phone Numbers', `{Phone Number} = '${phone}'`)
      if (phoneRecord) {
        return phoneRecord.get('Person')[0]
      }
    }
    if (facebook || linkedin || twitter) {
      let matchString = 'OR('
      if (facebook) {
        matchString = `${matchString}{Facebook} = '${facebook}',`
      }
      if (linkedin) {
        matchString = `${matchString}{LinkedIn} = '${linkedin}',`
      }
      if (twitter) {
        matchString = `${matchString}{Twitter} = '${twitter}',`
      }
      matchString = `${matchString.slice(0, -1)})`

      const personRecord = await this.findOne('People', matchString)
      if (personRecord) {
        return personRecord.id
      }
    }
    if (name && (districtId || (city && stateId))) {
      const personRecords = await this.findAll('People', {
        filterByFormula: `LOWER({Name}) = '${name.toLowerCase()}'`
      })
      for (let index = 0; index < personRecords.length; index++) {
        const record = personRecords[index]
        const addressIds = record.get('Addresses')
        if (!isEmpty(addressIds)) {
          for (let innerIndex = 0; innerIndex < addressIds.length; innerIndex++) {
            const address = await this.findById('Addresses', addressIds[innerIndex])
            if ((!isEmpty(address.get('Congressional District')) && address.get('Congressional District')[0] === districtId) ||
              (!isEmpty(address.get('City')) && address.get('City').toLowerCase() === city.toLowerCase() && !isEmpty(address.get('State')) && address.get('State')[0] === stateId)) {
              return record.id
            }
          }
        }
      }
    }
    return null
  }

  async createNomination(rawNomination) {
    const nomination = {
      ...rawNomination,
      'Date Submitted (Legacy)': formatDate(rawNomination['Date Submitted (Legacy)']),
      Source: formatText(rawNomination.Source),
      'Run for Office': formatText(rawNomination['Run for Office'])
    }
    const cleanedNomination = {
      nominatorName: formatText(rawNomination['Nominator Name']),
      nominatorEmail: formatEmail(rawNomination['Nominator Email']),
      nominatorPhone: formatPhoneNumber(rawNomination['Nominator Phone']),
      name: formatText(rawNomination.Name),
      email: formatEmail(rawNomination.Email),
      phone: formatPhoneNumber(rawNomination.Phone),
      city: toTitleCase(formatText(rawNomination.City)),
      stateCode: formatStateCode(rawNomination['State Name']),
      districtCode: formatDistrictCode(rawNomination['Congressional District Code']),
      facebook: formatLink(rawNomination.Facebook),
      linkedIn: formatLink(rawNomination.LinkedIn),
      twitter: formatLink(rawNomination.Twitter),
      politicalParty: formatPoliticalParty(rawNomination['Political Party']),
      sourceTeamName: formatSourceTeamName(rawNomination['Source Team Name']),
      submitterEmail: formatEmail(rawNomination['Submitter Email']) || formatEmail(rawNomination['Nominator Email'])
    }

    const state = await this.findOne('States', `{Abbreviation} = '${cleanedNomination.stateCode}'`)
    const stateId = state ? state.id : null

    const districtAbbreviation = formatDistrict(cleanedNomination.stateCode, cleanedNomination.districtCode)
    let districtId = null
    if (districtAbbreviation !== null) {
      const district = await this.findOne('Congressional Districts', `{ID} = '${districtAbbreviation}'`)
      districtId = district ? district.id : null
    }

    let nominator = await this.matchPerson({
      email: cleanedNomination.nominatorEmail,
      phone: cleanedNomination.nominatorPhone
    })

    nominator = await this.createOrUpdatePerson(nominator, {
      name: cleanedNomination.nominatorName,
      email: cleanedNomination.nominatorEmail,
      phone: cleanedNomination.nominatorPhone
    })

    let submitter = await this.matchPerson({
      email: cleanedNomination.submitterEmail
    })
    submitter = await this.createOrUpdatePerson(submitter, {
      email: cleanedNomination.submitterEmail
    })
    let nominee = await this.matchPerson({
      email: cleanedNomination.email,
      phone: cleanedNomination.phone,
      facebook: cleanedNomination.facebook,
      linkedin: cleanedNomination.linkedin,
      twitter: cleanedNomination.twitter,
      name: cleanedNomination.name,
      city: cleanedNomination.city,
      stateId,
      districtId
    })
    nominee = await this.createOrUpdatePerson(nominee, {
      email: cleanedNomination.email,
      phone: cleanedNomination.phone,
      facebook: cleanedNomination.facebook,
      linkedin: cleanedNomination.linkedin,
      twitter: cleanedNomination.twitter,
      name: cleanedNomination.name,
      city: cleanedNomination.city,
      politicalParty: cleanedNomination.politicalParty,
      stateId,
      districtId
    })

    let sourceTeam = null
    if (cleanedNomination.sourceTeamName) {
      sourceTeam = await this.findOne('Teams', `LOWER({Name}) = '${cleanedNomination.sourceTeamName.toLowerCase()}'`)
    }

    const nominationToSubmit = {
      ...nomination,
      State: stateId ? [stateId] : null,
      'Congressional District': districtId ? [districtId] : null,
      Person: [nominee.id],
      'Source Team': sourceTeam ? [sourceTeam.id] : null,
      Submitter: [submitter.id],
      Nominator: [nominator.id]
    }
    const createdNomination = await this.create('Nominations', nominationToSubmit)
    return createdNomination
  }

  async createNomineeEvaluation(nominee, round, score, districtScore, moveToNextRound, evaluator, evaluationDate) {
    const rounds = {
      R1: 'R1 - Initial Eval',
      R2: 'R2 - One Interview',
      R3: 'R3 - Board Review',
      R4: 'R4 - Extended Interviews',
      R5: 'R5 - Board Review',
      R6: 'R6 - Convince to Run'
    }
    const nomineeEvaluation = {
      Nominee: [nominee.id],
      Round: rounds[formatText(round)],
      Score: score,
      'District Score': formatText(districtScore),
      'Move To Next Round': moveToNextRound ? 'Yes' : 'No',
      Evaluator: [evaluator.id],
      'Evaluation Date (Legacy)': formatDate(evaluationDate)
    }
  }
}

const BNCAirtableSingleton = new BNCAirtable()
export default BNCAirtableSingleton

