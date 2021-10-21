/* eslint-disable import/extensions */

export { createManifest, getManifestContent } from './manifest.mjs'
export { default as webpack } from './webpack.mjs'
export { default as mapping } from './mapping.mjs'
export {
  translations,
  chromeTranslations,
} from '../../adblockplusui/adblockpluschrome/build/tasks/translations.js'
export {
  addDevEnvVersion,
  addUnitTestsPage,
} from '../../adblockplusui/adblockpluschrome/build/tasks/devenv.js'
export { default as sourceDistribution } from './sourceDistribution.mjs'
export { buildSnippets } from './snippets-dependency.mjs'
