/** @module adblock-betafish/getselectors */

/** call by the data collection content script, and if the user has myadblock enabled */

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global require, */

const { ElemHide } = require('elemHide');
const { RegExpFilter } = require('filterClasses');
const { ElemHideEmulation } = require('elemHideEmulation');
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

    ({ selectors, exceptions } = ElemHide.generateStyleSheetForDomain(
      hostname,
      specificOnly ? ElemHide.SPECIFIC_ONLY : ElemHide.ALL_MATCHING,
      true, true,
    ));

    for (const filter of ElemHideEmulation.getRulesForDomain(hostname)) {
      emulatedPatterns.push({ selector: filter.selector, text: filter.text });
    }
  }

  const response = { emulatedPatterns, selectors, exceptions };

  return response;
});
