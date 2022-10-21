

/* For ESLint: List any global identifiers used in this file below */
/* global browser, log,
 */

import { getSettings } from '../settings';

const OnPageIconManager = (function initialize() {
  const MAX_MSG_TEXT_LENGTH = 280;

  const isIconDataValid = function (iconData) {
    if (!iconData) {
      return false;
    }
    if (!iconData.msgText || !iconData.titleText || !iconData.titlePrefixText) {
      return false;
    }
    if (!iconData.buttonText && iconData.buttonURL) {
      return false;
    }
    if (iconData.buttonText && !iconData.buttonURL) {
      return false;
    }
    if (typeof iconData.buttonText !== 'string') {
      return false;
    }
    if (typeof iconData.msgText !== 'string') {
      return false;
    }
    if (typeof iconData.titlePrefixText !== 'string') {
      return false;
    }
    if (typeof iconData.titleText !== 'string') {
      return false;
    }
    if (iconData.buttonURL && typeof iconData.buttonURL !== 'string') {
      return false;
    }
    if (iconData.buttonURL && !iconData.buttonURL.startsWith('/')) {
      return false;
    }
    if (iconData.ctaIconURL && typeof iconData.ctaIconURL !== 'string') {
      return false;
    }
    return true;
  };


  return {
    // shows / display the AdBlock annimated icon on the specified tab
    // Inputs: tabId : integer - the id of the tab
    //         tabUrl : string - the top level URL of the tab, used for confirmation purposes
    //         iconData : object - with the following:
    //             surveyId: string - unique survey id from ping server
    //             msgText : string - The text of the message (will truncate after 280 characters)
    //             titlePrefixText : string - The prefix title text in the speech bubble
    //             titleText : string - The title text in the speech bubble
    //             ctaIconURL : string (optional) - The hero image in SVG format
    //             buttonText : string (optional) - The text in the button
    //             buttonURL : string (optional) - only the path part of the URL,
    //                         required to start with a '/' character
    //                         the '/' indicates that a new tab should be opened on gab.com
    //                         (the extension will add the 'gab.com' prefix for security reasons)
    showOnPageIcon(tabId, tabUrl, iconData) {
      if (!getSettings().onpageMessages) {
        return;
      }
      if (!isIconDataValid(iconData)) {
        log('OnPageIconManager:showOnPageIcon::isIconDataValid: false', iconData);
        return;
      }
      let { msgText } = iconData;
      if (msgText && msgText.length > MAX_MSG_TEXT_LENGTH) {
        msgText = msgText.slice(0, MAX_MSG_TEXT_LENGTH);
      }
      log('showOnPageIcon::iconData:', iconData);
      browser.tabs.insertCSS(tabId, {
        file: 'adblock-onpage-icon-user.css',
        allFrames: false,
        runAt: 'document_start',
      }).then(() => {
        browser.tabs.executeScript(tabId, {
          file: 'purify.min.js',
          allFrames: false,
        }).then(() => {
          const data = {
            command: 'showonpageicon',
            tabURL: tabUrl,
            titleText: iconData.titleText,
            titlePrefixText: iconData.titlePrefixText,
            msgText,
            surveyId: iconData.surveyId,
            buttonText: iconData.buttonText,
            buttonURL: iconData.buttonURL,
            ctaIconURL: iconData.ctaIconURL,
          };
          browser.tabs.sendMessage(tabId, data).catch((error) => {
            log('error', error);
          });
        }).catch((error) => {
          log('Injection of DOM Purify failed');
          log(error);
        });
      }).catch((error) => {
        log('Injection of adblock-onpage-icon-user.css failed');
        log(error);
      });
    }, // end of showOnPageIcon
  };
}());

export default OnPageIconManager;
