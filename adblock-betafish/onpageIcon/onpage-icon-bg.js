'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, exports, require, log, getSettings
 */
const OnPageIconManager = (function initialize() {
  const MAX_MSG_TEXT_LENGTH = 280;

  const isIconDataValid = function (iconData) {
    if (!iconData) {
      return false;
    }
    if (!iconData.msgText || !iconData.titleText) {
      return false;
    }
    if (!iconData.buttonText && iconData.buttonURL) {
      return false;
    }
    if (iconData.buttonText && !iconData.buttonURL) {
      return false;
    }
    if (iconData.buttonText && typeof iconData.buttonText !== 'string') {
      return false;
    }
    if (iconData.msgText && typeof iconData.msgText !== 'string') {
      return false;
    }
    if (iconData.titleText && typeof iconData.titleText !== 'string') {
      return false;
    }
    if (iconData.buttonURL && typeof iconData.buttonURL !== 'string') {
      return false;
    }
    if (iconData.buttonURL && !iconData.buttonURL.startsWith('/')) {
      return false;
    }
    return true;
  };


  return {
    // shows / display the AdBlock annimated icon on the specified tab
    // Inputs: tabId : integer - the id of the tab
    //         tabUrl : string - the top level URL of the tab, used for confirmation purposes
    //         iconData : object - with the following:
    //             msgText : string - The text of the message (will truncate after 280 characters)
    //             titleText : string - The title text in the speech bubble
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
        log('OnPageIconManager:showOnPageIcon::isIconDataValid: false');
        return;
      }
      let { msgText } = iconData;
      if (msgText && msgText.length > MAX_MSG_TEXT_LENGTH) {
        msgText = msgText.slice(0, MAX_MSG_TEXT_LENGTH);
      }
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
            msgText,
            surveyId: iconData.surveyId,
            buttonText: iconData.buttonText,
            buttonURL: iconData.buttonURL,
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

exports.OnPageIconManager = OnPageIconManager;
