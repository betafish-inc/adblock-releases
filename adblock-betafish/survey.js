/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global browser, TELEMETRY, License, log, openTab,
 */

// if the ping response indicates a survey (tab or overlay)
// gracefully processes the request

import { Prefs } from 'prefs';
import { domainSuffixes, parseDomains } from 'adblockpluscore/lib/url';
import { getSettings } from './prefs/settings';
import { getBlockedPerPage } from '../vendor/adblockplusui/adblockpluschrome/lib/stats';
import OnPageIconManager from './onpageIcon/onpage-icon-bg';
import postData from './fetch-util';
import { chromeStorageGetHelper, log, chromeStorageSetHelper } from './utilities/background/bg-functions';


const SURVEY = (function getSurvey() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  let surveyAllowed = true;
  const SURVEY_DATA_KEY = 'ab.survey.data';

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

  // Domains and paths that we don't want to show the On Page icon on
  // hostname : required and is an exact match
  // pathname : optional and is an startsWith match
  const excludedSites = [
    {
      hostname: 'www.google.com',
      pathname: '/maps',
    },
    {
      hostname: 'meet.google.com',
    },
  ];

  /**
   * Checks whether the URL is restricted
   *
   * @param {URL} [theURL]
   * @return {boolean}
   */
  const isRestricted = function (theURL) {
    return excludedSites.some((element) => {
      let response = !!(element.hostname && element.hostname === theURL.hostname);
      if (response && element.pathname && theURL.pathname) {
        response = response && theURL.pathname.startsWith(element.pathname);
      }
      return response;
    });
  };

  // functions below are used by both Tab Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  const shouldShowSurvey = async function (surveyData) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    log('shouldShowSurvey::surveyAllowed: ', surveyAllowed);
    if (!surveyAllowed) {
      return null;
    }
    const data = { cmd: 'survey', u: TELEMETRY.userId(), sid: surveyData.survey_id };
    if (TELEMETRY.flavor === 'E' && Prefs.blocked_total) {
      data.b = Prefs.blocked_total;
    }
    const response = await postData(TELEMETRY.statsUrl, data);
    if (response.ok) {
      const dataObj = await response.json();
      if (dataObj && dataObj.should_survey === 'true' && surveyAllowed) {
        // for icon surveys, the surveyAllowed is set to false when
        // the user engages / mouse's over the icon
        if (surveyData.type !== 'icon') {
          surveyAllowed = false;
        }
        return dataObj;
      }
    }
    log('bad response from ping', response);
    return null;
  };

  const validateIconSurveyData = function (surveyData) {
    if (!surveyData) {
      return false;
    }
    if (surveyData.type !== 'icon') {
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

  const doesLicenseMatch = function (surveyData) {
    if (surveyData.user_state === 'all') {
      return true;
    }
    const license = License && License.get();
    if (license && license.status === 'active' && surveyData.user_state === 'active') {
      return true;
    }
    if (license && !license.status && surveyData.user_state === 'free') {
      return true;
    }
    return false;
  };

  const tabListener = async function (updatedTabId, changeInfo, tab) {
    const shouldShowOnPageIcon = async function (surveyData) {
      const responseData = await shouldShowSurvey(surveyData);
      log('shouldShowSurvey:: responseData', responseData);
      if (
        responseData
        && responseData.survey_id === surveyData.survey_id
        && responseData.should_survey === 'true'
        && responseData.type === 'icon'
        && responseData.icon_options
      ) {
        OnPageIconManager.showOnPageIcon(tab.id, tab.url, {
          titlePrefixText: responseData.icon_options.title_prefix_text,
          titleText: responseData.icon_options.title_text,
          msgText: responseData.icon_options.msg_text,
          buttonText: responseData.icon_options.button_text,
          ctaIconURL: responseData.icon_options.cta_icon_url,
          buttonURL: responseData.icon_options.button_url,
          surveyId: responseData.survey_id,
        });
      } else {
        // clean up, if we were told to not show the survey
        browser.storage.local.remove(SURVEY_DATA_KEY);
      }
    };

    const surveyData = await chromeStorageGetHelper(SURVEY_DATA_KEY);
    if (!surveyData || !validateIconSurveyData(surveyData)) {
      browser.tabs.onUpdated.removeListener(tabListener);
      return;
    }
    const parsedDomains = parseDomains(surveyData.domains, ',');
    if (changeInfo.status === 'complete' && tab.status === 'complete' && validTab(tab)) {
      const myURL = new URL(tab.url);
      const cleanDomain = myURL.hostname;
      log('processIcon:: surveyData', surveyData);
      log('processIcon:: parsedDomains', parsedDomains);
      log('processIcon:: checking if isActiveOnDomain', cleanDomain, isActiveOnDomain(cleanDomain, parsedDomains));
      log('processIcon:: checking if isRestricted', isRestricted(myURL));
      if (isActiveOnDomain(cleanDomain, parsedDomains) && !isRestricted(myURL)) {
        log('processIcon:: block count check', await getBlockedPerPage(tab), surveyData.block_count);
        if (surveyData.block_count <= await getBlockedPerPage(tab)) {
          shouldShowOnPageIcon(surveyData);
        }
      }
    }
  };

  const surveyMsgListener = async function (message, sender, sendResponse) {
    const surveyData = await chromeStorageGetHelper(SURVEY_DATA_KEY);
    if (!surveyData || !validateIconSurveyData(surveyData)) {
      browser.runtime.onMessage.removeListener(surveyMsgListener);
      return;
    }
    if (message.onpageiconevent === 'mouseenter') {
      surveyAllowed = false;
      browser.runtime.onMessage.removeListener(surveyMsgListener);
      browser.tabs.onUpdated.removeListener(tabListener);
      browser.storage.local.remove(SURVEY_DATA_KEY);
      const tabs = await browser.tabs.query({ url: '*://*/*' });
      for (const theTab of tabs) {
        if (theTab.id !== sender.tab.id && theTab.url && theTab.url.startsWith('http')) {
          browser.tabs.sendMessage(theTab.id, { command: 'removeIcon' }).catch(() => {
            // ignore error
          });
        }
      }
      sendResponse({});
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
    log('processIcon:: surveyData', surveyData);
    log('processIcon:: is survey data valid? ', validateIconSurveyData(surveyData));
    log('processIcon:: is license status match? ', doesLicenseMatch(surveyData));
    log('processIcon:: is settting enabled? ', getSettings().onpageMessages);
    if (
      getSettings().onpageMessages
      && validateIconSurveyData(surveyData)
      && doesLicenseMatch(surveyData)
    ) {
      chromeStorageSetHelper(SURVEY_DATA_KEY, surveyData);
      browser.runtime.onMessage.removeListener(surveyMsgListener);
      browser.runtime.onMessage.addListener(surveyMsgListener);
      browser.tabs.onUpdated.removeListener(tabListener);
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

  const openTabIfAllowed = async function (surveyData) {
    if (surveyData && surveyData.type === 'tab') {
      const responseData = await shouldShowSurvey(surveyData);
      browser.storage.local.remove(SURVEY_DATA_KEY);
      if (responseData && responseData.open_this_url) {
        browser.tabs.create({ url: `https://getadblock.com/${responseData.open_this_url}` });
      }
    }
  };

  const waitForUserAction = async function () {
    const surveyData = await chromeStorageGetHelper(SURVEY_DATA_KEY);
    if (!surveyData) {
      browser.tabs.onCreated.removeListener(waitForUserAction);
      return;
    }
    openTabIfAllowed(surveyData);
  };

  // open a Tab for a full page survey
  const processTab = async function (surveyData) {
    if (getSettings().onpageMessages) {
      chromeStorageSetHelper(SURVEY_DATA_KEY, surveyData);
      const state = await browser.idle.queryState(60);
      if (state === 'active') {
        openTabIfAllowed(surveyData);
      } else {
        browser.tabs.onCreated.removeListener(waitForUserAction);
        browser.tabs.onCreated.addListener(waitForUserAction);
      }
    }
  }; // end of processTab()

  browser.runtime.onMessage.removeListener(surveyMsgListener);
  browser.runtime.onMessage.addListener(surveyMsgListener);
  browser.tabs.onUpdated.addListener(tabListener);
  browser.tabs.onCreated.removeListener(waitForUserAction);
  browser.tabs.onCreated.addListener(waitForUserAction);

  return {
    maybeSurvey(responseData) {
      if (getSettings().show_survey === false) {
        log('maybeSurvey::show_survey === false, returning');
        return;
      }
      if (getSettings().suppress_surveys) {
        log('maybeSurvey::suppress_surveys === true, returning');
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

export default SURVEY;
