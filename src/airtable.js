import Airtable from 'airtable'
import log from './log'
import { isEmpty } from './lib'

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
}

const BNCAirtableSingleton = new BNCAirtable()
export default BNCAirtableSingleton

