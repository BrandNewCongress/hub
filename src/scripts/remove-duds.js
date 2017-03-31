const monk = require('monk')
const db = monk(process.env.MONGODB_URI)

const People = db.get('People')

const isGoodEval = async (id) => {
  console.log(`queing ${id}`)
  let count = await People.count({ evaluations: id })
  console.log(`did ${id}`)
  return count > 0
}

const main = async () => {
  const evaluations = await db.get('Nominee Evaluations').find()
  console.log(`Got ${evaluations.length} evaluations`)

  Promise.all(evaluations.map(e => isGoodEval(e.id)))
  .then(goodbad => {
    const bads = evaluations.filter((e, idx) => !goodbad[idx]).map(e => e.id)
    console.log(bads.length)
    console.log(bads)
    console.log(JSON.stringify(bads))
    console.log(bads.length)
  })
}

const bads = ['rec01G5TQaMSIYa7A', 'rec0G1IrIB3FEYxJ3', 'rec0jB2kk4tnRPAPZ', 'rec6BBZ9PhGQPrWFP', 'recIyBW29NpHlOYyb', 'recPFyzecuVxeLNYg', 'reccocGHoMJA85TkK', 'recpgitB66Fjn1bNZ', 'rec0qytbavdyAwDGe', 'recI8avIZLmoxv51I', 'recNDNfF4VtDxIewt',
  'recQ9WhtoQPBaN4By', 'recWXynPmgYKRo82V', 'reciOjNF2qwulPAx4', 'rec27ZxHnIA2PhD8u', 'rec2i4jmZFB4wFVal', 'rec3Fow36RXmpv4Id', 'rec3ZYmAJSXgVYENB', 'rec3aWnSH0NXdUGqm', 'rec42RiCbDPs7tu0X', 'rec4FeA41pnpNvlcP', 'rec4eqqvyxhTjtcqo', 'rec52qUpVLHq37zZI',
'rec5CE3kdpLgws2SL', 'rec5YSBQiNQ8AkC6q', 'rec5Yr9N3QKp6Nkpj', 'rec5ywdNahe3Yj4uH', 'rec6SOOkqR4MXi9Yk', 'rec7UyDp2g3SY9zYL', 'rec8QGmLLvpbBjZ03', 'rec8h8hiqXEjRsGa2', 'rec8rtmznvyukntwV', 'rec916HjU3hIvnE9c', 'rec9zm6MTsIzxEeYe', 'recA1o6xUkHwjwQOg',
'recA3HH7fsD2cydzZ', 'recAohBVcTv4yv24o', 'recBOuOwP9YsKD8dI', 'recBTH0suRPYnVdvp', 'recBWYngKRaTIgVRn', 'recCNrtzHdLJ813Cn', 'recCpsmPUbxrqqtm4', 'recCsVvg1WkPcNcme', 'recD6KoodQ49DvCMh', 'recDSbL97kKcidMOs', 'recDW5QGQQKjzIX41', 'recDWQwcaCylD8qxd', 'recDrblN9HEJHMdvI', 'recE1uXkvdiJqYXQN', 'recE6o1ZCLJK1Q6ze', 'recEEg8w8eYCcrTW9', 'recEqpx0xwRUwUkY3', 'recF3PMBZmF2Gsyor', 'recFBHDSLlosr5foZ', 'recFLrOIUBcmx9wq3', 'recFpGkYlSJifCHmi', 'recG8qG4EeR1ClDHf', 'recGI122s6RKbgOiX', 'recGMdEKUoTmDGXvs', 'recGPgl9cxnNSB7RB', 'recGQqAFUvDksPZZ4', 'recGUPTiT7g8vXgRr', 'recGwGcxrqdG0tfhg', 'recH76RkDSoiUqq1l', 'recHHAHh8vyG1hbaX', 'recHkKvnMgxhmYpZL', 'recIBoxrIWM9Ss0Z7', 'recIwkwTHYcomZh5p', 'recJDrUIDHTLax2vz', 'recJHczSfJjhMBk6p', 'recJNLOdzqPguZJPX', 'recJOTLgnOQP6NDPW', 'recJTBrptnx0QWabv', 'recKL1LAuSb0S7HmS', 'recKuakJ5WoTqWzvt', 'recL2jsKpacyq3FB9', 'recLDonFp2SIecjDv', 'recLEfDCOsHbI3KKK', 'recLJQ2uHyzwvQxSu', 'recLtXJOLjdHEAsHe', 'recLtmE6m3YW36liX', 'recLzTcKn7tBJjWIF', 'recMHVTG0sdKkytZA', 'recMcxLJv6tQXgf1J', 'recNEaU3VUfl7ld0s', 'recNXgpe64DTd3m8t', 'recO2pNMbAVC4Msh7', 'recOKvtJNmqH5HBYq', 'recOMtJXqh44FIkcn', 'recPII3MrnE8S4M1E', 'recPmZ3HJRYcI5ZzD', 'recPxOtjnLw6my2t5', 'recPylKssDjqvLgwq', 'recQAPhwPGYvgaEI6', 'recQYvL28Q2NCJM5U', 'recREElPTtRYdlyKd', 'recRek6xL3rGe2mD2', 'recRlZL7QvxowXXlS', 'recSBn7Wkkgt6cwBO', 'recSl7mkGGb5QP1Bb', 'recT8p9aOkTYYScnP', 'recTknNa9jnuUT6wj', 'recUsUtF12qJVzB2Z', 'recVDT20wJdMh5Ulh', 'recVLb72jip8kSYf6', 'recWIgbCBZivfU8lh', 'recWLzac3JFFNcZWj', 'recWqiHI7kDHpcmUC', 'recWxho78V6ajRADu', 'recXIw6dCJVyT7w63', 'recY8d3rx9AcE7kvf', 'recY9aCK5SsJQn1AI', 'recYRwLJoLKM278A4', 'recYzxF60QsgPi3UB', 'recZdkEnVBDLzcao2', 'recZqhgsCSsW3lzkK', 'recahBc5jHIweKHnQ', 'recbAG6mRzdlxFYjV', 'recbFaX54VH4rQ46a', 'recbUCHA5exxpnkzl', 'recbYs6atUQkMx1M7', 'recbieDycboJ6mwMS', 'recc6RZ0an8QLpiyK', 'reccn6s1EtPBIxX9f', 'reccrJf9HyJkXETsp', 'reccrcntLMyqlfFzU', 'recdVBRrDg4ZDSnvG', 'recdZz1eqSaX5cNSp', 'recdpREWvtaLpJLin', 'recdsJ7zXGgnF2dkV', 'recf1RQMP0B36ND31', 'recfAArnkokzOM1us', 'recfdu09URAPLQ3Mk', 'recfpV90jYYVnLPOX', 'recgLYEx2hh9YxEM7', 'recgSn5iRTgKrwtFL', 'rech5itQqwpobLLQx', 'reciKaUhlqDTemzYm', 'reciopEseol9ZiXqR', 'recj3SOEzlT0Rr8Pq', 'reckYw2MUogJdlODk', 'reckrtOvHTtEX5o2p', 'reckx3FNv7BZ5V4Wa', 'reclFgFayjfC0nu9L', 'reclecFxrmSglpetv', 'recmWUy5EdhPm4BRC', 'recnovoPOUIsIHtRB', 'recpJUrxon8GPpOVX', 'recq0eVvCrsP5OCQv', 'recqiLcJx0SSpgmHK', 'recr9XXbGFRoukKIs', 'recsTPwFvoPEkm1W4', 'recsZnc0ODht0TEyh', 'rectQ4tde6O5LF5WT', 'recudOhhuxBYQur9d', 'recvQukNd58blGs9s', 'recvYbr8t7FULV0kz', 'recxxDaQ0N2HSakqG', 'recySWg36MQ2dKIaO', 'recykstKZbXgNzYfZ', 'recyrYSqSqN95B6Ws', 'reczLSn1JUJ5U0YEa', 'reczNWwxrAJglaux7', 'reczQfnL1pbABTpo1', 'rec1yAeVE1KlcYHND', 'recAk8B2mMmbsEalp', 'recB6oEjzaVIiEhLZ', 'recUJEZPeqyhjs2us', 'recWkZ3EXSWth0DbZ', 'recmnm4fnwnDpjp7t', 'recne5IFn117eiOOh', 'recrIb6aom5m6uAHF', 'recuQTGjcJ9oj3t2B', 'recwEDZRWvKLJYjSA', 'recB4zlJUvXk3QHdL', 'recI3p9PKGfLe7H3F', 'recKFVE2PJNYwjyzM',
'recLcGoyjPGV7lusq', 'recOPsUocX34j5uXD', 'recUCrEwK11Nu29Bt', 'recUWD2izVRyHEVtV', 'recVN6FLNc1kU4iTF', 'recWrzlQX6g53PGch', 'recXMyIxejGhBSPMc', 'recYQsheZOimyvNk1', 'recYY1ofw6rQzZzHD', 'reccSduEljJW1i7oY', 'recfdV5wlu6nYDuS3', 'rechLiNjo1Cdv1wag', 'reclxSEQ0JAYWMWwo', 'recshcVkFHSTTYElb', 'recswzs2tMRORlN5i', 'rec2pnkKtJR0FGbXR', 'recQZB75dIOlKeUKp', 'recRWnKubS1x1xEab', 'recRn3o4X2ySYnlG5', 'recZOL2WzVSrb1mvz', 'recjNRLmPNpNOl9l1', 'recpsG7q3wb8bgNAu', 'recq30w28RDRtIdIp', 'recUlmzdHi1ngkiwP', 'recmw6HxN1Z25p05c', 'recuMA3FgsijipLTS', 'recKtp0bmsAhU0Xv9', 'recULs51AweimoMwy', 'reckPAkMEibKiHX7k', 'recqjCPUfK765QSwo', 'rec5ytHhf7L5SvBbt', 'recGdEeIyIBgtU97S', 'rec32fcdZvLl8bfBX', 'rec579vc8GeoX7xEk', 'rec8pMyT7E9qJG8I6', 'recHFcN7HHfeqp27d', 'recIZgsyiepe74lhE', 'recYxLiZyXQVIrsM3', 'recejDl93HWDKBnMG', 'reci9XTSB9IsJ64dv', 'recjO87WXe5Nugn55', 'recpfalhhS6DJnJl1', 'recr7avb0EPEFdoOo', 'rec9prd6v8KnzVG30', 'recCeK3Uu3ZekqmQq', 'recNvhrHEOSbq6HQJ', 'recQ1AsteKrmrclTK', 'recUyvL4kwVnQco86', 'recYz0ss1ydvIDqU7', 'recZUvjkKKZPZfaB8', 'recjouDe47chvzaky', 'recnvjRy8O8mhw2UL', 'reco9kY6x4ytkiH20', 'recosOkVqUAHNTkia', 'recs3Z0RdEiL3N74q', 'recsaTjDGm83rr93B', 'rectfkMjBmwxLvX5d', 'recuA5d1zXtjvfYtn', 'recv36141dm62OUsM', 'recwtxeKsEwz5HuSL', 'recyJys06jH9Q4zxs', 'rec2vRArwHfuF11R1', 'rec1UEXkxcu8zPjhq', 'recIpuzKPxjCIulId', 'rec5uKW7LhN5AjVSG', 'recROMhuFbw9STroR', 'reclDV1n9lIf66Cza', 'recmNNjyybjZP7zFI', 'recS7NvkhlgT6xhcP', 'recVhmH6BxwqsWKgM', 'recfHVhmqwRTvqCFe', 'rec8SHQ5rlicA8QYb']

db.get('Nominee Evaluations').count({ id: { $in: bads } })
.then(console.log).catch(console.log)
