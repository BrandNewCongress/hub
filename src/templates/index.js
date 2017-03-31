const path = require('path')
const fs = require('fs')

const StaticDirectory = path.join(process.cwd(), 'src/templates')
const statics = {}
fs.readdirSync(StaticDirectory).forEach((file) => {
  const fileParts = file.split('.')
  if (fileParts.pop() === 'mustache') {
    const staticFileName = fileParts.join('.')
    statics[staticFileName] = fs.readFileSync(path.join(StaticDirectory, file), 'utf-8')
  }
})

module.exports = statics
