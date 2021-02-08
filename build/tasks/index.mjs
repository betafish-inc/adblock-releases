/* eslint-disable import/extensions */

export { createManifest, getManifestContent } from './manifest.mjs';
export { default as webpack } from '../../adblockpluschrome/build/tasks/webpack.mjs';
export { default as mapping } from '../../adblockpluschrome/build/tasks/mapping.mjs';
export { translations, chromeTranslations } from '../../adblockpluschrome/build/tasks/translations.mjs';
export { addDevEnvVersion, addTestsPage } from '../../adblockpluschrome/build/tasks/devenv.mjs';
export { buildUI } from '../../adblockpluschrome/build/tasks/dependencies.mjs';
export { default as sourceDistribution } from '../../adblockpluschrome/build/tasks/sourceDistribution.mjs';
