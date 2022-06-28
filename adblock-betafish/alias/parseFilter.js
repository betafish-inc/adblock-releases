
import * as ewe from "../../vendor/webext-sdk/dist/ewe-api";

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== "parseFilter" || !message.filterTextToParse) {
    return;
  }
  sendResponse(ewe.filters.validate(message.filterTextToParse));
});
