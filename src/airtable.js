import Airtable from 'airtable'
import log from './log'
import { isEmpty, toTitleCase, formatEmail, formatText, formatPhoneNumber, formatLink, formatState, formatDistrict } from './lib'

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
      'Date Submitted (Legacy)': new Date(rawNomination['Date Submitted (Legacy)']),
      'Nominator Name': formatText(rawNomination['Nominator Name']),
      'Nominator Email': formatEmail(rawNomination['Nominator Email']),
      'Nominator Phone': formatPhoneNumber(rawNomination['Nominator Phone']),
      Name: formatText(rawNomination.Name),
      Email: formatEmail(rawNomination.Email),
      Phone: formatPhoneNumber(rawNomination.Phone),
      City: toTitleCase(formatText(rawNomination.City)),
      State: formatText(rawNomination.State).toUpperCase(),
      'Congressional District': rawNomination['Congressional District'],
      Facebook: formatLink(rawNomination.Facebook),
      LinkedIn: formatLink(rawNomination.LinkedIn),
      Twitter: formatLink(rawNomination.Twitter),
      'Political Party': formatText(rawNomination['Political Party']),
      'Relationship to Nominator': formatText(rawNomination['Relationship to Nominator']),
      Leadership: formatText(rawNomination.Leadership),
      'Work History': formatText(rawNomination['Work History']),
      'Public Speaking': formatText(rawNomination['Public Speaking']),
      'Political Views': formatText(rawNomination['Political Views']),
      'Run for Office': formatText(rawNomination['Run for Office']),
      'Office Run Results': formatText(rawNomination['Office Run Results']),
      'Other Info': formatText(rawNomination['Other Info']),
      'District Info': formatText(rawNomination['District Info']),
      Source: formatText(rawNomination.Source),
      'Source Team': formatText(rawNomination['Source Team']) || 'No Team',
      'Submitter Email': formatEmail(rawNomination['Submitter Email']) || formatEmail(rawNomination['Nominator Email']),
      'Source Details': formatText(rawNomination['Source Details'])
    }
    const state = await this.findOne('States', `{Abbreviation} = '${nomination.State}'`)
    const stateId = state ? state.id : null

    const district = await this.findOne('Congressional Districts', `{ID} = '${nomination['Congressional District']}'`)
    const districtId = district ? district.id : null

    let nominator = await this.matchPerson({
      email: nomination['Nominator Email'],
      phone: nomination['Nominator Phone']
    })

    nominator = await this.createOrUpdatePerson(nominator, {
      name: nomination['Nominator Name'],
      email: nomination['Nominator Email'],
      phone: nomination['Nominator Phone']
    })

    let submitter = await this.matchPerson({
      email: nomination['Submitter Email']
    })
    submitter = await this.createOrUpdatePerson(submitter, {
      email: nomination['Submitter Email']
    })
    let nominee = await this.matchPerson({
      email: nomination.Email,
      phone: nomination.Phone,
      facebook: nomination.Facebook,
      linkedin: nomination.LinkedIn,
      twitter: nomination.Twitter,
      name: nomination.Name,
      city: nomination.City,
      stateId,
      districtId
    })
    nominee = await this.createOrUpdatePerson(nominee, {
      email: nomination.Email,
      phone: nomination.Phone,
      facebook: nomination.Facebook,
      linkedin: nomination.LinkedIn,
      twitter: nomination.Twitter,
      name: nomination.Name,
      city: nomination.City,
      politicalParty: nomination['Political Party'],
      stateId,
      districtId
    })

    let sourceTeam = null
    if (nomination['Source Team']) {
      sourceTeam = await this.findOne('Teams', `LOWER({Name}) = '${nomination['Source Team'].toLowerCase()}'`)
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
    await this.create('Nominations', nominationToSubmit)
  }
}

const BNCAirtableSingleton = new BNCAirtable()
export default BNCAirtableSingleton

