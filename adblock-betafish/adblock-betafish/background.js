

/* For ESLint: List any global identifiers used in this file below */
/* global browser, chromeStorageSetHelper, log, License, translate,
   gabQuestion, ext, getSettings, parseUri, sessionStorageGet, setSetting,
  blockCounts, sessionStorageSet, updateButtonUIAndContextMenus, settings,
  storageGet, parseFilter, channels, twitchChannelNamePages, ytChannelNamePages,
  determineUserLanguage, createFilterMetaData */

import { Prefs } from 'prefs';
import * as info from 'info';
import * as ewe from '../vendor/webext-sdk/dist/ewe-api';

import { TELEMETRY } from './telemetry';
import { Stats, getBlockedPerPage } from '../vendor/adblockplusui/adblockpluschrome/lib/stats';
import { initialize } from './alias/subscriptionInit';
import SyncService from './picreplacement/sync-service';

import SubscriptionAdapter from './subscriptionadapter';

import DataCollectionV2 from './datacollection.v2';
import CtaABManager from './ctaabmanager';
import ExcludeFilter from './excludefilter';
import { getNewBadgeTextReason } from './alias/icon';
import LocalDataCollection from './localdatacollection';
import { License, channels } from './picreplacement/check';
import { channelsNotifier } from './picreplacement/channels';
import ServerMessages from './servermessages';
import SURVEY from './survey';
import { setUninstallURL } from './alias/uninstall';

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
const addCustomFilterRandomName = '';
const adblocBetaID = 'pljaalgmajnlogcgiohkhdmgpomjcihk';

Object.assign(window, {
  Prefs,
  info,
  getBlockedPerPage,
  SURVEY,
  SyncService,
  DataCollectionV2,
  LocalDataCollection,
  ServerMessages,
  SubscriptionAdapter,
  ExcludeFilter,
  TELEMETRY,
  CtaABManager,
  getNewBadgeTextReason,
  ewe,
  License,
  channels,
  channelsNotifier,
  isTrustedSender,
  isTrustedSenderDomain,
  addCustomFilterRandomName,
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

  // Update custom filter count stored in localStorage
  const updateCustomFilterCount = function () {
    chromeStorageSetHelper('custom_filter_count', cache);
  };

  return {
    // Update custom filter count cache and value stored in localStorage.
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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'getCustomFilterCount' || !message.host) {
    return;
  }
  sendResponse({ response: countCache.getCustomFilterCount(message.host) });
});

/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'getBlockedTotal' && isTrustedSenderDomain(sender)) {
    sendResponse({});
    return Promise.resolve(Stats.blocked_total);
  }
});


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
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message) => {
  if (
    message.command === 'addCustomFilter'
    && message.filterTextToAdd
    && message.addCustomFilterRandomName === window.addCustomFilterRandomName
  ) {
    window.addCustomFilterRandomName = '';
    return addCustomFilter(message.filterTextToAdd, message.origin).then(results => results);
  }
});

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
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'createDomainAllowlistFilter' && message.url) {
    return createDomainAllowlistFilter(message.url, message.origin).then(results => results);
  }
});

// UNWHITELISTING

async function getUserFilters() {
  return ewe.filters.getUserFilters();
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'getUserFilters') {
    sendResponse({ response: getUserFilters() });
  }
});

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
    if (isWhitelistFilter(text) && ewe.filters.getAllowingFilters(tabId).includes(text)) {
      await ewe.filters.remove([text]);
      return true;
    }
  }
  return false;
};
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'tryToUnwhitelist' && message.url) {
    return tryToUnwhitelist(message.url, message.id).then(results => results);
  }
});

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
  const confirmationText = translate('confirm_undo_custom_filters', [customFilterCount, host]);
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
const pageIsWhitelisted = function (page) {
  const whitelisted = !!ewe.filters.getAllowingFilters(page.id).length;
  return (whitelisted !== undefined && whitelisted !== null);
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'pageIsWhitelisted' || !message.page) {
    return;
  }
  sendResponse(pageIsWhitelisted(JSON.parse(message.page)));
});

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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'adblockIsPaused' || !isTrustedSender(sender)) {
    return;
  }
  sendResponse(adblockIsPaused(message.newValue));
});

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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'adblockIsDomainPaused' || !isTrustedSender(sender)) {
    return;
  }
  sendResponse(adblockIsDomainPaused(message.activeTab, message.newValue));
});

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
  if (!jQuery.isEmptyObject(storedDomainPauses)) {
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
    getTab(tabId).then((tab) => {
      if (tab && !tab.url) {
        // Issue 6877: tab URL is not set directly after you opened a window
        // using window.open()
        if (!secondTime) {
          window.setTimeout(() => {
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
          blockCountPage: getBlockedPerPage(tab),
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
          result.whitelisted = !!ewe.filters.getAllowingFilters(page.id).length;
          result.whitelistedText = ewe.filters.getAllowingFilters(page.id);
        }
        if (License && License.isActiveLicense()) {
          result.activeLicense = true;
          result.subscriptions = SubscriptionAdapter.getSubscriptionsMinusText();
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

/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'getCurrentTabInfo') {
    return getCurrentTabInfo(false, message.tabId).then(results => results);
  }
});

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
  const getUpdatedURL = function () {
    const encodedVersion = encodeURIComponent('5.1.2');
    let updatedURL = `https://getadblock.com/premium/update/${TELEMETRY.flavor.toLowerCase()}/${encodedVersion}/?`;
    updatedURL = `${updatedURL}u=${TELEMETRY.userId()}&bt=${Prefs.blocked_total}`;
    return updatedURL;
  };
  const openUpdatedPage = function () {
    const updatedURL = getUpdatedURL();
    browser.tabs.create({ url: updatedURL });
  };
  const waitForUserAction = function () {
    browser.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(() => {
      openUpdatedPage();
    }, 10000); // 10 seconds
  };
  const shouldShowUpdate = function () {
    const checkQueryState = async function () {
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
  const slashUpdateReleases = ['5.1.2'];
  // Display updated page after each update
  browser.runtime.onInstalled.addListener((details) => {
    const lastKnownVersion = localStorage.getItem(updateStorageKey);
    const currentVersion = browser.runtime.getManifest().version;
    // don't open the /update page for Ukraine or Russian users.
    const shouldShowUpdateForLocale = function () {
      const language = determineUserLanguage();
      return !(language && (language.startsWith('ru') || language.startsWith('uk')));
    };

    if (
      details.reason === 'update'
      && browser.runtime.id !== adblocBetaID
      && shouldShowUpdateForLocale()
      && slashUpdateReleases.includes(currentVersion)
      && !slashUpdateReleases.includes(lastKnownVersion)
    ) {
      settings.onload().then(() => {
        if (!getSettings().suppress_update_page) {
          TELEMETRY.untilLoaded(() => {
            Prefs.untilLoaded.then(shouldShowUpdate);
          });
        }
      });
    }
    localStorage.setItem(updateStorageKey, currentVersion);
  });
}


const openTab = function (url) {
  browser.tabs.create({ url });
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'openTab' && isTrustedTarget(message.urlToOpen)) {
    openTab(message.urlToOpen);
    sendResponse({});
  }
});

// These functions are usually only called by content scripts.

// DEBUG INFO

async function getCustomFilterMetaData() {
  const currentUserFilters = await getUserFilters();
  if (!currentUserFilters || currentUserFilters.length === 0) {
    return {};
  }
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


// Get debug info as a JSON object for bug reporting and ad reporting
const getDebugInfo = async function (callback) {
  const response = {};
  response.otherInfo = {};

  // Is this installed build of AdBlock the official one?
  if (browser.runtime.id === adblocBetaID) {
    response.otherInfo.buildtype = ' Beta';
  } else if (browser.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom'
    || browser.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj'
    || browser.runtime.id === 'ndcileolkflehcjpmjnfbnaibdcgglog'
    || browser.runtime.id === 'jid1-NIfFY2CA8fy1tg@jetpack') {
    response.otherInfo.buildtype = ' Stable';
  } else {
    response.otherInfo.buildtype = ' Unofficial';
  }

  // Get AdBlock version
  response.otherInfo.version = browser.runtime.getManifest().version;

  // Get subscribed filter lists
  const subscriptionInfo = {};
  const subscriptions = SubscriptionAdapter.getSubscriptionsMinusText();
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
  response.otherInfo.browser = TELEMETRY.browser;
  response.otherInfo.browserVersion = TELEMETRY.browserVersion;
  response.otherInfo.osVersion = TELEMETRY.osVersion;
  response.otherInfo.os = TELEMETRY.os;
  if (window.blockCounts) {
    response.otherInfo.blockCounts = blockCounts.get();
  }
  if (localStorage && localStorage.length) {
    response.otherInfo.localStorageInfo = {};
    response.otherInfo.localStorageInfo.length = localStorage.length;
    let inx = 1;
    for (const key in localStorage) {
      response.otherInfo.localStorageInfo[`key${inx}`] = key;
      inx += 1;
    }
    // Temporarly add Edge migration logs to debug data
    const edgeMigrationLogs = storageGet('migrateLogMessageKey') || [];
    if (edgeMigrationLogs || edgeMigrationLogs.length) {
      response.otherInfo.edgeMigrationLogs = Object.assign({}, edgeMigrationLogs);
    }
  } else {
    response.otherInfo.localStorageInfo = 'no data';
  }
  response.otherInfo.isAdblockPaused = adblockIsPaused();
  response.otherInfo.licenseState = License.get().status;
  response.otherInfo.licenseVersion = License.get().lv;
  LocalDataCollection.getRawStatsSize((rawStatsSize) => {
    response.otherInfo.rawStatsSize = rawStatsSize;
    // Get total pings
    browser.storage.local.get('total_pings').then((storageResponse) => {
      response.otherInfo.totalPings = storageResponse.totalPings || 0;

      // Now, add exclude filters (if there are any)
      const excludeFiltersKey = 'exclude_filters';
      browser.storage.local.get(excludeFiltersKey).then((secondResponse) => {
        if (secondResponse && secondResponse[excludeFiltersKey]) {
          response.excludedFilters = secondResponse[excludeFiltersKey];
        }
        // Now, add JavaScript exception error (if there is one)
        const errorKey = 'errorkey';
        browser.storage.local.get(errorKey).then((errorResponse) => {
          if (errorResponse && errorResponse[errorKey]) {
            response.otherInfo[errorKey] = errorResponse[errorKey];
          }
          // Now, add the migration messages (if there are any)
          const migrateLogMessageKey = 'migrateLogMessageKey';
          browser.storage.local.get(migrateLogMessageKey).then((migrateLogMessageResponse) => {
            if (migrateLogMessageResponse && migrateLogMessageResponse[migrateLogMessageKey]) {
              const messages = migrateLogMessageResponse[migrateLogMessageKey].split('\n');
              for (let i = 0; i < messages.length; i++) {
                const key = `migration_message_${i}`;
                response.otherInfo[key] = messages[i];
              }
            }
            const addMetaDataInfo = function () {
              getCustomFilterMetaData()
                .then((results) => {
                  response.otherInfo.customRuleMetaData = results;
                  if (typeof callback === 'function') {
                    callback(response);
                  }
                });
            };

            const getDebugLicenseInfo = function () {
              if (License.isActiveLicense()) {
                response.otherInfo.licenseInfo = {};
                response.otherInfo.licenseInfo.extensionGUID = TELEMETRY.userId();
                response.otherInfo.licenseInfo.licenseId = License.get().licenseId;
                if (getSettings().sync_settings) {
                  const syncInfo = {};
                  syncInfo.SyncCommitVersion = SyncService.getCommitVersion();
                  syncInfo.SyncCommitName = SyncService.getCurrentExtensionName();
                  syncInfo.SyncCommitLog = SyncService.getSyncLog();
                  response.otherInfo.syncInfo = syncInfo;
                }
                browser.alarms.getAll().then((alarms) => {
                  if (alarms && alarms.length > 0) {
                    response.otherInfo['Alarm info'] = `length: ${alarms.length}`;
                    for (let i = 0; i < alarms.length; i++) {
                      const alarm = alarms[i];
                      response.otherInfo[`${i} Alarm Name`] = alarm.name;
                      response.otherInfo[`${i} Alarm Scheduled Time`] = new Date(alarm.scheduledTime);
                    }
                  } else {
                    response.otherInfo['No alarm info'] = 'No alarm info';
                  }
                  License.getLicenseInstallationDate((installdate) => {
                    response.otherInfo['License Installation Date'] = installdate;
                    const customChannelId = channels.getIdByName('CustomChannel');
                    if (channels.getGuide()[customChannelId].enabled) {
                      const customChannel = channels.channelGuide[customChannelId].channel;
                      customChannel.getTotalBytesInUse().then((result) => {
                        response.otherInfo['Custom Channel total bytes in use'] = result;
                        addMetaDataInfo();
                      });
                    } else {
                      addMetaDataInfo();
                    }
                  });
                });
              } else { // License is not active
                addMetaDataInfo();
              }
            };
            if (browser.permissions && browser.permissions.getAll) {
              browser.permissions.getAll().then((allPermissions) => {
                response.otherInfo.hostPermissions = allPermissions;
                getDebugLicenseInfo();
              });
            } else {
              response.otherInfo.hostPermissions = 'no data';
              getDebugLicenseInfo();
            }
          });
        });
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists() {
  for (const subscription of ewe.subscriptions.getDownloadable()) {
    ewe.subscriptions.sync(subscription.url);
  }
}
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'updateFilterLists') {
    return;
  }
  updateFilterLists();
  sendResponse({});
});

// Checks if the filter lists are currently in the process of
// updating and if there were errors the last time they were
// updated
function checkUpdateProgress() {
  let inProgress = false;
  let filterError = false;
  for (const subscription of ewe.subscriptions.getDownloadable()) {
    if (subscription.downloading) {
      inProgress = true;
    } else if (subscription.downloadStatus && subscription.downloadStatus !== 'synchronize_ok') {
      filterError = true;
    }
  }
  return { inProgress, filterError };
}
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'checkUpdateProgress') {
    return;
  }
  sendResponse(checkUpdateProgress());
});

initialize.then(() => {
  TELEMETRY.untilLoaded(() => {
    TELEMETRY.startPinging();
    setUninstallURL();
  });
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

function isAcceptableAds(filterList) {
  if (!filterList) {
    return undefined;
  }
  return filterList.id === 'acceptable_ads';
}

function isAcceptableAdsPrivacy(filterList) {
  if (!filterList) {
    return undefined;
  }
  return filterList.id === 'acceptable_ads_privacy';
}

const rateUsCtaKey = 'rate-us-cta-clicked';
const vpnWaitlistCtaKey = 'vpn-waitlist-cta-clicked';
const mailCtaKey = 'mail-cta-clicked';

// Attach methods to window
Object.assign(window, {
  adblockIsPaused,
  getUserFilters,
  updateFilterLists,
  checkUpdateProgress,
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
  isAcceptableAds,
  isAcceptableAdsPrivacy,
  rateUsCtaKey,
  mailCtaKey,
  vpnWaitlistCtaKey,
  updateStorageKey,
  getCustomFilterMetaData,
});
