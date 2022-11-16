const { ESLint } = require('eslint')

const removeIgnoredFiles = async (files) => {
  const eslint = new ESLint();
  const isIgnored = await Promise.all(
    files.map((file) => {
      return eslint.isPathIgnored(file);
    })
  );
  return files.filter((_, index) => !isIgnored[index]);
}

module.exports = {
  'adblock-betafish/**/*.js':async (files) => {
    const filesToLint = await removeIgnoredFiles(files);
    return [`eslint --max-warnings=0 ${filesToLint.join(' ')}`]
  },
  'adblock-betafish/**/*.{css,json,html}': files =>
    ['prettier --write ' + files.join(' ')]
}
