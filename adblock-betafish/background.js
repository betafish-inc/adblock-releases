'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, chromeStorageSetHelper, log, License, translate,
   gabQuestion, ext, getSettings, parseUri, sessionStorageGet, setSetting,
  blockCounts, sessionStorageSet, updateButtonUIAndContextMenus, settings,
  storageGet, parseFilter, channels, twitchChannelNamePages, ytChannelNamePages */

const { Filter } = require('filterClasses');
const { WhitelistFilter } = require('filterClasses');
const { Subscription } = require('subscriptionClasses');
const { DownloadableSubscription } = require('subscriptionClasses');
const { SpecialSubscription } = require('subscriptionClasses');
const { filterStorage } = require('filterStorage');
const { filterNotifier } = require('filterNotifier');
const { Prefs } = require('prefs');
const { synchronizer } = require('synchronizer');
const { getBlockedPerPage } = require('stats');
const { RegExpFilter, InvalidFilter, URLFilter } = require('filterClasses');
const info = require('info');
const { checkAllowlisted } = require('../adblockplusui/adblockpluschrome/lib/allowlisting');
const { URLRequest } = require('../adblockplusui/adblockpluschrome/adblockpluscore/lib/url.js');

// Object's used on the option, pop up, etc. pages...
const { STATS } = require('./stats');
const { SURVEY } = require('./survey');
const { SyncService } = require('./picreplacement/sync-service');
const { DataCollectionV2 } = require('./datacollection.v2');
const { LocalDataCollection } = require('./localdatacollection');
const { ServerMessages } = require('./servermessages');
const { recommendations } = require('./alias/recommendations');
const { setUninstallURL } = require('./alias/uninstall');
const { ExcludeFilter } = require('./excludefilter');
const {
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  recordAnonymousErrorMessage,
  recordAnonymousMessage,
} = require('./servermessages').ServerMessages;
const {
  getUrlFromId,
  unsubscribe,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getDCSubscriptionsMinusText,
  getIdFromURL,
  getSubscriptionInfoFromURL,
  isLanguageSpecific,
} = require('./adpsubscriptionadapter').SubscriptionAdapter;

Object.assign(window, {
  filterStorage,
  filterNotifier,
  Prefs,
  synchronizer,
  Subscription,
  SpecialSubscription,
  DownloadableSubscription,
  Filter,
  WhitelistFilter,
  checkAllowlisted,
  info,
  getBlockedPerPage,
  STATS,
  SURVEY,
  SyncService,
  DataCollectionV2,
  LocalDataCollection,
  ServerMessages,
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  recordAnonymousMessage,
  recordAnonymousErrorMessage,
  getUrlFromId,
  unsubscribe,
  recommendations,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getDCSubscriptionsMinusText,
  getIdFromURL,
  getSubscriptionInfoFromURL,
  ExcludeFilter,
  URLFilter,
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

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
const addCustomFilter = function (filterText) {
  try {
    const filter = Filter.fromText(filterText);
    if (filter instanceof InvalidFilter) {
      return { error: filter.reason };
    }
    filterStorage.addFilter(filter);
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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'addCustomFilter' || !message.filterTextToAdd) {
    return;
  }
  sendResponse({ response: addCustomFilter(message.filterTextToAdd) });
});

// Creates a custom filter entry that whitelists a given page
// Inputs: pageUrl:string url of the page
// Returns: null if successful, otherwise an exception
const createPageWhitelistFilter = function (pageUrl) {
  const theURL = new URL(pageUrl);
  const host = theURL.hostname.replace(/^www\./, '');
  const filter = `@@||${host}${theURL.pathname}${theURL.search}^$document`;
  return addCustomFilter(filter);
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'createPageWhitelistFilter' || !message.url) {
    return;
  }
  sendResponse({ response: createPageWhitelistFilter(message.url) });
});

// Creates a custom filter entry that allowlists a given domain
// Inputs: pageUrl:string url of the page
// Returns: null if successful, otherwise an exception
const createDomainAllowlistFilter = function (pageUrl) {
  const theURL = new URL(pageUrl);
  const host = theURL.hostname.replace(/^www\./, '');
  const filter = `@@||${host}/*^$document`;
  return addCustomFilter(filter);
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'createDomainAllowlistFilter' || !message.url) {
    return;
  }
  sendResponse({ response: createDomainAllowlistFilter(message.url) });
});

// UNWHITELISTING

function getUserFilters() {
  const filters = [];

  for (const subscription of filterStorage.subscriptions()) {
    if ((subscription instanceof SpecialSubscription)) {
      for (let j = 0; j < subscription._filterText.length; j++) {
        const filter = subscription._filterText[j];
        filters.push(filter);
      }
    }
  }
  return filters;
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
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
const tryToUnwhitelist = function (pageUrl) {
  const url = pageUrl.replace(/#.*$/, ''); // Whitelist ignores anchors
  const customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return false;
  }

  for (let i = 0; i < customFilters.length; i++) {
    const text = customFilters[i];
    const whitelist = text.search(/@@\*\$document,domain=~/);

    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1) {
      // Remove protocols
      const [finalUrl] = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/);
      const oldFilter = Filter.fromText(text);
      filterStorage.removeFilter(oldFilter);
      const newFilter = Filter.fromText(`${text}|~${finalUrl}`);
      filterStorage.addFilter(newFilter);
      return true;
    }

    if (isWhitelistFilter(text)) {
      try {
        const filter = Filter.fromText(text);
        if (filter.matches(URLRequest.from(url), URLFilter.typeMap.DOCUMENT, false)) {
          filterStorage.removeFilter(filter);
          return true;
        }
      } catch (ex) {
        // do nothing;
      }
    }
  }
  return false;
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'tryToUnwhitelist' || !message.url) {
    return;
  }
  sendResponse({ unwhitelisted: tryToUnwhitelist(message.url) });
});

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
const removeCustomFilter = function (host) {
  const customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return;
  }

  const identifier = host;

  for (let i = 0; i < customFilters.length; i++) {
    const entry = customFilters[i];

    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.indexOf(identifier) === 0) {
      const filter = Filter.fromText(entry);
      filterStorage.removeFilter(filter);
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
  return STATS.userId();
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
  const whitelisted = checkAllowlisted(page);
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
const pausedFilterText1 = '@@';
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

  // Add a filter to white list every page.
  const result1 = parseFilter(pausedFilterText1);
  const result2 = parseFilter(pausedFilterText2);
  if (newValue === true) {
    filterStorage.addFilter(result1.filter);
    filterStorage.addFilter(result2.filter);
    chromeStorageSetHelper(pausedKey, true);
  } else {
    filterStorage.removeFilter(result1.filter);
    filterStorage.removeFilter(result2.filter);
    browser.storage.local.remove(pausedKey);
  }
  sessionStorageSet(pausedKey, newValue);
  return undefined;
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'adblockIsPaused') {
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
      const result = parseFilter(`@@${aDomain}$document`);
      filterStorage.removeFilter(result.filter);
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
  const result = parseFilter(`@@${activeDomain}$document`);
  if (newValue === true) {
    // add a domain pause
    filterStorage.addFilter(result.filter);
    storedDomainPauses[activeDomain] = activeTab.id;
    browser.tabs.onUpdated.removeListener(domainPauseNavigationHandler);
    browser.tabs.onRemoved.removeListener(domainPauseClosedTabHandler);
    browser.tabs.onUpdated.addListener(domainPauseNavigationHandler);
    browser.tabs.onRemoved.addListener(domainPauseClosedTabHandler);
  } else {
    // remove the domain pause
    filterStorage.removeFilter(result.filter);
    delete storedDomainPauses[activeDomain];
  }

  // save the updated list of domain pauses
  saveDomainPauses(storedDomainPauses);
  return undefined;
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'adblockIsDomainPaused') {
    return;
  }
  sendResponse(adblockIsDomainPaused(message.activeTab, message.newValue));
});

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
browser.storage.local.get(pausedKey).then((response) => {
  if (response[pausedKey]) {
    const pauseHandler = function () {
      filterNotifier.off('load', pauseHandler);
      const result1 = parseFilter(pausedFilterText1);
      const result2 = parseFilter(pausedFilterText2);
      filterStorage.removeFilter(result1.filter);
      filterStorage.removeFilter(result2.filter);
      browser.storage.local.remove(pausedKey);
    };

    filterNotifier.on('load', pauseHandler);
  }
});

// If AdBlock was domain paused on shutdown, then unpause / remove
// all domain pause white-list entries at startup.
browser.storage.local.get(domainPausedKey).then((response) => {
  try {
    const storedDomainPauses = response[domainPausedKey];
    if (!jQuery.isEmptyObject(storedDomainPauses)) {
      const domainPauseHandler = function () {
        filterNotifier.off('load', domainPauseHandler);
        for (const aDomain in storedDomainPauses) {
          const result = parseFilter(`@@${aDomain}$document`);
          filterStorage.removeFilter(result.filter);
        }
        browser.storage.local.remove(domainPausedKey);
      };
      filterNotifier.on('load', domainPauseHandler);
    }
  } catch (err) {
    // do nothing
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === 'toggle_pause') {
    adblockIsPaused(!adblockIsPaused());
    recordGeneralMessage('pause_shortcut_used');
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
// showStatsInPopup: bool - whether to show stats in popup menu
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
        const customFilterCheckUrl = info.disabledSite ? undefined : page.url.hostname;

        const result = {
          disabledSite,
          url: String(page.url || tab.url),
          id: page.id,
          settings: getSettings(),
          paused: adblockIsPaused(),
          domainPaused: adblockIsDomainPaused({ url: page.url.href, id: page.id }),
          blockCountPage: getBlockedPerPage(tab),
          blockCountTotal: Prefs.blocked_total,
          showStatsInPopup: Prefs.show_statsinpopup,
          customFilterCount: countCache.getCustomFilterCount(customFilterCheckUrl),
          showMABEnrollment: License.shouldShowMyAdBlockEnrollment(),
          popupMenuThemeCTA: License.getCurrentPopupMenuThemeCTA(),
          showDcCTA: License.shouldShowPremiumDcCTA(),
          lastGetStatusCode: SyncService.getLastGetStatusCode(),
          lastGetErrorResponse: SyncService.getLastGetErrorResponse(),
          lastPostStatusCode: SyncService.getLastPostStatusCode(),
        };

        if (!disabledSite) {
          result.whitelisted = checkAllowlisted(page);
        }
        if (License && License.isActiveLicense()) {
          result.activeLicense = true;
          result.subscriptions = getSubscriptionsMinusText();
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
browser.runtime.onMessage.addListener((message) => {
  if (message.command !== 'getCurrentTabInfo') {
    return undefined;
  }
  return getCurrentTabInfo(false, message.tabId).then(results => results);
});

// BETA CODE
if (browser.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
  // Display beta page after each update for beta-users only
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update' || details.reason === 'install') {
      browser.tabs.create({ url: 'https://getadblock.com/beta' });
    }
  });
}

// Note:  be sure to check the 'suppress_update_page' on the Settings object before showing
//        the /update page
const updateStorageKey = 'last_known_version';
// browser.runtime.onInstalled.addListener((details) => {
//   if (details.reason === 'update' || details.reason === 'install') {
//     localStorage.setItem(updateStorageKey, browser.runtime.getManifest().version);
//   }
// });

if (browser.runtime.id) {
  let updateTabRetryCount = 0;
  const getUpdatedURL = function () {
    const encodedVersion = encodeURIComponent('4.39.0');
    let updatedURL = `https://getadblock.com/update/${STATS.flavor.toLowerCase()}/${encodedVersion}/?u=${STATS.userId()}`;
    if (License && License.isActiveLicense()) {
      updatedURL = `https://getadblock.com/update/p/${encodedVersion}/?u=${STATS.userId()}`;
    }
    updatedURL = `${updatedURL}&bc=${Prefs.blocked_total}`;
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
    browser.tabs.create({ url: updatedURL }).then((tab) => {
      // if we couldn't open a tab to '/updated_tab', send a message
      if (!tab) {
        recordErrorMessage('updated_tab_failed_to_open');
        browser.tabs.onCreated.removeListener(waitForUserAction);
        browser.tabs.onCreated.addListener(waitForUserAction);
        return;
      }
      if (updateTabRetryCount > 0) {
        recordGeneralMessage(`updated_tab_retry_success_count_${updateTabRetryCount}`);
      }
    }).catch(() => {
      // if we couldn't open a tab to '/updated_tab', send a message
      recordErrorMessage('updated_tab_failed_to_open');
      browser.tabs.onCreated.removeListener(waitForUserAction);
      browser.tabs.onCreated.addListener(waitForUserAction);
    });
  };
  const shouldShowUpdate = function () {
    const checkQueryState = function () {
      browser.idle.queryState(60, (state) => {
        if (state === 'active') {
          openUpdatedPage();
        } else {
          browser.tabs.onCreated.removeListener(waitForUserAction);
          browser.tabs.onCreated.addListener(waitForUserAction);
        }
      });
    };
    if (browser.management && browser.management.getSelf) {
      browser.management.getSelf().then((extensionInfo) => {
        if (extensionInfo && extensionInfo.installType !== 'admin') {
          License.ready().then(checkQueryState);
        } else if (extensionInfo && extensionInfo.installType === 'admin') {
          recordGeneralMessage('update_tab_not_shown_admin_user');
        }
      });
    } else {
      License.ready().then(checkQueryState);
    }
  };
  const slashUpdateReleases = ['4.39.0', '4.39.1'];
  // Display updated page after each update
  browser.runtime.onInstalled.addListener((details) => {
    const lastKnownVersion = localStorage.getItem(updateStorageKey);
    const currentVersion = browser.runtime.getManifest().version;
    if (
      details.reason === 'update'
      && slashUpdateReleases.includes(currentVersion)
      && !slashUpdateReleases.includes(lastKnownVersion)
      && browser.runtime.id !== 'pljaalgmajnlogcgiohkhdmgpomjcihk'
    ) {
      settings.onload().then(() => {
        if (!getSettings().suppress_update_page) {
          STATS.untilLoaded(() => {
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
  if (message.command !== 'openTab' || !message.urlToOpen) {
    return;
  }
  openTab(message.urlToOpen);
  sendResponse({});
});

// These functions are usually only called by content scripts.

// DEBUG INFO

// Get debug info as a JSON object for bug reporting and ad reporting
const getDebugInfo = function (callback) {
  const response = {};
  response.otherInfo = {};

  // Is this installed build of AdBlock the official one?
  if (browser.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
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
  const subscriptions = getSubscriptionsMinusText();
  for (const id in subscriptions) {
    if (subscriptions[id].subscribed) {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id]._lastDownload * 1000);
      subscriptionInfo[id].downloadCount = subscriptions[id].downloadCount;
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  response.subscriptions = subscriptionInfo;

  const userFilters = getUserFilters();
  if (userFilters && userFilters.length) {
    response.customFilters = userFilters.join('\n');
  }

  // Get settings
  const adblockSettings = {};
  const settings = getSettings();
  for (const setting in settings) {
    adblockSettings[setting] = JSON.stringify(settings[setting]);
  }

  response.settings = adblockSettings;
  response.prefs = JSON.stringify(Prefs);
  response.otherInfo.browser = STATS.browser;
  response.otherInfo.browserVersion = STATS.browserVersion;
  response.otherInfo.osVersion = STATS.osVersion;
  response.otherInfo.os = STATS.os;
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
            if (License.isActiveLicense()) {
              response.otherInfo.licenseInfo = {};
              response.otherInfo.licenseInfo.extensionGUID = STATS.userId();
              response.otherInfo.licenseInfo.licenseId = License.get().licenseId;
              if (getSettings().sync_settings) {
                response.otherInfo.syncInfo = {};
                response.otherInfo.syncInfo.SyncCommitVersion = SyncService.getCommitVersion();
                response.otherInfo.syncInfo.SyncCommitName = SyncService.getCurrentExtensionName();
                response.otherInfo.syncInfo.SyncCommitLog = SyncService.getSyncLog();
              }
              browser.alarms.getAll((alarms) => {
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
                      if (typeof callback === 'function') {
                        callback(response);
                      }
                    });
                  } else if (typeof callback === 'function') {
                    callback(response);
                  }
                });
              });
            } else if (typeof callback === 'function') { // License is not active
              callback(response);
            }
          });
        });
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists() {
  for (const subscription of filterStorage.subscriptions()) {
    if (subscription instanceof DownloadableSubscription) {
      synchronizer.execute(subscription, true, true);
    }
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
  for (const subscription of filterStorage.subscriptions()) {
    if (synchronizer.isExecuting(subscription.url)) {
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

STATS.untilLoaded(() => {
  STATS.startPinging();
  setUninstallURL();
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

// Attach methods to window
Object.assign(window, {
  adblockIsPaused,
  createPageWhitelistFilter,
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
  isLanguageSpecific,
  isAcceptableAds,
  isAcceptableAdsPrivacy,
  rateUsCtaKey,
  vpnWaitlistCtaKey,
});
