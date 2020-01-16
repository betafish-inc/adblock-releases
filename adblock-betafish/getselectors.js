/** @module adblock-betafish/getselectors */

/** call by the data collection content script, and if the user has myadblock enabled */

/*
  inspired by the code in this module:
    https://github.com/adblockplus/adblockpluschrome/blob/master/lib/contentFiltering.js#L248
*/

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global require, */

const {
  elemHide,
  createStyleSheet,
  rulesFromStyleSheet,
} = require('elemHide');
const { RegExpFilter } = require('filterClasses');
const { elemHideEmulation } = require('elemHideEmulation');
const { checkWhitelisted } = require('whitelisting');
const { extractHostFromFrame } = require('url');
const { port } = require('messaging');

port.on('getSelectors', (_message, sender) => {
  let selectors = [];
  let exceptions = [];
  const emulatedPatterns = [];

  if (!checkWhitelisted(sender.page, sender.frame, null,
    RegExpFilter.typeMap.DOCUMENT || RegExpFilter.typeMap.ELEMHIDE)) {
    const hostname = extractHostFromFrame(sender.frame);
    const specificOnly = checkWhitelisted(sender.page, sender.frame, null,
      RegExpFilter.typeMap.GENERICHIDE);

    ({ selectors, exceptions } = elemHide.generateStyleSheetForDomain(
      hostname,
      specificOnly ? elemHide.SPECIFIC_ONLY : elemHide.ALL_MATCHING,
      true, true,
    ));

    for (const filter of elemHideEmulation.getRulesForDomain(hostname)) {
      emulatedPatterns.push({ selector: filter.selector, text: filter.text });
    }
  }

  const response = { emulatedPatterns, selectors, exceptions };

  return response;
});
