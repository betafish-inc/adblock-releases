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
/* global browser, License,
   gabQuestion, ext, getSettings, setSetting, settings
   parseFilter, channels, twitchChannelNamePages, ytChannelNamePages,
   updateButtonUIAndContextMenus,  */


import { Prefs } from 'prefs';
import * as info from 'info';
import * as ewe from '../vendor/webext-sdk/dist/ewe-api';

import { TELEMETRY } from './telemetry';
import { Stats, getBlockedPerPage } from '../vendor/adblockplusui/adblockpluschrome/lib/stats';
import { revalidateAllowlistingStates } from '../vendor/adblockplusui/adblockpluschrome/lib/allowlisting';
import { initialize } from './alias/subscriptionInit';
import SyncService from './picreplacement/sync-service';

import SubscriptionAdapter from './subscriptionadapter';
import DataCollectionV2 from './datacollection.v2';
import CtaABManager from './ctaabmanager';
import { getNewBadgeTextReason } from './alias/icon';
import LocalDataCollection from './localdatacollection';
import { License, channels } from './picreplacement/check';
import ServerMessages from './servermessages';
import SURVEY from './survey';
import { setUninstallURL } from './alias/uninstall';

import {
  parseUri,
  createFilterMetaData,
  chromeStorageSetHelper,
  isEmptyObject,
  determineUserLanguage,
  sessionStorageGet,
  sessionStorageSet,
} from './utilities/background/bg-functions';

// Message verification
const trustedBaseUrl = browser.runtime.getURL('');
const gabHostnames = ['https://getadblock.com', 'https://dev.getadblock.com', 'https://dev1.getadblock.com', 'https://dev2.getadblock.com', 'https://vpn.getadblock.com', 'https://help.getadblock.com'];

const isTrustedSender = sender => sender.url.startsWith(trustedBaseUrl);

const isTrustedTarget = url => (url.startsWith(trustedBaseUrl)
                            || gabHostnames.includes(new URL(url).origin));

const isTrustedSenderDomain = (sender) => {
  if (sender.origin) {
    return gabHostnames.includes(sender.origin);
  }
  if (sender.url) {
    return gabHostnames.includes(new URL(sender.url).origin);
  }
  return false;
};
const adblocBetaID = 'pljaalgmajnlogcgiohkhdmgpomjcihk';

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  Prefs,
  info,
  getBlockedPerPage,
  SURVEY,
  SyncService,
  LocalDataCollection,
  ServerMessages,
  SubscriptionAdapter,
  TELEMETRY,
  DataCollectionV2,
  CtaABManager,
  getNewBadgeTextReason,
  ewe,
  License,
  channels,
  isTrustedSender,
  isTrustedTarget,
  isTrustedSenderDomain,
});

// CUSTOM FILTERS

const isSelectorFilter = function (text) {
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /#@?#./.test(text);
};

// custom filter countCache singleton.
const countCache = (function countCache() {
  let cache;

  // Update custom filter count stored in storage
  const updateCustomFilterCount = function () {
    chromeStorageSetHelper('custom_filter_count', cache);
  };

  return {
    // Update custom filter count cache and value stored in storage.
    // Inputs: new_count_map:count map - count map to replace existing count
    // cache
    updateCustomFilterCountMap(newCountMap) {
      cache = newCountMap || cache;
      updateCustomFilterCount();
    },

    // Remove custom filter count for host
    // Inputs: host:string - url of the host
    removeCustomFilterCount(host) {
      if (host && cache[host]) {
        delete cache[host];
        updateCustomFilterCount();
      }
    },

    // Get current custom filter count for a particular domain
    // Inputs: host:string - url of the host
    getCustomFilterCount(host) {
      let customCount = 0;
      if (cache) {
        customCount = cache[host];
      }
      return customCount || 0;
    },

    // Add 1 to custom filter count for the filters domain.
    // Inputs: filter:string - line of text to be added to custom filters.
    addCustomFilterCount(filter) {
      const host = filter.split('##')[0];
      cache[host] = this.getCustomFilterCount(host) + 1;
      updateCustomFilterCount();
    },

    init() {
      browser.storage.local.get('custom_filter_count').then((response) => {
        cache = response.custom_filter_count || {};
      });
    },
  };
}());
countCache.init();

// Add a new custom filter entry.
// Inputs: filter:string - line of text to add to custom filters.
//         origin:string - the source or trigger for the filter list entry
// Returns: null if succesfull, otherwise an exception
const addCustomFilter = async function (filterText, origin) {
  try {
    const response = ewe.filters.validate(filterText);
    if (response) {
      return response;
    }
    await ewe.filters.add([filterText], createFilterMetaData(origin));
    await ewe.filters.enable([filterText]);
    if (isSelectorFilter(filterText)) {
      countCache.addCustomFilterCount(filterText);
    }
    return null;
  } catch (ex) {
    // convert to a string so that Safari can pass
    // it back to content scripts
    return ex.toString();
  }
};

// Creates a custom filter entry that allowlists a given domain
// Inputs: pageUrl:string - url of the page
//         origin:string - the source or trigger for the filter list entry
// Returns: null if successful, otherwise an exception
const createDomainAllowlistFilter = async function (pageUrl, origin) {
  const theURL = new URL(pageUrl);
  const host = theURL.hostname.replace(/^www\./, '');
  const filter = `@@||${host}/*^$document`;
  return addCustomFilter(filter, origin);
};

// UNWHITELISTING

async function getUserFilters() {
  return ewe.filters.getUserFilters();
}

const isWhitelistFilter = function (text) {
  return /^@@/.test(text);
};

// Look for a custom filter that would whitelist the 'url' parameter
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be allowlisted by a custom filter
//         tabId: integer - tab id of the tab that may be allowlisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
const tryToUnwhitelist = async function (pageUrl, tabId) {
  const url = pageUrl.replace(/#.*$/, ''); // Whitelist ignores anchors
  const customFilters = await getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return false;
  }

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < customFilters.length; i++) {
    const { text } = customFilters[i];
    const whitelist = text.search(/@@\*\$document,domain=~/);
    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1) {
      // Remove protocols
      const [finalUrl] = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/);
      await ewe.filters.remove([text]);
      await ewe.filters.remove([`${text}|~${finalUrl}`]);
      return true;
    }
    if (isWhitelistFilter(text) && (await ewe.filters.getAllowingFilters(tabId)).includes(text)) {
      await ewe.filters.remove([text]);
      return true;
    }
  }
  return false;
};

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
const removeCustomFilter = async function (host) {
  const customFilters = await getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return;
  }

  const identifier = host;

  for (let i = 0; i < customFilters.length; i++) {
    const entry = customFilters[i];
    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.text.indexOf(identifier) === 0) {
      ewe.filters.remove([entry.text]);
    }
  }
};

// Entry point for customize.js, used to update custom filter count cache.
const updateCustomFilterCountMap = function (newCountMap) {
  // Firefox passes weak references to objects, so we need a local copy
  const localCountMap = JSON.parse(JSON.stringify(newCountMap));
  countCache.updateCustomFilterCountMap(localCountMap);
};

const removeCustomFilterForHost = function (host) {
  if (countCache.getCustomFilterCount(host)) {
    removeCustomFilter(host);
    countCache.removeCustomFilterCount(host);
  }
};

// Currently, Firefox doesn't allow the background page to use alert() or confirm(),
// so some JavaScript is injected into the active tab, which does the confirmation for us.
// If the user confirms the removal of the entries, then they are removed, and the page reloaded.
const confirmRemovalOfCustomFiltersOnHost = function (host, activeTabId) {
  const customFilterCount = countCache.getCustomFilterCount(host);
  const confirmationText = browser.i18n.getMessage('confirm_undo_custom_filters', [customFilterCount, host]);
  const messageListenerFN = function (request) {
    browser.runtime.onMessage.removeListener(messageListenerFN);
    if (request === `remove_custom_filters_on_host${host}:true`) {
      removeCustomFilterForHost(host);
      browser.tabs.reload(activeTabId);
    }
  };

  browser.runtime.onMessage.addListener(messageListenerFN);
  /* eslint-disable prefer-template */
  const codeToExecute = 'var host = "' + host + '"; var confirmResponse = confirm("' + confirmationText + '"); browser.runtime.sendMessage("remove_custom_filters_on_host" + host + ":" + confirmResponse); ';
  const details = { allFrames: false, code: codeToExecute };
  browser.tabs.executeScript(activeTabId, details);
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'confirmRemovalOfCustomFiltersOnHost' || !message.host || !message.activeTabId) {
    return;
  }
  confirmRemovalOfCustomFiltersOnHost(message.host, message.activeTabId);
  sendResponse({});
});

// Reload already opened tab
// Input:
// id: integer - id of the tab which should be reloaded
const reloadTab = function (id, callback) {
  let tabId = id;
  const localCallback = callback;
  const listener = function (updatedTabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.status === 'complete') {
      setTimeout(() => {
        browser.tabs.sendMessage(updatedTabId, { command: 'reloadcomplete' });
        if (typeof localCallback === 'function') {
          localCallback(tab);
        }
        browser.tabs.onUpdated.removeListener(listener);
      }, 2000);
    }
  };

  if (typeof tabId === 'string') {
    tabId = parseInt(tabId, 10);
  }
  browser.tabs.onUpdated.addListener(listener);
  browser.tabs.reload(tabId, { bypassCache: true });
};

const isSelectorExcludeFilter = function (text) {
  return /#@#./.test(text);
};

const getAdblockUserId = function () {
  return TELEMETRY.userId();
};

// INFO ABOUT CURRENT PAGE

// Returns true if the url cannot be blocked
const pageIsUnblockable = function (url) {
  if (!url) { // Protect against empty URLs - e.g. Safari empty/bookmarks/top sites page
    return true;
  }
  let scheme = '';
  if (!url.protocol) {
    scheme = parseUri(url).protocol;
  } else {
    scheme = url.protocol;
  }

  return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
};

// Returns true if the page is whitelisted.
// Called from a content script
const pageIsWhitelisted = async function (page) {
  const whitelisted = !!await ewe.filters.getAllowingFilters(page.id).length;
  return (whitelisted !== undefined && whitelisted !== null);
};

const pausedKey = 'paused';
// white-list all blocking requests regardless of frame / document, but still allows element hiding
const pausedFilterText1 = '@@*';
// white-list all documents, which prevents element hiding
const pausedFilterText2 = '@@*$document';

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
const adblockIsPaused = function (newValue) {
  if (newValue === undefined) {
    return (sessionStorageGet(pausedKey) === true);
  }

  if (newValue === true) {
    chromeStorageSetHelper(pausedKey, true, () => {
      ewe.filters.add([pausedFilterText1]);
      ewe.filters.add([pausedFilterText2]);
    });
  } else {
    ewe.filters.remove([pausedFilterText1]);
    ewe.filters.remove([pausedFilterText2]);
    browser.storage.local.remove(pausedKey);
  }
  sessionStorageSet(pausedKey, newValue);
  return undefined;
};

const domainPausedKey = 'domainPaused';

// Helper that saves the domain pauses
// Inputs:  domainPauses (required object): domain pauses to save
// Returns: undefined
const saveDomainPauses = function (domainPauses) {
  chromeStorageSetHelper(domainPausedKey, domainPauses);
  sessionStorageSet(domainPausedKey, domainPauses);
};

// Helper that removes any domain pause filter rules based on tab events
// Inputs:  tabId (required integer): identifier for the affected tab
//          newDomain (optional string): the current domain of the tab
// Returns: undefined
const domainPauseChangeHelper = function (tabId, newDomain) {
  // get stored domain pauses
  const storedDomainPauses = sessionStorageGet(domainPausedKey);

  // check if any of the stored domain pauses match the affected tab
  for (const aDomain in storedDomainPauses) {
    if (storedDomainPauses[aDomain] === tabId && aDomain !== newDomain) {
      // Remove the filter that white-listed the domain
      ewe.filters.remove([`@@${aDomain}$document`]);
      delete storedDomainPauses[aDomain];

      // save updated domain pauses
      saveDomainPauses(storedDomainPauses);
    }
  }
  updateButtonUIAndContextMenus();
};

// Handle the effects of a tab update event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (required object with a url property): contains the
// new url for the tab
//          tab (optional Tab object): the affected tab
// Returns: undefined
const domainPauseNavigationHandler = function (tabId, changeInfo) {
  if (changeInfo === undefined || changeInfo.url === undefined || tabId === undefined) {
    return;
  }

  const newDomain = parseUri(changeInfo.url).host;

  domainPauseChangeHelper(tabId, newDomain);
};

// Handle the effects of a tab remove event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (optional object): info about the remove event
// Returns: undefined
const domainPauseClosedTabHandler = function (tabId) {
  if (tabId === undefined) {
    return;
  }

  domainPauseChangeHelper(tabId);
};

// Get or set if AdBlock is domain paused for the domain of the specified tab
// Inputs:  activeTab (optional object with url and id properties): the paused tab
//          newValue (optional boolean): if true, AdBlock will be domain paused
// on the tab's domain, if false, AdBlock will not be domain paused on that domain.
// Returns: undefined if activeTab and newValue were specified; otherwise if activeTab
// is specified it returns true if domain paused, false otherwise; finally it returns
// the complete storedDomainPauses if activeTab is not specified

const adblockIsDomainPaused = function (activeTab, newValue) {
  // get stored domain pauses
  let storedDomainPauses = sessionStorageGet(domainPausedKey);

  // return the complete list of stored domain pauses if activeTab is undefined
  if (activeTab === undefined) {
    return storedDomainPauses;
  }

  // return a boolean indicating whether the domain is paused if newValue is undefined
  const activeDomain = parseUri(activeTab.url).host;
  if (newValue === undefined) {
    if (storedDomainPauses) {
      return Object.prototype.hasOwnProperty.call(storedDomainPauses, activeDomain);
    }
    return false;
  }

  // create storedDomainPauses object if needed
  if (!storedDomainPauses) {
    storedDomainPauses = {};
  }

  // set or delete a domain pause
  if (newValue === true) {
    // add a domain pause
    ewe.filters.add([`@@${activeDomain}$document`]);
    storedDomainPauses[activeDomain] = activeTab.id;
    browser.tabs.onUpdated.removeListener(domainPauseNavigationHandler);
    browser.tabs.onRemoved.removeListener(domainPauseClosedTabHandler);
    browser.tabs.onUpdated.addListener(domainPauseNavigationHandler);
    browser.tabs.onRemoved.addListener(domainPauseClosedTabHandler);
  } else {
    // remove the domain pause
    ewe.filters.remove([`@@${activeDomain}$document`]);
    delete storedDomainPauses[activeDomain];
  }

  // save the updated list of domain pauses
  saveDomainPauses(storedDomainPauses);
  return undefined;
};

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
browser.storage.local.get(pausedKey).then((response) => {
  if (response[pausedKey]) {
    initialize.then(() => {
      ewe.filters.remove([pausedFilterText1]);
      ewe.filters.remove([pausedFilterText2]);
      browser.storage.local.remove(pausedKey);
    });
  }
});


// If AdBlock was domain paused on shutdown, then unpause / remove
// all domain pause white-list entries at startup.
browser.storage.local.get(domainPausedKey).then((response) => {
  const storedDomainPauses = response[domainPausedKey];
  if (!isEmptyObject(storedDomainPauses)) {
    initialize.then(() => {
      for (const aDomain in storedDomainPauses) {
        ewe.filters.remove([`@@${aDomain}$document`]);
      }
      browser.storage.local.remove(domainPausedKey);
    });
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === 'toggle_pause') {
    adblockIsPaused(!adblockIsPaused());
    ServerMessages.recordGeneralMessage('pause_shortcut_used');
  }
});

const getTab = function (tabId) {
  return new Promise((resolve) => {
    if (tabId) {
      let id = tabId;
      if (typeof id === 'string') {
        id = parseInt(id, 10);
      }
      browser.tabs.get(id).then((tab) => {
        resolve(tab);
      });
    } else {
      browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      }).then((tabs) => {
        if (tabs.length === 0) {
          resolve(); // For example: only the background devtools or a popup are opened
        }
        resolve(tabs[0]);
      });
    }
  });
};


// Get interesting information about the current tab.
// Inputs:
// secondTime: bool - whether this is a recursive call
// info object passed to resolve: {
// page: Page object
// tab: Tab object
// whitelisted: bool - whether the current tab's URL is whitelisted.
// disabled_site: bool - true if the url is e.g. about:blank or the
// Extension Gallery, where extensions don't run.
// settings: Settings object
// paused: bool - whether AdBlock is paused
// domainPaused: bool - whether the current tab's URL is paused
// blockCountPage: int - number of ads blocked on the current page
// blockCountTotal: int - total number of ads blocked since install
// customFilterCount: int - number of custom rules for the current tab's URL
// showMABEnrollment: bool - whether to show MAB enrollment
// popupMenuThemeCTA: string - name of current popup menu CTA theme
// lastGetStatusCode: int - status code for last GET request
// lastGetErrorResponse: error object - error response for last GET request
// lastPostStatusCode: int - status code for last POST request
// allowlistRuleText: string - allowlist rule text for use on YouTube and Twitch
// }
// Returns: Promise
const getCurrentTabInfo = function (secondTime, tabId) {
  return new Promise((resolve) => {
    getTab(tabId).then(async (tab) => {
      if (tab && !tab.url) {
        // Issue 6877: tab URL is not set directly after you opened a window
        // using window.open()
        if (!secondTime) {
          setTimeout(() => {
            getCurrentTabInfo(true);
          }, 250);
        }
        return resolve();
      }
      try {
        const page = new ext.Page(tab);
        const disabledSite = pageIsUnblockable(page.url.href);
        const customFilterCheckUrl = disabledSite ? undefined : page.url.hostname;

        const result = {
          disabledSite,
          url: String(page.url || tab.url),
          id: page.id,
          settings: getSettings(),
          paused: adblockIsPaused(),
          domainPaused: adblockIsDomainPaused({ url: page.url.href, id: page.id }),
          blockCountPage: await getBlockedPerPage(tab),
          blockCountTotal: Stats.blocked_total,
          customFilterCount: countCache.getCustomFilterCount(customFilterCheckUrl),
          showMABEnrollment: License.shouldShowMyAdBlockEnrollment(),
          popupMenuThemeCTA: License.getCurrentPopupMenuThemeCTA(),
          showDcCTA: License.shouldShowPremiumDcCTA(),
          lastGetStatusCode: SyncService.getLastGetStatusCode(),
          lastGetErrorResponse: SyncService.getLastGetErrorResponse(),
          lastPostStatusCode: SyncService.getLastPostStatusCode(),
          newBadgeTextReason: getNewBadgeTextReason(),
        };
        if (!disabledSite) {
          result.whitelisted = !!(await ewe.filters.getAllowingFilters(page.id)).length;
          result.whitelistedText = await ewe.filters.getAllowingFilters(page.id);
        }
        if (License && License.isActiveLicense()) {
          result.activeLicense = true;
          result.subscriptions = await SubscriptionAdapter.getSubscriptionsMinusText();
        }
        if (
          getSettings()
          && getSettings().youtube_channel_whitelist
          && parseUri(tab.url).hostname === 'www.youtube.com'
        ) {
          result.youTubeChannelName = ytChannelNamePages.get(page.id);
          // handle the odd occurence of when the  YT Channel Name
          // isn't available in the ytChannelNamePages map
          // obtain the channel name from the URL
          // for instance, when the forward / back button is clicked
          if (!result.youTubeChannelName && /ab_channel/.test(tab.url)) {
            result.youTubeChannelName = parseUri.parseSearch(tab.url).ab_channel;
          }
          if (result.youTubeChannelName) {
            result.allowlistRuleText = `@@||www.youtube.com/*${result.youTubeChannelName}|$document`;
          }
        }
        if (
          twitchChannelNamePages
          && getSettings()
          && getSettings().twitch_channel_allowlist
          && parseUri(tab.url).hostname === 'www.twitch.tv'
        ) {
          result.twitchChannelName = twitchChannelNamePages.get(page.id);
          if (result.twitchChannelName) {
            result.allowlistRuleText = `@@||twitch.tv/*${result.twitchChannelName}^$document`;
          }
        }
        return resolve(result);
      } catch (err) {
        return resolve({ errorStr: err.toString(), stack: err.stack, message: err.message });
      }
    });
  });
};

// BETA CODE
if (browser.runtime.id === adblocBetaID) {
  // Display beta page after each update for beta-users only
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update' || details.reason === 'install') {
      browser.tabs.create({ url: 'https://getadblock.com/beta' });
    }
  });
}

const updateStorageKey = 'last_known_version';
if (browser.runtime.id) {
  let updateTabRetryCount = 0;
  const getUpdatedURL = function () {
    const encodedVersion = encodeURIComponent('5.4.1');
    let updatedURL = `https://getadblock.com/update/${TELEMETRY.flavor.toLowerCase()}/${encodedVersion}/?u=${TELEMETRY.userId()}`;
    updatedURL = `${updatedURL}&rt=${updateTabRetryCount}`;
    return updatedURL;
  };
  const waitForUserAction = function () {
    browser.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(() => {
      updateTabRetryCount += 1;
      // eslint-disable-next-line no-use-before-define
      openUpdatedPage();
    }, 10000); // 10 seconds
  };
  const openUpdatedPage = function () {
    const updatedURL = getUpdatedURL();
    browser.tabs.create({ url: updatedURL });
  };
  const shouldShowUpdate = function () {
    const checkQueryState = function () {
      browser.idle.queryState(30).then((state) => {
        if (state === 'active') {
          openUpdatedPage();
        } else {
          browser.tabs.onCreated.removeListener(waitForUserAction);
          browser.tabs.onCreated.addListener(waitForUserAction);
        }
      });
    };
    const checkLicense = function () {
      if (!License.isActiveLicense()) {
        checkQueryState();
      }
    };
    if (browser.management && browser.management.getSelf) {
      browser.management.getSelf().then((extensionInfo) => {
        if (extensionInfo && extensionInfo.installType !== 'admin') {
          License.ready().then(checkLicense);
        }
      });
    } else {
      License.ready().then(checkLicense);
    }
  };
  const slashUpdateReleases = ['5.4.1'];
  // Display updated page after each update
  browser.runtime.onInstalled.addListener(async (details) => {
    let {
      last_known_version: lastKnownVersion,
    } = await browser.storage.local.get(updateStorageKey);
    if (!lastKnownVersion) {
      lastKnownVersion = localStorage.getItem(updateStorageKey);
    }
    const currentVersion = browser.runtime.getManifest().version;
    // don't open the /update page for Ukraine or Russian users.
    const shouldShowUpdateForLocale = function () {
      const language = determineUserLanguage();
      return !(language && (language.startsWith('ru') || language.startsWith('uk')));
    };
    if (
      details.reason === 'update'
      && shouldShowUpdateForLocale()
      && slashUpdateReleases.includes(currentVersion)
      && !slashUpdateReleases.includes(lastKnownVersion)
      && browser.runtime.id !== adblocBetaID
    ) {
      settings.onload().then(() => {
        if (!getSettings().suppress_update_page) {
          TELEMETRY.untilLoaded(() => {
            Prefs.untilLoaded.then(shouldShowUpdate);
          });
        }
      });
    }
    // We want to move away from localStorage, so remove item if it exists.
    localStorage.removeItem(updateStorageKey);
    // Update version in browser.storage.local. We intentionally ignore the
    // returned promise.
    browser.storage.local.set({ [updateStorageKey]: browser.runtime.getManifest().version });
  });
}


const openTab = function (url) {
  browser.tabs.create({ url });
};

// These functions are usually only called by content scripts.

// DEBUG INFO

async function getCustomFilterMetaData() {
  const currentUserFilters = await getUserFilters();
  if (!currentUserFilters || currentUserFilters.length === 0) {
    return Promise.resolve({});
  }
  /* eslint-disable consistent-return */
  return Promise.all(
    currentUserFilters.map(async (rule) => {
      if (rule && rule.text) {
        try {
          const metaData = await ewe.filters.getMetadata(rule.text);
          return { text: rule.text, metaData };
        } catch {
          return { text: rule.text };
        }
      }
    }),
  );
}
const getDebugAlarmInfo = async () => {
  const response = {};
  const alarms = await browser.alarms.getAll();
  if (alarms && alarms.length > 0) {
    response['Alarm info'] = `length: ${alarms.length}`;
    for (let i = 0; i < alarms.length; i++) {
      const alarm = alarms[i];
      response[`${i} Alarm Name`] = alarm.name;
      response[`${i} Alarm Scheduled Time`] = new Date(alarm.scheduledTime).toLocaleString();
    }
  } else {
    response['No alarm info'] = 'No alarm info';
  }
  return response;
};// end of getDebugAlarmInfo()

const getDebugLicenseInfo = async () => {
  const response = {};
  if (License.isActiveLicense()) {
    response.licenseInfo = {};
    response.licenseInfo.extensionGUID = TELEMETRY.userId();
    response.licenseInfo.licenseId = License.get().licenseId;
    if (getSettings().sync_settings) {
      const syncInfo = {};
      syncInfo.SyncCommitVersion = SyncService.getCommitVersion();
      syncInfo.SyncCommitName = SyncService.getCurrentExtensionName();
      syncInfo.SyncCommitLog = SyncService.getSyncLog();
      response.syncInfo = syncInfo;
    }
    response['License Installation Date'] = await License.getLicenseInstallationDate();
    const customChannelId = channels.getIdByName('CustomChannel');
    if (channels.getGuide()[customChannelId].enabled) {
      const customChannel = channels.channelGuide[customChannelId].channel;
      const result = await customChannel.getTotalBytesInUse();
      response['Custom Channel total bytes in use'] = result;
    }
  }
  return response;
};

// Get debug info as a JSON object for bug reporting and ad reporting
const getDebugInfo = function () {
  return new Promise(async (resolve) => {
    const response = {};
    response.otherInfo = {};
    const { otherInfo } = response;

    // Is this installed build of AdBlock the official one?
    if (browser.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
      otherInfo.buildtype = ' Beta';
    } else if (browser.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom'
      || browser.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj'
      || browser.runtime.id === 'ndcileolkflehcjpmjnfbnaibdcgglog'
      || browser.runtime.id === 'jid1-NIfFY2CA8fy1tg@jetpack') {
      otherInfo.buildtype = ' Stable';
    } else {
      otherInfo.buildtype = ' Unofficial';
    }

    // Get AdBlock version
    otherInfo.version = browser.runtime.getManifest().version;

    // Get subscribed filter lists
    const subscriptionInfo = {};
    const subscriptions = await SubscriptionAdapter.getSubscriptionsMinusText();
    for (const id in subscriptions) {
      if (subscriptions[id].subscribed) {
        subscriptionInfo[id] = {};
        subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
        subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
        subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
      }
    }
    response.subscriptions = subscriptionInfo;

    const userFilters = await getUserFilters();
    if (userFilters && userFilters.length) {
      response.customFilters = userFilters.map(filter => filter.text).join('\n');
    }

    // Get settings
    const adblockSettings = {};
    const settings = getSettings();
    for (const setting in settings) {
      adblockSettings[setting] = JSON.stringify(settings[setting]);
    }

    response.settings = adblockSettings;
    response.prefs = JSON.stringify(Prefs);
    otherInfo.browser = TELEMETRY.browser;
    otherInfo.browserVersion = TELEMETRY.browserVersion;
    otherInfo.osVersion = TELEMETRY.osVersion;
    otherInfo.os = TELEMETRY.os;

    if (localStorage && localStorage.length) {
      otherInfo.localStorageInfo = {};
      otherInfo.localStorageInfo.length = localStorage.length;
      let inx = 1;
      for (const key in localStorage) {
        otherInfo.localStorageInfo[`key${inx}`] = key;
        inx += 1;
      }
    } else {
      otherInfo.localStorageInfo = 'no data';
    }
    otherInfo.isAdblockPaused = adblockIsPaused();
    otherInfo.licenseState = License.get().status;
    otherInfo.licenseVersion = License.get().lv;

    // Get 'Stats' size
    otherInfo.rawStatsSize = await LocalDataCollection.getRawStatsSize();

    // Get total pings
    const storageResponse = await browser.storage.local.get('total_pings');
    otherInfo.totalPings = storageResponse.totalPings || 0;

    // Add exclude filters (if there are any)
    const excludeFiltersKey = 'exclude_filters';
    const secondResponse = await browser.storage.local.get(excludeFiltersKey);
    if (secondResponse && secondResponse[excludeFiltersKey]) {
      response.excludedFilters = secondResponse[excludeFiltersKey];
    }

    // Add JavaScript exception error (if there is one)
    const errorKey = 'errorkey';
    const errorResponse = await browser.storage.local.get(errorKey);
    if (errorResponse && errorResponse[errorKey]) {
      otherInfo[errorKey] = errorResponse[errorKey];
    }

    // Add any migration messages (if there are any)
    const migrateLogMessageKey = 'migrateLogMessageKey';
    const migrateLogMessageResponse = await browser.storage.local.get(migrateLogMessageKey);
    if (migrateLogMessageResponse && migrateLogMessageResponse[migrateLogMessageKey]) {
      const messages = migrateLogMessageResponse[migrateLogMessageKey].split('\n');
      for (let i = 0; i < messages.length; i++) {
        const key = `migration_message_${i}`;
        otherInfo[key] = messages[i];
      }
    }

    otherInfo.alarmInfo = await getDebugAlarmInfo();
    if (browser.permissions && browser.permissions.getAll) {
      otherInfo.hostPermissions = await browser.permissions.getAll();
    } else {
      otherInfo.hostPermissions = 'no data';
    }
    otherInfo.licenseInfo = await getDebugLicenseInfo();
    otherInfo.customRuleMetaData = await getCustomFilterMetaData();
    resolve(response);
  }); // end of Promise
};

// Called when user explicitly requests filter list updates
async function updateFilterLists() {
  const subscriptions = await ewe.subscriptions.getDownloadable();
  subscriptions.forEach(async (subscription) => {
    await ewe.subscriptions.sync(subscription.url);
  });
}

// Checks if the filter lists are currently in the process of
// updating and if there were errors the last time they were
// updated
async function checkUpdateProgress() {
  let inProgress = false;
  let filterError = false;
  const subscriptions = await ewe.subscriptions.getDownloadable();
  subscriptions.forEach(async (subscription) => {
    if (subscription.downloading) {
      inProgress = true;
    } else if (subscription.downloadStatus && subscription.downloadStatus !== 'synchronize_ok') {
      filterError = true;
    }
  });
  return { inProgress, filterError };
}

initialize.then(() => {
  TELEMETRY.untilLoaded(() => {
    TELEMETRY.startPinging();
    setUninstallURL();
  });
  revalidateAllowlistingStates();
});

// Create the "blockage stats" for the uninstall logic ...
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browser.storage.local.get('blockage_stats').then((response) => {
      const { blockage_stats } = response;
      if (!blockage_stats) {
        const data = {};
        data.start = Date.now();
        data.version = 1;
        chromeStorageSetHelper('blockage_stats', data);
      }
    });
  }
});

// Attach methods to window
// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  adblockIsPaused,
  getUserFilters,
  updateFilterLists,
  checkUpdateProgress,
  createDomainAllowlistFilter,
  getDebugInfo,
  openTab,
  saveDomainPauses,
  adblockIsDomainPaused,
  pageIsWhitelisted,
  pageIsUnblockable,
  getCurrentTabInfo,
  getAdblockUserId,
  tryToUnwhitelist,
  addCustomFilter,
  removeCustomFilter,
  countCache,
  updateCustomFilterCountMap,
  removeCustomFilterForHost,
  confirmRemovalOfCustomFiltersOnHost,
  reloadTab,
  isSelectorFilter,
  isWhitelistFilter,
  isSelectorExcludeFilter,
  pausedFilterText1,
  pausedFilterText2,
  updateStorageKey,
  getCustomFilterMetaData,
});
