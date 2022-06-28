/* eslint-disable import/extensions */

export { createManifest, getManifestContent } from './manifest.mjs';
export { default as webpack } from './webpack.mjs';
export { default as mapping } from './mapping.mjs';
export {
  translations,
  chromeTranslations,
} from './translations.mjs';
export {
  addDevEnvVersion,
  addTestsPage,
} from './devenv.mjs';
export {
  default as sourceDistribution,
} from './sourceDistribution.mjs';
export { buildSnippets } from "./snippets-dependency.mjs";
export { buildAdBlockSnippets } from "./ab-snippets-dependency.mjs";

