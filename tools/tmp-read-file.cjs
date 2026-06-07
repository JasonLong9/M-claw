const fs = require('fs')
const file = process.argv[2]
if (!file) {
  console.error('missing file')
  process.exit(1)
}
console.log(fs.readFileSync(file, 'utf8'))
