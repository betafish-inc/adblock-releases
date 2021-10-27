const { ESLint, Linter } = require('eslint')
let config = require('../.eslintrc.js')

/**@type {Linter.Config} */
module.exports = {
  ...config,
  root: true,
  globals: {
    browser: true,
    ...config.globals,
  },
}
