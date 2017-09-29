const request = require('superagent')

const endpoint_url = true
  ? 'https://now.justicedemocrats.com/api/signup'
  : 'http://localhost:4000/api/signup'

const formatPostalAddresses = address =>
  address
    ? address.city
      ? [
          {
            address_lines: [address.address1],
            locality: address.city,
            region: address.state,
            postal_code: address.zip
          }
        ]
      : address.zip
        ? [
            {
              address_lines: [],
              locality: null,
              region: null,
              postal_code: address.zip
            }
          ]
        : []
    : []

const createPerson = person =>
  new Promise((resolve, reject) => {
    const {
      name,
      email,
      phone,
      address,
      tags,
      tagsToRemove,
      utmSource,
      utmMedium,
      utmCampaign,
      profile,
      linkedin
    } = person

    const personSignupHelper = {
      person: {
        given_name: name ? name.split(' ')[0] : null,
        family_name: name ? name.split(' ')[1] : null,
        email_addresses: [{ address: email, subscribed: true, primary: true }],
        phone_numbers: [{ number: phone, primary: true }],
        postal_addresses: formatPostalAddresses(address),
        custom_fields: {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          profile: profile
        }
      },
      add_tags: tags,
      remove_tags: tagsToRemove
    }

    request.post(endpoint_url, personSignupHelper).end((err, res) => {
      if (err) reject(err)
      return resolve(res.body)
    })
  })

module.exports = { createPerson }
