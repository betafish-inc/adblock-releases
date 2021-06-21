'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, exports, STATS, log, getSettings, Prefs, openTab,
   License
 */

// if the ping response indicates a survey (tab or overlay)
// gracefully processes the request
const stats = require('stats');
const { OnPageIconManager } = require('./onpageIcon/onpage-icon-bg.js');
const { domainSuffixes, parseDomains } = require('../adblockplusui/adblockpluschrome/adblockpluscore/lib/url.js');
const { recordGeneralMessage, recordErrorMessage } = require('./servermessages').ServerMessages;

const SURVEY = (function getSurvey() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  let surveyAllowed = true;

  // True if we are willing to show an overlay on this tab.
  const validTab = function (tab) {
    if (tab.incognito || tab.status !== 'complete') {
      return false;
    }
    return /^http/.test(tab.url);
  };

  /**
   * Checks whether the tab URL is a match to the domain(s)
   * @param {?string} [tabDomain]
   * @return {boolean}
   */
  const isActiveOnDomain = function (tabDomain, domains) {
    // If no domains are set the rule matches everywhere
    if (!domains) {
      return true;
    }
    let docDomain = tabDomain;
    if (docDomain === null) {
      docDomain = '';
    } else if (docDomain[docDomain.length - 1] === '.') {
      docDomain = docDomain.substring(0, docDomain.length - 1);
    }

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain) {
      return domains.get('');
    }

    for (docDomain of domainSuffixes(docDomain)) {
      const isDomainIncluded = domains.get(docDomain);
      if (typeof isDomainIncluded !== 'undefined') {
        return isDomainIncluded;
      }
    }

    return domains.get('');
  };

  // functions below are used by both Tab Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  const shouldShowSurvey = function (surveyData, callback) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    log('shouldShowSurvey::surveyAllowed: ', surveyAllowed);
    if (surveyAllowed) {
      let data = { cmd: 'survey', u: STATS.userId(), sid: surveyData.survey_id };
      if (STATS.flavor === 'E' && Prefs.blocked_total) {
        data.b = Prefs.blocked_total;
      }
      $.post(STATS.statsUrl, data, (responseData) => {
        try {
          data = JSON.parse(responseData);
        } catch (e) {
          log('Error parsing JSON: ', responseData, ' Error: ', e);
        }
        if (data && data.should_survey === 'true' && surveyAllowed) {
          // for icon surveys, the surveyAllowed is set to false when
          // the user engages / mouse's over the icon
          if (surveyData.type !== 'icon') {
            surveyAllowed = false;
          }
          callback(data);
        }
      });
    }
  };

  // Process a request to show the 'on page / tab AdBlock icon'
  // Inputs:
  //         surveyData : object - with the following:
  //             survey_id : string - A unique string
  //             domains : string - A separate list of domains, and subdomain to show the icon on
  //             block_count : integer - The minimum block count to show the icon (can be zero)
  //             user_state : string - one of the three values: 'all', 'free', 'active'
  // step 1 verify the user allows on page messages
  // step 2 verify the initial survey data (ping response)
  // step 3 verify license type is a match
  // step 4 add a onTab update listener to watch for user navigation
  // step 5 when a tab/site is done loading, check the tab's domain to the survey's list of domains
  // step 6 compare the current block count on the tab to survey's minimum block count
  // step 7 if the tab meets all of the survey critieria, then check with the ping server again
  // step 8 validate shouldShow response data
  // step 9 show the adblock icon on the tab
  // step 10 when the user interacts with the icon, remove tab listener
  const processIcon = function (surveyData) {
    const validateIconSurveyData = function () {
      if (!surveyData) {
        return false;
      }
      if (!surveyData.survey_id) {
        return false;
      }
      if (!surveyData.domains || typeof surveyData.domains !== 'string') {
        return false;
      }
      if (surveyData.block_count && typeof surveyData.block_count !== 'number') {
        return false;
      }
      if (!Object.prototype.hasOwnProperty.call(surveyData, 'block_count')) {
        return false;
      }
      if (!surveyData.user_state || typeof surveyData.user_state !== 'string') {
        return false;
      }
      return true;
    };

    const doesLicenseMatch = function () {
      if (surveyData.user_state === 'all') {
        return true;
      }
      if (License && License.get() && License.get().status === 'active' && surveyData.user_state === 'active') {
        return true;
      }
      if (License && License.get() && !License.get().status && surveyData.user_state === 'free') {
        return true;
      }
      return false;
    };

    const parsedDomains = parseDomains(surveyData.domains, ',');

    const tabListener = function (updatedTabId, changeInfo, tab) {
      const shouldShowOnPageIcon = function () {
        shouldShowSurvey(surveyData, (responseData) => {
          log('shouldShowSurvey::responseData:', responseData);
          if (
            responseData.survey_id === surveyData.survey_id
            && responseData.should_survey === 'true'
          ) {
            OnPageIconManager.showOnPageIcon(tab.id, tab.url, {
              titleText: responseData.titleText,
              msgText: responseData.msgText,
              buttonText: responseData.buttonText,
              buttonURL: responseData.buttonURL,
              surveyId: responseData.survey_id,
            });
          }
        });
      };

      if (changeInfo.status === 'complete' && tab.status === 'complete' && validTab(tab)) {
        const myURL = new URL(tab.url);
        const cleanDomain = myURL.hostname.replace(/^www\./, ''); // remove lead 'www.'
        log('processIcon:: checking if isActiveOnDomain', cleanDomain, isActiveOnDomain(cleanDomain, parsedDomains));
        if (isActiveOnDomain(cleanDomain, parsedDomains)) {
          log('processIcon:: block count check', stats.getBlockedPerPage(tab), surveyData.block_count);
          if (surveyData.block_count <= stats.getBlockedPerPage(tab)) {
            shouldShowOnPageIcon();
          }
        }
      }
    };

    const surveyMsgListener = function (message, sender, sendResponse) {
      if (message.onpageiconevent === 'mouseenter') {
        surveyAllowed = false;
        browser.runtime.onMessage.removeListener(surveyMsgListener);
        browser.tabs.onUpdated.removeListener(tabListener);
        browser.tabs.query({ url: '*://*/*' }).then((tabs) => {
          for (const theTab of tabs) {
            if (theTab.id !== sender.tab.id && theTab.url && theTab.url.startsWith('http')) {
              browser.tabs.sendMessage(theTab.id, { command: 'removeIcon' }).catch(() => {
                // ignore error
              });
            }
          }
        });
        sendResponse({});
      }
    };

    log('processIcon:: is survey data valid? ', validateIconSurveyData());
    log('processIcon:: is license status match? ', doesLicenseMatch());
    log('processIcon:: is settting enabled? ', getSettings().onpageMessages);
    if (getSettings().onpageMessages && validateIconSurveyData() && doesLicenseMatch()) {
      browser.runtime.onMessage.removeListener(surveyMsgListener);
      browser.runtime.onMessage.addListener(surveyMsgListener);
      browser.tabs.onUpdated.addListener(tabListener);
    }
  };

  // Check the response from a ping to see if it contains valid survey instructions.
  // If so, return an object containing data about the survey to show.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  const surveyDataFrom = function (responseData) {
    let surveyData;

    if (responseData.length === 0 || responseData.trim().length === 0) {
      return null;
    }
    try {
      surveyData = JSON.parse(responseData);
      if (!surveyData) {
        return null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Something went wrong with parsing survey data.');
      // eslint-disable-next-line no-console
      console.log('error', e);
      // eslint-disable-next-line no-console
      console.log('response data', responseData);
      return null;
    }
    return surveyData;
  };

  // open a Tab for a full page survey
  const processTab = function (surveyData) {
    const openTabIfAllowed = function () {
      setTimeout(() => {
        shouldShowSurvey(surveyData, (responseData) => {
          browser.tabs.create({ url: `https://getadblock.com/${responseData.open_this_url}` });
        });
      }, 10000); // 10 seconds
    };

    const waitForUserAction = function () {
      browser.tabs.onCreated.removeListener(waitForUserAction);
      openTabIfAllowed();
    };

    browser.idle.queryState(60, (state) => {
      if (state === 'active') {
        openTabIfAllowed();
      } else {
        browser.tabs.onCreated.removeListener(waitForUserAction);
        browser.tabs.onCreated.addListener(waitForUserAction);
      }
    });
  }; // end of processTab()

  return {
    maybeSurvey(responseData) {
      if (getSettings().show_survey === false) {
        return;
      }
      if (getSettings().suppress_surveys) {
        return;
      }

      const surveyData = surveyDataFrom(responseData);
      if (!surveyData) {
        return;
      }
      if (surveyData.type === 'tab') {
        processTab(surveyData);
      } else if (surveyData.type === 'icon') {
        processIcon(surveyData);
      }
    }, // end of maybeSurvey
    types(callback) {
      // 'T' = Tab Surveys
      callback('TI');
    },
  };
}());

exports.SURVEY = SURVEY;
