/** @module adblock-betafish/getselectors */

/** call by the data collection content script, and if the user has myadblock enabled */

"use strict";

const {ElemHide} = require("elemHide");
const {RegExpFilter} = require("filterClasses");
const {ElemHideEmulation} = require("elemHideEmulation");
const {checkWhitelisted} = require("whitelisting");
const {extractHostFromFrame} = require("url");
const {port} = require("messaging");

port.on("getSelectors", (message, sender) =>
{
  let selectors = [];
  let emulatedPatterns = [];

  if (!checkWhitelisted(sender.page, sender.frame, null,
                        RegExpFilter.typeMap.DOCUMENT |
                        RegExpFilter.typeMap.ELEMHIDE))
  {
    let hostname = extractHostFromFrame(sender.frame);
    let specificOnly = checkWhitelisted(sender.page, sender.frame, null,
                                        RegExpFilter.typeMap.GENERICHIDE);

    selectors = ElemHide.getSelectorsForDomain(
      hostname,
      specificOnly ? ElemHide.SPECIFIC_ONLY : ElemHide.ALL_MATCHING
    );

    for (let filter of ElemHideEmulation.getRulesForDomain(hostname))
      emulatedPatterns.push({selector: filter.selector, text: filter.text});
  }

  let response = {emulatedPatterns, selectors};

  return response;
});