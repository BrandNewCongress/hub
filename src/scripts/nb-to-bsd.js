const bsdConstructor = require('../bsd')
const nationbuilder = require('../nationbuilder') 
const moment = require('moment')
const log = require('../log')

const bsd = new bsdConstructor(process.env.BSD_HOST, process.env.BSD_ID, process.env.BSD_SECRET)
const REFRESH_CONS_GROUPS = false
async function sync() {
  let tagResults = await nationbuilder.makeRequest('GET', 'tags', { params: { limit: 100 } })
  let allTags = []
  while (tagResults.data.next) {
    log.info('Getting tags...')
    const tags = tagResults.data.results
    allTags = allTags.concat(tags.map((tag) => tag.name))
    const next = tagResults.data.next.split('?')    
    tagResults = await nationbuilder.makeRequest('GET', tagResults.data.next, { params: { limit: 100 } })
  }
  const notFoundTags = []
  allTags.forEach((tag) => {
    let found = false
    Object.keys(TagMap).forEach((currentTag) => {
      if (currentTag === tag) {
        found = true
      }
    })
    if (found === false) {
      throw new Error(`TAG NOT FOUND, CANNOT SYNC: ${tag}`)
    }
  })

  if (REFRESH_CONS_GROUPS) {
    let allConsGroups = Object.keys(TagMap).map((tag) => TagMap[tag])
      .filter((ele) => ele !== null)
    allConsGroups = allConsGroups.filter((ele, pos) => allConsGroups.indexOf(ele) === pos)
    const groupsToCreate = []
    const groups = {}
    for (let index = 0; index < allConsGroups.length; index++) {
      const group = await bsd.getConstituentGroupByName(allConsGroups[index])
      if (group === null) {
        groupsToCreate.push(allConsGroups[index])
      } else {
        groups[group.name] = group.cons_group_id
      }
    }
    for (let index = 0; index < groupsToCreate.length; index++) {
      const group = groupsToCreate[index]
      await bsd.createConstituentGroups([group])
    }
  }

  // SYNC PEOPLE
  let results = await nationbuilder.makeRequest('GET', 'people/search', { params: { limit: 100 , updated_since: moment('2017-06-09').toISOString()}})//
  const peopleRecords = []

  let count = 0
  while (results.data.next) {
    log.info(`Processing results: ${count}...`)
    const people = results.data.results
    const length = people.length
    for (let index = 0; index < length; index++) {
      const person = people[index]
      if (person.tags.length === 1 && person.tags[0].name === 'Supporter') {
        person.tags = ['Source: Brand New Congress']
      }
      let consGroups = person.tags.map((tag) => TagMap[tag])
        .filter((ele) => ele !== null)
      consGroups = consGroups.filter((ele, pos) => consGroups.indexOf(ele) === pos)
      consGroups = consGroups.map((group) => consGroupIdMap[group])
        .map((group) => ({ id: group }))
      if (person.email && consGroups.length > 0) {
        const names = person.first_name.split(' ')
        const address = person.primary_address
        const consData = {
          firstname: names[0] || null,
          middlename: names[1] || null,
          lastname: person.last_name,
          create_dt: person.created_at,
          gender: person.sex,
          ext_id: person.id,
          ext_type: 'nationbuilder',
          employer: person.employer,
          occupation: person.occupation,
          cons_email: {
            email: person.email,
            is_subscribed: person.email_opt_in ? 1 : 0,
            is_primary: 1
          }
        }
        if (address) {
          consData.cons_addr = [{
            addr1: address.address1,
            addr2: address.address2,
            city: address.city,
            state_cd: address.state,
            zip: address.zip,
            country: address.country_code
          }]
        }
        const phones = []
        if (person.mobile) {
          phones.push({
            phone: person.mobile,
            phone_type: 'mobile',
            is_primary: 1
          })
        }

        if (person.phone) {
          phones.push({
            phone: person.phone,
            phone_type: 'home',
            is_primary: person.mobile ? 0 : 1
          })
        }
        if (phones.length > 0) {
          consData.cons_phone = phones
        }
        consData.cons_group = consGroups
        await bsd.setConstituentData(consData)
      }
    }
    const next = results.data.next.split('?')    
    results = await nationbuilder.makeRequest('GET', results.data.next, { params: { limit: 100 } })
    count = count + 100
    break
  }

  // SYNC EVENTS
}

const TagMap = {
  'Alexandria Ocasio-Cortez': 'Signup: Alexandria Ocasio-Cortez',
  'available-0-5': 'Available: 0-5 Hours',
  'available-10-20': 'Available: 10-20 Hours',
  'available-20-30': 'Available: 20-30 Hours',
  'available-30': 'Available: 30+ Hours',
  'available-5-10': 'Available: 5-10 Hours',
  'CC-Nomination': 'Action: Attended CC: Nomination',
  'CC-Orientation': 'Action: Attended CC: Orientation',
  'CC-#Research': 'Action: Attended CC: Research',
  'CC-#SocialMedia': 'Action: Attended CC: Social Media',
  'CC-SOTBNC': 'Action: Attended CC: State of BNC',
  'CC-#Support': 'Action: Attended CC: Help Desk',
  'cc-tempHost': 'Action: Attended CC: Event Host',
  'coding': 'Skill: Programming',
  'corbin_editor': 'Skill: Video',
  'Data Entry': 'Skill: Data Entry',
  'e - Oakland - CA - 20160824 - Attended': 'Action: Attended Event: 2016/08/24 @ Oakland, CA ',
  'e - Olympia - WA - 20160722 - Attended': 'Action: Attended Event: 2016/07/22 @ Olympia, WA',
  'e - Omaha - NE - 20160711 - Attended': 'Action: Attended Event: 2016/07/11 @ Omaha, NE',
  'e - Orlando - FL - 20160629 - Attended': 'Action: Attended Event: 2016/06/29 @ Orlando, FL',
  'e - Overland Park - KS - 20160711 - Attended': 'Action: Attended Event: 2016/07/11 @ Overland Park, KS',
  'e - Philadelphia - PA - 20160723 - Attended': 'Action: Attended Event: 2016/07/23 @ Philadelphia, PA',
  'e - Pittsburgh - PA - 20160820 - Attended': 'Action: Attended Event: 2016/08/20 @ Pittsburgh, PA',
  'e - Providence - RI - 20160814 - Attended': 'Action: Attended Event: 2016/08/14 @ Providence, RI',
  'e - Raleigh - NC - 20160604 - Attended': 'Action: Attended Event: 2016/06/04 @ Raleigh, NC',
  'e - Rochester - NY - 20160811 - Attended': 'Action: Attended Event: 2016/08/11 @ Rochester, NY',
  'e - Sacramento - CA - 20160825 - Attended': 'Action: Attended Event: 2016/08/25 @ Sacramento, CA',
  'e - Salt Lake City - UT - 20160724 - Attended': 'Action: Attended Event: 2016/07/24 @ Salt Lake City, UT',
  'e - San Antonio - TX - 20160701 - Attended': 'Action: Attended Event: 2016/07/01 @ San Antonio, TX',
  'e - San Bernardino - CA - 20160614 - Attended': 'Action: Attended Event: 2016/06/14 @ San Bernardino, CA',
  'e - San Diego - CA - 20160826 - Attended': 'Action: Attended Event: 2016/08/26 @ San Diego, CA',
  'e - San Francisco - CA - 20160823 - Attended': 'Action: Attended Event: 2016/08/23 @ San Francisco, CA',
  'e - San Jose - CA - 20160822 - Attended': 'Action: Attended Event: 2016/08/22 @ San Jose, CA',
  'e - Santa Ana - CA - 20160719 - Attended': 'Action: Attended Event: 2016/07/19 @ Santa Ana, CA',
  'e - Santa Barbara - CA - 20160827 - Attended': 'Action: Attended Event: 2016/08/27 @ Santa Barbara, CA',
  'e - Savannah - GA - 20160711 - Attended': 'Action: Attended Event: 2016/07/11 @ Savannah, GA',
  'e - Seattle - WA - 20160720 - Attended': 'Action: Attended Event: 2016/07/20 @ Seattle, WA',
  'e - Sioux Falls - SD - 20160712 - Attended': 'Action: Attended Event: 2016/07/12 @ Sioux Falls, SD',
  'e - Spokane - WA - 20160812 - Attended': 'Action: Attended Event: 2016/08/12 @ Spokane, WA',
  'e - Stamford - CT - 20160626 - Attended': 'Action: Attended Event: 2016/06/26 @ Stamford, CT',
  'e - Syracuse - NY - 20160809 - Attended': 'Action: Attended Event: 2016/08/09 @ Syracuse, NY',
  'e - Tacoma - WA - 20160721 - Attended': 'Action: Attended Event: 2016/07/21 @ Tacoma, WA',
  'e - Tampa - FL - 20160628 - Attended': 'Action: Attended Event: 2016/06/28 @ Tampa, FL',
  'e - TX - Dallas - TX - 20160628 - Attended': 'Action: Attended Event: 2016/06/28 @ Dallas, TX',
  'Event Attended': 'Action: Attended Event',
  'Events Coordinator': 'Skill: Event Host',
  'e-volhost': 'Action: Hosted Event',
  'e - Washington DC - DC - 20160730 - Attended': 'Action: Attended Event: 2016/07/30 @ Washington, DC',
  'e - Worcester - MA - 20160806 - Attended': 'Action: Attended Event: 2016/08/06 @ Worcester, MA',
  'frequency-week-days': 'Availability: Week Days',
  'frequency-weekends': 'Availability: Weekends',
  'frequency-week-nights': 'Availability: Week Nights',
  'Graphic Design': 'Skill: Graphic Design',
  'graphics': 'Skill: Graphic Design',
  'helpdesk': 'Skill: Help Desk',
  'local-leader': 'Skill: Start Local Group',
  'muslim_ban_petition': 'Petition: Muslim Ban',
  'NB Administrator': 'Skill: Nationbuilder',
  'nominator': 'Action: Nominated Candidate',
  'nominee': 'Candidate Nominee',
  'photography': 'Skill: Photography',
  'potential-leader': 'Potential Leader',
  'printing service': 'Skill: Printing',
  'Process Engineer': 'Skill: Process Engineer',
  'programming': 'Skill: Programming',
  'q-standout': 'Potential Leader',
  'research': 'Skill: Research',
  'Ryan Stone': 'Signup: Ryan Stone',
  'Signed: Draft Cori Bush': 'Petition: Draft Cori Bush',
  'Signed: Kick out Joe Manchin': 'Petition: Kick out Joe Manchin',
  'Signed: Letter to Keith Ellison': 'Petition: Letter to Keith Ellison',
  'Signed: Medicare for All': 'Petition: Medicare for All',
  'Signed: Syrian War': 'Petition: Syrian War',
  'skill-call': 'Skill: Calling',
  'skill-calling': 'Skill: Calling',
  'skill-data entry': 'Skill: Data Entry',
  'skill-data-entry': 'Skill: Data Entry',
  'skill-event-host': 'Skill: Event Host',
  'skill-field-digital': 'Skill: Field Outreach',
  'skill-field-outreach': 'Skill: Field Outreach',
  'skill-flyer handout': 'Skill: Flyering',
  'skill-graphic-design': 'Skill: Graphic Design',
  'skill-helpdesk': 'Skill: Help Desk',
  'skill-host door knock': 'Skill: Door Knocking',
  'skill-host house party': 'Skill: Event Host',
  'skill-hr': 'Skill: HR',
  'skill-Join local group': 'Skill: Start Local Group',
  'skill-knock doors': 'Skill: Door Knocking',
  'skill-legal': 'Skill: Legal',
  'skill-manage-communities': 'Skill: Community Management',
  'skill-nationbuilder': 'Skill; Nationbuilder',
  'skill-office help': 'Skill: Office Help',
  'skill-photo': 'Skill: Photography',
  'skill-press': 'Skill: Press',
  'skill-printing': 'Skill: Printing',
  'skill-programming': 'Skill: Programming',
  'skill-research': 'Skill: Research',
  'skill-send texts': 'Skill: Texting',
  'skill-sharing': 'Skill: Social Media Sharing',
  'skill-sm-sharing': 'Skill: Social Media Sharing',
  'skill-speak to groups': 'Skill: Speaker',
  'skill-supporter-housing': 'Skill: Supporter Housing',
  'skill-travel': 'Skill: Travel Management',
  'skill-venue': 'Skill: Event Venue',
  'skill-venue-access': 'Skill: Event Venue',
  'skill-video': 'Skill: Video',
  'skill-web-design': 'Skill: Web Design',
  'skill-writing': 'Skill: Writing',
  'Social Media': 'Skill: Social Media',
  'Source: Adrienne Bell': 'Signup: Adrienne Bell',
  'Donor: Adrienne Bell': 'Donor: Adrienne Bell',
  'Source: Alexandria Ocasio-Cortez': 'Signup: Alexandria Ocasio-Cortez',
  'Donor: Alexandria Ocasio-Cortez': 'Donor: Alexandria Ocasio-Cortez',
  'Source: Anthony Clark': 'Signup: Anthony Clark',
  'Donor: Anthony Clark': 'Donor: Anthony Clark',
  'Source: Brand New Congress': 'Signup: Brand New Congress',
  'Donor: Brand New Congress': 'Donor: Brand New Congress',
  'Source: Chardo Richardson': 'Signup: Chardo Richardson',
  'Donor: Chardo Richardson': 'Donor: Chardo Richardson',
  'Source: Cori Bush': 'Signup: Cori Bush',
  'Donor: Cori Bush': 'Donor: Cori Bush',
  'Source: Danny Ellyson': 'Signup: Danny Ellyson',
  'Donor: Danny Ellyson': 'Donor: Danny Ellyson',
  'Source: Demond Drummer': 'Signup: Demond Drummer',
  'Donor: Demond Drummer': 'Donor: Demond Drummer',
  'Source: Eric Terrell': 'Signup: Eric Terrell',
  'Donor: Eric Terrell': 'Donor: Eric Terrell',
  'Source: Facebook': 'Source: Facebook',
  'Source: Hector Morales': 'Signup: Hector Morales',
  'Donor: Hector Morales': 'Donor: Hector Morales',
  'SOURCE: Incoming Call on Campaign Line': 'Source: Incoming Call',
  'Source: Incoming Call on Campaign Line': 'Source: Incoming Call',
  'Source: Justice Democrats': 'Signup: Justice Democrats',
  'Donor: Justice Democrats': 'Donor: Justice Democrats',
  'Source: Letitia Plummer': 'Signup: Letitia Plummer',
  'Donor: Letitia Plummer': 'Donor: Letitia Plummer',
  'Source: Michael Hepburn': 'Signup: Michael Hepburn',
  'Donor: Michael Hepburn': 'Donor: Michael Hepburn',
  'Source: Paula Jean': 'Signup: Paula Jean Swearengin',
  'Source: Paula Jean Swearengin': 'Signup: Paula Jean Swearengin',
  'Donor: Paula Jean Swearengin': 'Donor: Paula Jean Swearengin',
  'Source: Paul Perry': 'Signup: Paul Perry',
  'Donor: Paul Perry': 'Donor: Paul Perry',
  'Source: Richard Rice': 'Signup: Richard Rice',
  'Donor: Richard Rice': 'Donor: Richard Rice',
  'Source: Robb Ryerse': 'Signup: Robb Ryerse',
  'Donor: Robb Ryerse': 'Donor: Robb Ryerse',
  'Source: Rob Ryerse': 'Signup: Robb Ryerse',
  'Source: Ryan Stone': 'Signup: Ryan Stone',
  'Donor: Ryan Stone': 'Donor: Ryan Stone',
  'Source: Sarah Smith': 'Signup: Sarah Smith',
  'Donor: Sarah Smith': 'Donor: Sarah Smith',
  'Source: Tamarah Begay': 'Signup: Tamarah Begay',
  'Donor: Tamarah Begay': 'Donor: Tamarah Begay',
  'SOURCE: Text message received': 'Source: Incoming Text Message',
  'Source: Text message received': 'Source: Incoming Text Message',
  'Source Twitter': 'Source: Twitter',
  'Source: Twitter': 'Source: Twitter',
  'MO01-430_launch_attend': 'Action: Attended Event: 4/30/2017 @ St. Louis, MO',
  't-legal': 'Skill: Legal',
  'Tech': 'Skill: Programming',  
  'Tour_Atlanta_Attendees': 'Action: Attended Event',
  'Tour_Bridgeport_Attendees': 'Action: Attended Event',
  'Tour_Chattanooga_Attendees': 'Action: Attended Event',
  'Tour_Memphis_Attendees': 'Action: Attended Event',
  'Tour_Nashville_Attendees': 'Action: Attended Event',
  'Tour_Orlando_Attendees': 'Action: Attended Event',
  'Tour_Stamford_Attendees': 'Action: Attended Event',
  'Tour_Tampa_Attendees': 'Action: Attended Event',
  'travel': 'Skill: Travel Management',
  'Travel Coordinator': 'Skill: Travel Management',
  'venue': 'Skill: Event Venue',
  'HD-checkMEout': 'Signup: Brand New Congress',
  'hd -donation': 'Signup: Brand New Congress',
  'HD - Email blast': 'Signup: Brand New Congress',
  'HD - Local organizing': 'Signup: Brand New Congress',
  'HD(metrics) - candidate': 'Signup: Brand New Congress',
  'HD(metrics) - feedback-negative': 'Signup: Brand New Congress',
  'HD(metrics) - feedback-positive': 'Signup: Brand New Congress',
  'HD(metrics) - involvement': 'Signup: Brand New Congress',
  'HD(metrics) - policy': 'Signup: Brand New Congress',
  'HD(metrics) - question': 'Signup: Brand New Congress',
  'HD(metrics) - reroute': 'Signup: Brand New Congress',
  'HD(metrics) - technical issue': 'Signup: Brand New Congress',
  'HD - MyAwesomeProject': 'Signup: Brand New Congress',
  'hd-myidea': 'Signup: Brand New Congress',
  'HD - Rant': 'Signup: Brand New Congress',
  'HD - Skills': 'Signup: Brand New Congress',
  'HD - Spam': 'Signup: Brand New Congress',
  'HD - STANDOUT! volunteer': 'Signup: Brand New Congress',
  'HD - VIP': 'Signup: Brand New Congress',
  'HD - Wiki/District info': 'Signup: Brand New Congress',
  'mo01-17_05_06_cinco': 'Action: Attended Event: 2017/05/06 @ St. Louis, MO',
  'mo01-17_05_07_beertree': 'Action: Attended Event: 2017/05/07 @ St. Louis, MO',
  'mo01-17_05_13_78jobfair': 'Action: Attended Event: 2017/05/13 @ St. Louis, MO',
  'mo01-5-3_riffraff_signup': 'Action: Attended Event: 2017/05/03 @ St. Louis, MO',
  'networker': 'Signup: Brand New Congress',
  'new-test': 'Signup: Brand New Congress',
  'NLL': 'Signup: Brand New Congress',
  'Office-suggestion': 'Signup: Brand New Congress',
  'Omaha': 'Signup: Brand New Congress',
  'Orient': 'Signup: Brand New Congress',
  'pa': 'Signup: Brand New Congress',
  'Path:Events:Step:Attended': 'Signup: Brand New Congress',
  'Path:Events:Step:Registered': 'Signup: Brand New Congress',
  'Path:Team-Support:Step:Trial': 'Signup: Brand New Congress',
  'potentialdonor': 'Signup: Brand New Congress',
  'potentialdonor-recurring': 'Signup: Brand New Congress',
  'potential-partner': 'Signup: Brand New Congress',
  'Procurement Specialist': 'Signup: Brand New Congress',
  'programming_ helpdesk': 'Skill: Programming',
  'Research_book': 'Skill: Research',
  'resume': 'Signup: Brand New Congress',
  'RFSE': 'Signup: Brand New Congress',
  's-BernieBuilders': 'Signup: Brand New Congress',
  'Signup': 'Signup: Brand New Congress',
  'signup-nb': 'Signup: Brand New Congress',
  'skill-donate monthly': 'Signup: Brand New Congress',
  'Source: Chardo Richardon': 'Signup: Chardo Richardson',
  'special skills': 'Signup: Brand New Congress',
  'still-host phone/text bank': 'Skill: Event Host',
  's-TNforBernie': 'Signup: Brand New Congress',
  'suggestion-partnership': 'Signup: Brand New Congress',
  'suggestion - platform': 'Signup: Brand New Congress',
  's-WAforBernie': 'Signup: Brand New Congress',
  'international-mexico': 'Signup: Brand New Congress',
  'Invite-Liam': 'Signup: Brand New Congress',
  'local-events': 'Signup: Brand New Congress',
  'local organizer': 'Signup: Brand New Congress',
  'l - Spanish': 'Signup: Brand New Congress',
  'NC-temp': 'Signup: Brand New Congress',
  'negative': 'Signup: Brand New Congress',
  'news': 'Signup: Brand New Congress',
  'Alabama_Press_List': null,
  'Alaska_Press_List': null,
  'Arkansas_Press_List': null,
  'California_Press_List': null,
  'Colorado_Press_List': null,
  'Community Newspaper': null,
  'Connecticut_Press_List': null,
  'Daily Newspaper': null,
  'Daily Newspaper Bureau': null,
  'Delaware_Press_List': null,
  'Florida_Press_List': null,
  'Georgia_Press_List': null,
  'ID: MO01 - 1 - Strong Support': null,
  'ID: MO01 - 2 - Lean Support': null,
  'ID: MO01 - 3 - Undecided': null,
  'ID: MO01 - 4 - Lean Opponent': null,
  'ID: MO01 - 5 - Strong Opponent': null,
  'ID: MO01 - 8 - Not Voting': null,
  'ID: MO01 - Have ID': null,
  'Magazine': null,
  'Magazine Bureau': null,
  'medicare': null,
  'mo01-Brendans_friends': null,
  'MO01_bz_contact_only': null,
  'MO01-No_to_rally': null,
  'MO01-Yes_to_rally': null,
  'movoters:MO-Federal-1 - 04/20/2017 14:15:34:439': null,
  'National_Press_List': null,
  'NEIGHBORHOOD: 10th Ward': null,
  'NEIGHBORHOOD: 27th Ward': null,
  'NEIGHBORHOOD: 3rd Ward': null,
  'NEIGHBORHOOD: Afton': null,
  'NEIGHBORHOOD: Arnold': null,
  'NEIGHBORHOOD: Benton Park West': null,
  'NEIGHBORHOOD: Bevo': null,
  'NEIGHBORHOOD: Carondelet': null,
  'NEIGHBORHOOD: Central West End': null,
  'NEIGHBORHOOD: Cherokee': null,
  'NEIGHBORHOOD: Columbia': null,
  'NEIGHBORHOOD: DeMun/Clayton near Skinker': null,
  'NEIGHBORHOOD: Dogtown': null,
  'NEIGHBORHOOD: Downtown': null,
  'NEIGHBORHOOD: Ferguson': null,
  'NEIGHBORHOOD: Florissant': null,
  'NEIGHBORHOOD: Forest Park SE': null,
  'NEIGHBORHOOD: Glendale': null,
  'NEIGHBORHOOD: Gravois Park': null,
  'NEIGHBORHOOD: Independence': null,
  'NEIGHBORHOOD: Jennings': null,
  'NEIGHBORHOOD: Kirkwood': null,
  'NEIGHBORHOOD: Lebanon': null,
  'NEIGHBORHOOD: Mackenzie Hills': null,
  'NEIGHBORHOOD: Maplewood': null,
  'NEIGHBORHOOD: Marine Villa': null,
  'NEIGHBORHOOD: Maryland Heights': null,
  'NEIGHBORHOOD: Midtown': null,
  'NEIGHBORHOOD: Old North': null,
  'NEIGHBORHOOD: Overland': null,
  'NEIGHBORHOOD: Richmond Heights': null,
  'NEIGHBORHOOD: Rock Hill': null,
  'NEIGHBORHOOD: Rolla': null,
  'NEIGHBORHOOD: Shaw': null,
  'NEIGHBORHOOD: Southwest Gardens': null,
  'NEIGHBORHOOD: Springfield': null,
  'NEIGHBORHOOD: St_ Charles': null,
  'NEIGHBORHOOD: St_ Louis Place': null,
  'NEIGHBORHOOD: The Hill': null,
  'NEIGHBORHOOD: Tower Grove East': null,
  'NEIGHBORHOOD: Tower Grove South': null,
  'NEIGHBORHOOD: U City': null,
  'NEIGHBORHOOD: Valley Park': null,
  'NEIGHBORHOOD: Walnut Park East': null,
  'NEIGHBORHOOD: West County': null,
  'orlando_press': null,
  'Paula_Swearengin_national': null,
  'press': null,
  'press-hotlist': null,
  'press-hotlist+tyt': null,
  'stl_press': null,
  'Supporter': null,
  'Texas_Press_List': null,
  'text_opt_out': null
}

const consGroupIdMap = { 
  'Signup: Alexandria Ocasio-Cortez': '14',
  'Available: 0-5 Hours': '33',
  'Available: 10-20 Hours': '34',
  'Available: 20-30 Hours': '35',
  'Available: 30+ Hours': '36',
  'Available: 5-10 Hours': '37',
  'Action: Attended CC: Nomination': '27',
  'Action: Attended CC: Orientation': '38',
  'Action: Attended CC: Research': '39',
  'Action: Attended CC: Social Media': '40',
  'Action: Attended CC: State of BNC': '41',
  'Action: Attended CC: Help Desk': '42',
  'Action: Attended CC: Event Host': '43',
  'Skill: Programming': '44',
  'Skill: Video': '45',
  'Skill: Data Entry': '46',
  'Action: Attended Event: 2016/08/24 @ Oakland, CA': '47',
  'Action: Attended Event: 2016/07/22 @ Olympia, WA': '48',
  'Action: Attended Event: 2016/07/11 @ Omaha, NE': '49',
  'Action: Attended Event: 2016/06/29 @ Orlando, FL': '50',
  'Action: Attended Event: 2016/07/11 @ Overland Park, KS': '51',
  'Action: Attended Event: 2016/07/23 @ Philadelphia, PA': '52',
  'Action: Attended Event: 2016/08/20 @ Pittsburgh, PA': '53',
  'Action: Attended Event: 2016/08/14 @ Providence, RI': '54',
  'Action: Attended Event: 2016/06/04 @ Raleigh, NC': '55',
  'Action: Attended Event: 2016/08/11 @ Rochester, NY': '56',
  'Action: Attended Event: 2016/08/25 @ Sacramento, CA': '57',
  'Action: Attended Event: 2016/07/24 @ Salt Lake City, UT': '58',
  'Action: Attended Event: 2016/07/01 @ San Antonio, TX': '59',
  'Action: Attended Event: 2016/06/14 @ San Bernardino, CA': '60',
  'Action: Attended Event: 2016/08/26 @ San Diego, CA': '61',
  'Action: Attended Event: 2016/08/23 @ San Francisco, CA': '62',
  'Action: Attended Event: 2016/08/22 @ San Jose, CA': '63',
  'Action: Attended Event: 2016/07/19 @ Santa Ana, CA': '64',
  'Action: Attended Event: 2016/08/27 @ Santa Barbara, CA': '65',
  'Action: Attended Event: 2016/07/11 @ Savannah, GA': '66',
  'Action: Attended Event: 2016/07/20 @ Seattle, WA': '67',
  'Action: Attended Event: 2016/07/12 @ Sioux Falls, SD': '68',
  'Action: Attended Event: 2016/08/12 @ Spokane, WA': '69',
  'Action: Attended Event: 2016/06/26 @ Stamford, CT': '70',
  'Action: Attended Event: 2016/08/09 @ Syracuse, NY': '71',
  'Action: Attended Event: 2016/07/21 @ Tacoma, WA': '72',
  'Action: Attended Event: 2016/06/28 @ Tampa, FL': '73',
  'Action: Attended Event: 2016/06/28 @ Dallas, TX': '74',
  'Action: Attended Event': '75',
  'Skill: Event Host': '76',
  'Action: Hosted Event': '77',
  'Action: Attended Event: 2016/07/30 @ Washington, DC': '78',
  'Action: Attended Event: 2016/08/06 @ Worcester, MA': '79',
  'Availability: Week Days': '80',
  'Availability: Weekends': '81',
  'Availability: Week Nights': '82',
  'Skill: Graphic Design': '83',
  'Skill: Help Desk': '84',
  'Skill: Start Local Group': '85',
  'Petition: Muslim Ban': '86',
  'Skill: Nationbuilder': '87',
  'Action: Nominated Candidate': '88',
  'Candidate Nominee': '89',
  'Skill: Photography': '90',
  'Potential Leader': '91',
  'Skill: Printing': '92',
  'Skill: Process Engineer': '93',
  'Skill: Research': '94',
  'Signup: Ryan Stone': '20',
  'Petition: Draft Cori Bush': '95',
  'Petition: Kick out Joe Manchin': '96',
  'Petition: Letter to Keith Ellison': '97',
  'Petition: Medicare for All': '98',
  'Petition: Syrian War': '99',
  'Skill: Calling': '100',
  'Skill: Field Outreach': '101',
  'Skill: Flyering': '102',
  'Skill: Door Knocking': '103',
  'Skill: HR': '104',
  'Skill: Legal': '105',
  'Skill: Community Management': '106',
  'Skill; Nationbuilder': '107',
  'Skill: Office Help': '108',
  'Skill: Press': '109',
  'Skill: Texting': '110',
  'Skill: Social Media Sharing': '111',
  'Skill: Speaker': '112',
  'Skill: Supporter Housing': '113',
  'Skill: Travel Management': '114',
  'Skill: Event Venue': '115',
  'Skill: Web Design': '116',
  'Skill: Writing': '117',
  'Skill: Social Media': '118',
  'Signup: Adrienne Bell': '17',
  'Donor: Adrienne Bell': '119',
  'Donor: Alexandria Ocasio-Cortez': '120',
  'Signup: Anthony Clark': '18',
  'Donor: Anthony Clark': '121',
  'Signup: Brand New Congress': '11',
  'Donor: Brand New Congress': '122',
  'Signup: Chardo Richardson': '23',
  'Donor: Chardo Richardson': '123',
  'Signup: Cori Bush': '12',
  'Donor: Cori Bush': '124',
  'Signup: Danny Ellyson': '21',
  'Donor: Danny Ellyson': '125',
  'Signup: Demond Drummer': '126',
  'Donor: Demond Drummer': '127',
  'Signup: Eric Terrell': '128',
  'Donor: Eric Terrell': '129',
  'Source: Facebook': '130',
  'Signup: Hector Morales': '24',
  'Donor: Hector Morales': '131',
  'Source: Incoming Call': '132',
  'Signup: Justice Democrats': '10',
  'Donor: Justice Democrats': '133',
  'Signup: Letitia Plummer': '22',
  'Donor: Letitia Plummer': '134',
  'Signup: Michael Hepburn': '135',
  'Donor: Michael Hepburn': '136',
  'Signup: Paula Jean Swearengin': '13',
  'Donor: Paula Jean Swearengin': '137',
  'Signup: Paul Perry': '25',
  'Donor: Paul Perry': '138',
  'Signup: Richard Rice': '26',
  'Donor: Richard Rice': '139',
  'Signup: Robb Ryerse': '15',
  'Donor: Robb Ryerse': '140',
  'Donor: Ryan Stone': '141',
  'Signup: Sarah Smith': '19',
  'Donor: Sarah Smith': '142',
  'Signup: Tamarah Begay': '143',
  'Donor: Tamarah Begay': '144',
  'Source: Incoming Text Message': '145',
  'Source: Twitter': '146',
  'Action: Attended Event: 4/30/2017 @ St. Louis, MO': '32',
  'Action: Attended Event: 2017/05/06 @ St. Louis, MO': '31',
  'Action: Attended Event: 2017/05/07 @ St. Louis, MO': '30',
  'Action: Attended Event: 2017/05/13 @ St. Louis, MO': '29',
  'Action: Attended Event: 2017/05/03 @ St. Louis, MO': '28' 
}

sync().catch((ex) => console.log(ex))
