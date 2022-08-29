const { ESLint } = require('eslint')

const esLint = new ESLint({})

module.exports = {
  'adblock-betafish/**/*.js': files =>
    ['eslint --fix --max-warnings=0 ' + files.filter(file => !esLint.isPathIgnored(file)).join(' ')],
  'adblock-betafish/**/*.{css,json,html}': files =>
    ['prettier --write ' + files.join(' ')]
}
