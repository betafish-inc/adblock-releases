const getDecodedHostname = require('url').getDecodedHostname;

const Filter = require('filterClasses').Filter;
const WhitelistFilter = require('filterClasses').WhitelistFilter;

const {checkWhitelisted} = require("whitelisting");

const Subscription = require("subscriptionClasses").Subscription;
const DownloadableSubscription = require("subscriptionClasses").DownloadableSubscription;
const SpecialSubscription = require("subscriptionClasses").SpecialSubscription;

const parseFilter = require('filterValidation').parseFilter;
const parseFilters = require('filterValidation').parseFilters;

const {filterStorage} = require("filterStorage");
const {filterNotifier} = require("filterNotifier");
const Prefs = require('prefs').Prefs;
const Synchronizer = require('synchronizer').Synchronizer;
const Utils = require('utils').Utils;
const NotificationStorage = require('notification').Notification;

const {RegExpFilter} = require("filterClasses");

const {getBlockedPerPage} = require("stats");

const info = require("../buildtools/info");

// Object's used on the option, pop up, etc. pages...
const {STATS} = require('./stats');
const {SyncService} = require('./picreplacement/sync-service');
const {DataCollectionV2} = require('./datacollection.v2');
const {LocalCDN} = require('./localcdn');
const {ServerMessages} = require('./servermessages');
const {recordGeneralMessage, recordErrorMessage, recordAdreportMessage} = require('./servermessages').ServerMessages;
const {getUrlFromId, unsubscribe, getSubscriptionsMinusText, getAllSubscriptionsMinusText, getIdFromURL, isLanguageSpecific } = require('./adpsubscriptionadapter').SubscriptionAdapter;
const {uninstallInit} = require('./alias/uninstall');

Object.assign(window, {
  filterStorage,
  filterNotifier,
  Prefs,
  Synchronizer,
  NotificationStorage,
  Subscription,
  SpecialSubscription,
  DownloadableSubscription,
  parseFilter,
  parseFilters,
  Filter,
  WhitelistFilter,
  info,
  getBlockedPerPage,
  Utils,
  STATS,
  SyncService,
  DataCollectionV2,
  LocalCDN,
  ServerMessages,
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  getUrlFromId,
  unsubscribe,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getIdFromURL,
});

// CUSTOM FILTERS
// Creates a custom filter entry that whitelists a given page
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var createPageWhitelistFilter = function (url)
{
  var url = url.replace(/#.*$/, ''); // Remove anchors
  var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
  var hasQuerystring = parts[2];
  var filter = '@@|' + parts[1] + (hasQuerystring ? '?' : '|') + '$document';
  return addCustomFilter(filter);
};

// UNWHITELISTING

// Look for a custom filter that would whitelist the 'url' parameter
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
var tryToUnwhitelist = function (url)
{
  url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
  var customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0)
  {
    return false;
  }

  for (var i = 0; i < customFilters.length; i++)
  {
    var text = customFilters[i];
    var whitelist = text.search(/@@\*\$document,domain=\~/);

    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1)
    {
      // Remove protocols
      url = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/)[0];
      var oldFilter = Filter.fromText(text);
      filterStorage.removeFilter(oldFilter);
      var newFilter = Filter.fromText(text + '|~' + url);
      filterStorage.addFilter(newFilter);
      return true;
    } else
    {
      if (!isWhitelistFilter(text))
      {
        continue;
      }
      try
      {
        var filter = Filter.fromText(text);
      }
      catch (ex)
      {
        continue;
      }

      if (!filter.matches(url, RegExpFilter.typeMap.DOCUMENT, false))
      {
        continue;
      }
      filterStorage.removeFilter(filter);
      return true;
    }
  }

  return false;
};

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
var addCustomFilter = function (filterText) {
  try {
    var filter = Filter.fromText(filterText);
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

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
var removeCustomFilter = function (host)
{
  var customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0)
  {
    return false;
  }

  var identifier = host;

  for (var i = 0; i < customFilters.length; i++)
  {
    var entry = customFilters[i];

    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.indexOf(identifier) === 0)
    {
      var filter = Filter.fromText(entry);
      filterStorage.removeFilter(filter);
    }
  }
};

// custom filter countCache singleton.
var countCache = (function ()
{
  var cache;

  // Update custom filter count stored in localStorage
  var _updateCustomFilterCount = function ()
  {
    chromeStorageSetHelper('custom_filter_count', cache);
  };

  return {
    // Update custom filter count cache and value stored in localStorage.
    // Inputs: new_count_map:count map - count map to replace existing count
    // cache
    updateCustomFilterCountMap: function (newCountMap)
    {
      cache = newCountMap || cache;
      _updateCustomFilterCount();
    },

    // Remove custom filter count for host
    // Inputs: host:string - url of the host
    removeCustomFilterCount: function (host)
    {
      if (host && cache[host])
      {
        delete cache[host];
        _updateCustomFilterCount();
      }
    },

    // Get current custom filter count for a particular domain
    // Inputs: host:string - url of the host
    getCustomFilterCount: function (host)
    {
      return cache[host] || 0;
    },

    // Add 1 to custom filter count for the filters domain.
    // Inputs: filter:string - line of text to be added to custom filters.
    addCustomFilterCount: function (filter)
    {
      var host = filter.split('##')[0];
      cache[host] = this.getCustomFilterCount(host) + 1;
      _updateCustomFilterCount();
    },

    init: function ()
    {
      chrome.storage.local.get('custom_filter_count', function (response)
      {
        cache = response.custom_filter_count || {};
      });
    },
  };
})();

countCache.init();

// Entry point for customize.js, used to update custom filter count cache.
var updateCustomFilterCountMap = function (newCountMap)
{
  countCache.updateCustomFilterCountMap(newCountMap);
};

var removeCustomFilterForHost = function (host)
{
  if (countCache.getCustomFilterCount(host))
  {
    removeCustomFilter(host);
    countCache.removeCustomFilterCount(host);
  }
};

var confirmRemovalOfCustomFiltersOnHost = function (host, activeTab)
{
  var customFilterCount = countCache.getCustomFilterCount(host);
  var confirmationText = translate('confirm_undo_custom_filters', [customFilterCount, host]);
  if (!confirm(confirmationText))
  {
    return;
  }

  removeCustomFilterForHost(host);
  chrome.tabs.reload(activeTab.id);
};

// Reload already opened tab
// Input:
// tabId: integer - id of the tab which should be reloaded
var reloadTab = function(tabId, callback) {
  var localCallback = callback;
  var listener = function (tabId, changeInfo, tab) {
      if (changeInfo.status === 'complete' &&
          tab.status === 'complete') {
        setTimeout(function () {
            chrome.tabs.sendMessage(tabId, { command: 'reloadcomplete' });
            if (typeof localCallback === "function") {
              localCallback(tab);
            }
            chrome.tabs.onUpdated.removeListener(listener);
          }, 2000);
      }
    };

  if (typeof tabId === 'string') {
    tabId = parseInt(tabId);
  }
  chrome.tabs.onUpdated.addListener(listener);
  chrome.tabs.reload(tabId, { bypassCache: true }, function () {

  });
};

var isSelectorFilter = function (text)
{
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /\#\@?\#./.test(text);
};

var isWhitelistFilter = function (text)
{
  return /^\@\@/.test(text);
};

var isSelectorExcludeFilter = function (text)
{
  return /\#\@\#./.test(text);
};

// BGcall DISPATCH
(function ()
{
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse)
  {
    if (message.command != 'call')
      return; // not for us

    var fn = window[message.fn];
    if (!fn)
    {
      console.log('FN not found, message', message, sender);
    }

    if (message.args && message.args.push)
    {
      message.args.push(sender);
    }

    var result = fn.apply(window, message.args);
    sendResponse(result);
  });
})();

var getAdblockUserId = function ()
{
  return STATS.userId();
};

// passthrough functions
var addGABTabListeners = function (sender)
{
  gabQuestion.addGABTabListeners(sender);
};

var removeGABTabListeners = function (saveState)
{
  gabQuestion.removeGABTabListeners(saveState);
};

// INFO ABOUT CURRENT PAGE

// Get interesting information about the current tab.
// Inputs:
// callback: function(info).
// info object passed to callback: {
// tab: Tab object
// whitelisted: bool - whether the current tab's URL is whitelisted.
// disabled_site: bool - true if the url is e.g. about:blank or the
// Extension Gallery, where extensions don't run.
// total_blocked: int - # of ads blocked since install
// tab_blocked: int - # of ads blocked on this tab
// display_stats: bool - whether block counts are displayed on button
// display_menu_stats: bool - whether block counts are displayed on the popup
// menu
// }
// Returns: null (asynchronous)
var getCurrentTabInfo = function (callback, secondTime)
{
  try
  {
    chrome.tabs.query(
    {
      active: true,
      lastFocusedWindow: true,
    }, tabs =>
    {
      try
      {
        if (tabs.length === 0)
        {
          return; // For example: only the background devtools or a popup are opened
        }
        tab = tabs[0];

        if (tab && !tab.url)
        {
          // Issue 6877: tab URL is not set directly after you opened a window
          // using window.open()
          if (!secondTime)
            window.setTimeout(function ()
            {
              getCurrentTabInfo(callback, true);
            }, 250);

          return;
        }
        chrome.storage.local.get(License.myAdBlockEnrollmentFeatureKey, (myAdBlockInfo) =>
        {
          try
          {
            const page = new ext.Page(tab);
            var disabledSite = pageIsUnblockable(page.url.href);
            var displayStats = Prefs.show_statsinicon;

            var result =
            {
              page: page,
              tab: tab,
              disabledSite: disabledSite,
              settings: getSettings(),
              myAdBlockInfo: myAdBlockInfo
            };

            if (!disabledSite)
            {
              result.whitelisted = checkWhitelisted(page);
            }
            if (getSettings().youtube_channel_whitelist
                && parseUri(tab.url).hostname === 'www.youtube.com') {
              result.youTubeChannelName = ytChannelNamePages.get(page.id);
              // handle the odd occurence of when the  YT Channel Name
              // isn't available in the ytChannelNamePages map
              // obtain the channel name from the URL
              // for instance, when the forward / back button is clicked
              if (!result.youTubeChannelName && /ab_channel/.test(tab.url)) {
                result.youTubeChannelName = parseUri.parseSearch(tab.url).ab_channel;
              }
            }
            callback(result);
          }
          catch(err)
          {
            callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
          }
        });// end of chrome.storage.local.get
      }
      catch(err)
      {
        callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
      }
    });
  }
  catch(err)
  {
    callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
  }
}

// Returns true if the url cannot be blocked
var pageIsUnblockable = function (url) {
  if (!url) { // Protect against empty URLs - e.g. Safari empty/bookmarks/top sites page
    return true;
  } else {
    var scheme = '';
    if (!url.protocol) {
      scheme = parseUri(url).protocol;
    } else {
      scheme = url.protocol;
    }

    return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
  }
}

// Returns true if the page is whitelisted.
// Called from a content script
var pageIsWhitelisted = function(sender) {
  return (checkWhitelisted(sender.page) != undefined);
}

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
var pausedKey = 'paused';
var pausedFilterText1 = '@@';  // white-list all blocking requests regardless of frame / document, but still allows element hiding
var pausedFilterText2 = '@@*$document';  // white-list all documents, which prevents element hiding
var adblockIsPaused = function (newValue)
{
  if (newValue === undefined)
  {
    return (sessionstorage_get(pausedKey) === true);
  }

  // Add a filter to white list every page.
  var result1 = parseFilter(pausedFilterText1);
  var result2 = parseFilter(pausedFilterText2);
  if (newValue === true)
  {
    filterStorage.addFilter(result1.filter);
    filterStorage.addFilter(result2.filter);
    chromeStorageSetHelper(pausedKey, true);
  } else
  {
    filterStorage.removeFilter(result1.filter);
    filterStorage.removeFilter(result2.filter);
    chrome.storage.local.remove(pausedKey);
  }

  sessionstorage_set(pausedKey, newValue);
};

// Get or set if AdBlock is domain paused for the domain of the specified tab
// Inputs:  activeTab (optional object with url and id properties): the paused tab
//          newValue (optional boolean): if true, AdBlock will be domain paused
// on the tab's domain, if false, AdBlock will not be domain paused on that domain.
// Returns: undefined if activeTab and newValue were specified; otherwise if activeTab
// is specified it returns true if domain paused, false otherwise; finally it returns
// the complete storedDomainPauses if activeTab is not specified
var domainPausedKey = 'domainPaused';
var adblockIsDomainPaused = function (activeTab, newValue)
{
  // get stored domain pauses
  var storedDomainPauses = sessionstorage_get(domainPausedKey);

  // return the complete list of stored domain pauses if activeTab is undefined
  if (activeTab === undefined)
  {
    return storedDomainPauses;
  }

  // return a boolean indicating whether the domain is paused if newValue is undefined
  var activeDomain = parseUri(activeTab.url).host;
  if (newValue === undefined)
  {
    if (storedDomainPauses)
    {
      return (storedDomainPauses.hasOwnProperty(activeDomain));
    } else
    {
      return false;
    }
  }

  // create storedDomainPauses object if needed
  if (!storedDomainPauses)
  {
    storedDomainPauses = {};
  }

  // set or delete a domain pause
  var result = parseFilter("@@" + activeDomain + "$document");
  if (newValue === true)
  {
    // add a domain pause
    filterStorage.addFilter(result.filter);
    storedDomainPauses[activeDomain] = activeTab.id;
    chrome.tabs.onUpdated.removeListener(domainPauseNavigationHandler);
    chrome.tabs.onRemoved.removeListener(domainPauseClosedTabHandler);
    chrome.tabs.onUpdated.addListener(domainPauseNavigationHandler);
    chrome.tabs.onRemoved.addListener(domainPauseClosedTabHandler);
  } else
  {
    // remove the domain pause
    filterStorage.removeFilter(result.filter);
    delete storedDomainPauses[activeDomain];
  }

  // save the updated list of domain pauses
  saveDomainPauses(storedDomainPauses);
};

// Handle the effects of a tab update event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (required object with a url property): contains the
// new url for the tab
//          tab (optional Tab object): the affected tab
// Returns: undefined
var domainPauseNavigationHandler = function(tabId, changeInfo, tab)
{
  if (changeInfo === undefined || changeInfo.url === undefined || tabId === undefined)
  {
    return;
  }

  var newDomain = parseUri(changeInfo.url).host;

  domainPauseChangeHelper(tabId, newDomain);
};

// Handle the effects of a tab remove event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (optional object): info about the remove event
// Returns: undefined
var domainPauseClosedTabHandler = function(tabId, removeInfo)
{
  if (tabId === undefined)
  {
    return;
  }

  domainPauseChangeHelper(tabId);
};

// Helper that removes any domain pause filter rules based on tab events
// Inputs:  tabId (required integer): identifier for the affected tab
//          newDomain (optional string): the current domain of the tab
// Returns: undefined
var domainPauseChangeHelper = function(tabId, newDomain)
{
  // get stored domain pauses
  var storedDomainPauses = sessionstorage_get(domainPausedKey);

  // check if any of the stored domain pauses match the affected tab
  for (var aDomain in storedDomainPauses)
  {
    if (storedDomainPauses[aDomain] === tabId && aDomain != newDomain)
    {
      // Remove the filter that white-listed the domain
      var result = parseFilter("@@" + aDomain + "$document");
      filterStorage.removeFilter(result.filter);
      delete storedDomainPauses[aDomain];

      // save updated domain pauses
      saveDomainPauses(storedDomainPauses);
    }
  }
  updateButtonUIAndContextMenus();
};

// Helper that saves the domain pauses
// Inputs:  domainPauses (required object): domain pauses to save
// Returns: undefined
var saveDomainPauses = function(domainPauses)
{
  chromeStorageSetHelper(domainPausedKey, domainPauses);
  sessionstorage_set(domainPausedKey, domainPauses);
}

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
chrome.storage.local.get(pausedKey, function (response)
{
  if (response[pausedKey])
  {
    var pauseHandler = function (action)
    {
      filterNotifier.off("load", pauseHandler);
      var result1 = parseFilter(pausedFilterText1);
      var result2 = parseFilter(pausedFilterText2);
      filterStorage.removeFilter(result1.filter);
      filterStorage.removeFilter(result2.filter);
      chrome.storage.local.remove(pausedKey);
    };

    filterNotifier.on("load", pauseHandler);
  }
});

// If AdBlock was domain paused on shutdown, then unpause / remove
// all domain pause white-list entries at startup.
chrome.storage.local.get(domainPausedKey, function (response)
{
  try
  {
    var storedDomainPauses = response[domainPausedKey];
    if (!jQuery.isEmptyObject(storedDomainPauses))
    {
      var domainPauseHandler = function (action)
      {
        filterNotifier.off("load", domainPauseHandler);
        for (var aDomain in storedDomainPauses)
        {
          var result = parseFilter("@@" + aDomain + "$document");
          filterStorage.removeFilter(result.filter);
        }
        chrome.storage.local.remove(domainPausedKey);
      };
      filterNotifier.on("load", domainPauseHandler);
    }
  } catch (err)
  {
    // do nothing
  }
});

chrome.commands.onCommand.addListener(function(command) {
  if (command === "toggle_pause") {
    adblockIsPaused(!adblockIsPaused());
    recordGeneralMessage("pause_shortcut_used");
  }
});

// Return the contents of a local file.
// Inputs: file:string - the file relative address, eg "js/foo.js".
// Returns: the content of the file.
var readfile = function (file)
{
  // A bug in jquery prevents local files from being read, so use XHR.
  var xhr = new XMLHttpRequest();
  xhr.open('GET', chrome.extension.getURL(file), false);
  xhr.send();
  return xhr.responseText;
};

// BETA CODE
if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
  // Display beta page after each update for beta-users only
  chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === 'update' || details.reason === 'install') {
      chrome.tabs.create({ url: 'https://getadblock.com/beta' });
    }
  });
}

var updateStorageKey = 'last_known_version';
chrome.runtime.onInstalled.addListener(function (details)
{
  if (details.reason === 'update' || details.reason === 'install')
  {
    localStorage.setItem(updateStorageKey, chrome.runtime.getManifest().version);
  }
});

var openTab = function (url)
{
  chrome.tabs.create({ url })
};

if (chrome.runtime.id)
{
  var updateTabRetryCount = 0;
  var getUpdatedURL = function()
  {
    var updatedURL = 'https://getadblock.com/update/' + encodeURIComponent(chrome.runtime.getManifest().version) + '/?u=' + STATS.userId();
    updatedURL = updatedURL + '&bc=' + Prefs.blocked_total;
    updatedURL = updatedURL + '&rt=' + updateTabRetryCount;
    return updatedURL;
  };
  var waitForUserAction = function()
  {
    chrome.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(function ()
    {
      updateTabRetryCount++;
      openUpdatedPage();
    }, 10000); // 10 seconds
  };
  var openUpdatedPage = function()
  {
    var updatedURL = getUpdatedURL();
    chrome.tabs.create({ url: updatedURL }, function(tab)
    {
      // if we couldn't open a tab to '/updated_tab', send a message
      if (chrome.runtime.lastError || !tab)
      {
        if (chrome.runtime.lastError && chrome.runtime.lastError.message)
        {
          recordErrorMessage('updated_tab_failed_to_open', undefined, { errorMessage: chrome.runtime.lastError.message });
        }
        else
        {
          recordErrorMessage('updated_tab_failed_to_open');
        }
        chrome.tabs.onCreated.removeListener(waitForUserAction);
        chrome.tabs.onCreated.addListener(waitForUserAction);
        return;
      }
      if (updateTabRetryCount > 0)
      {
        recordGeneralMessage('updated_tab_retry_success_count_' + updateTabRetryCount);
      }
    });
  };
}

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var createWhitelistFilterForYoutubeChannel = function (url)
{
  if (/ab_channel=/.test(url))
  {
    var ytChannel = url.match(/ab_channel=([^]*)/)[1];
  } else
  {
    var ytChannel = url.split('/').pop();
  }

  if (ytChannel)
  {
    var filter = '@@|https://www.youtube.com/*' + ytChannel + '|$document';
    return addCustomFilter(filter);
  }
};

// YouTube Channel Whitelist and AdBlock Bandaids
var runChannelWhitelist = function (tabUrl, tabId)
{
  if (parseUri(tabUrl).hostname === 'www.youtube.com' && getSettings().youtube_channel_whitelist && !parseUri.parseSearch(tabUrl).ab_channel)
  {
    chrome.tabs.executeScript(tabId,
    {
      file: 'adblock-ytchannel.js',
      runAt: 'document_start',
    });
  }
};

chrome.tabs.onCreated.addListener(function (tab)
{
  if (chrome.runtime.lastError)
  {
    return;
  }
  chrome.tabs.get(tab.id, function (tabs)
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    if (tabs && tabs.url && tabs.id)
    {
      runChannelWhitelist(tabs.url, tabs.id);
    }
  });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab)
{
  if (chrome.runtime.lastError)
  {
    return;
  }
  if (changeInfo.status === 'loading')
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    chrome.tabs.get(tabId, function (tabs)
    {
      if (tabs && tabs.url && tabs.id)
      {
        runChannelWhitelist(tabs.url, tabs.id);
      }
    });
  }
});

// On single page sites, such as YouTube, that update the URL using the History API pushState(),
// they don't actually load a new page, we need to get notified when this happens
// and update the URLs in the Page and Frame objects
var youTubeHistoryStateUpdateHanlder = function(details) {
  if (details &&
      details.hasOwnProperty("frameId") &&
      details.hasOwnProperty("tabId") &&
      details.hasOwnProperty("url") &&
      details.hasOwnProperty("transitionType") &&
      details.transitionType === "link")
  {
    var myURL = new URL(details.url);
    if (myURL.hostname === "www.youtube.com")
    {
      var myFrame = ext.getFrame(details.tabId, details.frameId);
      var myPage = ext.getPage(details.tabId);
      var previousWhitelistState = checkWhitelisted(myPage);
      myPage.url = myURL;
      myPage._url = myURL;
      myFrame.url = myURL;
      myFrame._url = myURL;
      var currentWhitelistState = checkWhitelisted(myPage);
      if (!currentWhitelistState && (currentWhitelistState !== previousWhitelistState)) {
        myPage.sendMessage({type: "reloadStyleSheet"});
      }
      if (myURL.pathname === "/") {
        ytChannelNamePages.set(myPage.id, "");
      }
    }
  }
};

var addYouTubeHistoryStateUpdateHanlder = function() {
  chrome.webNavigation.onHistoryStateUpdated.addListener(youTubeHistoryStateUpdateHanlder);
};

var removeYouTubeHistoryStateUpdateHanlder = function() {
  chrome.webNavigation.onHistoryStateUpdated.removeListener(youTubeHistoryStateUpdateHanlder);
};

settings.onload().then(function()
{
  if (getSettings().youtube_channel_whitelist)
  {
    addYouTubeHistoryStateUpdateHanlder();
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
    {
      if (!getSettings().youtube_channel_whitelist)
      {
        return;
      }
      if (ytChannelNamePages.get(tabId) && parseUri(tab.url).hostname !== 'www.youtube.com')
      {
        ytChannelNamePages.delete(tabId);
        return;
      }
    });
    chrome.tabs.onRemoved.addListener(function(tabId)
    {
      if (!getSettings().youtube_channel_whitelist)
      {
        return;
      }
      ytChannelNamePages.delete(tabId);
    });
  }
});

var previousYTchannelId ="";
var previousYTvideoId ="";
var previousYTuserId ="";

// Listen for the message from the ytchannel.js content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'updateYouTubeChannelName' && message.args === false) {
    ytChannelNamePages.set(sender.tab.id, "");
    sendResponse({});
    return;
  }
  if (message.command === 'updateYouTubeChannelName' && message.channelName) {
    ytChannelNamePages.set(sender.tab.id, message.channelName);
    sendResponse({});
    return;
  }
  if (message.command === 'get_channel_name_by_channel_id' && message.channelId) {
    if (previousYTchannelId !== message.channelId) {
      previousYTchannelId = message.channelId;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + message.channelId + "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"));
      xhr.onload = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: channelName });
          }
        }
      }
      xhr.send();
      sendResponse({});
      return;
    } else {
      chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: ytChannelNamePages.get(sender.tab.id) });
      sendResponse({});
      return;
    }
  }
  if (message.command === 'get_channel_name_by_video_id' && message.videoId) {
    if (previousYTvideoId !== message.videoId) {
      previousYTvideoId = message.videoId;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + message.videoId + "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"));
      xhr.onload = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.channelTitle;
            ytChannelNamePages.set(sender.tab.id, channelName);
            chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: channelName });
          }
        }
      }
      xhr.send();
      sendResponse({});
      return;
    } else {
      chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: ytChannelNamePages.get(sender.tab.id) });
      sendResponse({});
      return;
    }
  }
  if (message.command === 'get_channel_name_by_user_id' && message.userId) {
    if (previousYTuserId !== message.userId) {
      previousYTuserId = message.userId;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=" + message.userId + "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"));
      xhr.onload = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0])
          {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: channelName });
          }
        }
      }
      xhr.send();
      sendResponse({});
      return;
    } else {
      chrome.tabs.sendMessage(sender.tab.id, { command: 'updateURLWithYouTubeChannelName', channelName: ytChannelNamePages.get(sender.tab.id) });
      sendResponse({});
      return;
    }
  }
});
var ytChannelNamePages = new Map();

// These functions are usually only called by content scripts.

// DEBUG INFO

// Get debug info as a JSON object for bug reporting and ad reporting
var getDebugInfo = function (callback) {
  response = {};
  response.other_info = {};

  // Is this installed build of AdBlock the official one?
  if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
    response.other_info.buildtype = ' Beta';
  } else if (chrome.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom' || chrome.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj') {
    response.other_info.buildtype = ' Stable';
  } else {
    response.other_info.buildtype = ' Unofficial';
  }

  // Get AdBlock version
  response.other_info.version = chrome.runtime.getManifest().version;

  // Get subscribed filter lists
  var subscriptionInfo = {};
  var subscriptions = getSubscriptionsMinusText();
  for (var id in subscriptions) {
    if (subscriptions[id].subscribed) {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
      subscriptionInfo[id].downloadCount = subscriptions[id].downloadCount;
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  response.subscriptions = subscriptionInfo;

  var userFilters = getUserFilters();
  if (userFilters && userFilters.length) {
    response.custom_filters = userFilters.join("\n");
  }

  // Get settings
  var adblockSettings = {};
  var settings = getSettings();
  for (setting in settings) {
    adblockSettings[setting] = JSON.stringify(settings[setting]);
  }

  response.settings = adblockSettings;
  response.prefs = JSON.stringify(Prefs);
  response.other_info.browser = STATS.browser;
  response.other_info.browserVersion = STATS.browserVersion;
  response.other_info.osVersion = STATS.osVersion;
  response.other_info.os = STATS.os;
  if (window['blockCounts']) {
    response.other_info.blockCounts = blockCounts.get();
  }
  if (localStorage &&
      localStorage.length) {
    response.other_info.localStorageInfo = {};
    response.other_info.localStorageInfo['length'] = localStorage.length;
    var inx = 1;
    for (var key in localStorage) {
      response.other_info.localStorageInfo['key'+inx]= key;
      inx++;
    }
  } else {
    response.other_info.localStorageInfo = "no data";
  }
  response.other_info.is_adblock_paused = adblockIsPaused();
  response.other_info.license_state = License.get().status;
  response.other_info.license_version = License.get().lv;

  // Get total pings
  chrome.storage.local.get('total_pings', function (storageResponse) {
    response.other_info.total_pings = storageResponse.total_pings || 0;

    // Now, add exclude filters (if there are any)
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (secondResponse) {
      if (secondResponse && secondResponse[excludeFiltersKey]) {
        response.excluded_filters = secondResponse[excludeFiltersKey];
      }
      // Now, add JavaScript exception error (if there is one)
      var errorKey = 'errorkey';
      chrome.storage.local.get(errorKey, function (errorResponse) {
        if (errorResponse && errorResponse[errorKey]) {
          response.other_info[errorKey] = errorResponse[errorKey];
        }
        // Now, add the migration messages (if there are any)
        var migrateLogMessageKey = 'migrateLogMessageKey';
        chrome.storage.local.get(migrateLogMessageKey, function (migrateLogMessageResponse) {
          if (migrateLogMessageResponse && migrateLogMessageResponse[migrateLogMessageKey]) {
            messages = migrateLogMessageResponse[migrateLogMessageKey].split('\n');
            for (var i = 0; i < messages.length; i++) {
              var key = 'migration_message_' + i;
              response.other_info[key] = messages[i];
            }
          }
          if (License.isActiveLicense()) {
            response.other_info.license_info = {};
            response.other_info.license_info.extensionGUID = STATS.userId();
            response.other_info.license_info.licenseId = License.get().licenseId;
            if (getSettings().sync_settings) {
              response.other_info.sync_info = {};
              response.other_info.sync_info['SyncCommitVersion'] = SyncService.getCommitVersion();
              response.other_info.sync_info['SyncCommitName'] = SyncService.getCurrentExtensionName();
              response.other_info.sync_info['SyncCommitLog'] = SyncService.getSyncLog();
            }
            chrome.alarms.getAll(function(alarms) {
              if (alarms && alarms.length > 0) {
                response.other_info['Alarm info'] = 'length: ' + alarms.length;
                for (var i = 0; i < alarms.length; i++) {
                  var alarm = alarms[i];
                  response.other_info[i + " Alarm Name"] = alarm.name;
                  response.other_info[i + " Alarm Scheduled Time"] = new Date(alarm.scheduledTime);
                }
              } else {
                response.other_info['No alarm info'];
              }
              License.getLicenseInstallationDate(function(installdate) {
                response.other_info["License Installation Date"] = installdate;
                if (typeof callback === 'function') {
                  callback(response);
                }
              });
            });
          } else { // License is not active
            if (typeof callback === 'function') {
              callback(response);
            }
          }
        });
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists()
{
  for (let subscription of filterStorage.subscriptions()) {
    if (subscription instanceof DownloadableSubscription)
    {
      Synchronizer.execute(subscription, true, true);
    }
  }
}

function getUserFilters()
{
  var filters = [];
  var exceptions = [];

  for (let subscription of filterStorage.subscriptions()) {
    if (!(subscription instanceof SpecialSubscription))
    {
      continue;
    }

    for (var j = 0; j < subscription._filters.length; j++)
    {
      var filter = subscription._filters[j];
      filters.push(filter.text);
    }
  }

  return filters;
}


STATS.untilLoaded(function(userID)
{
  STATS.startPinging();
  uninstallInit();
});

// Create the "blockage stats" for the uninstall logic ...
chrome.runtime.onInstalled.addListener(function (details)
{
  if (details.reason === 'install')
  {
    chrome.storage.local.get("blockage_stats", function(response) {
      var blockage_stats = response.blockage_stats;
      if (!blockage_stats)
      {
        data = {};
        data.start = Date.now();
        data.version = 1;
        chromeStorageSetHelper("blockage_stats", data);
      }
    });
  }
});

// AdBlock Protect integration
//
// Check the response from a ping to see if it contains valid show AdBlock Protect enrollment instructions.
// If so, set the "show_protect_enrollment" setting
// if an empty / zero length string is returned, and a user was previously enrolled then
// set "show_protect_enrollment" to false
// Inputs:
//   responseData: string response from a ping
function checkPingResponseForProtect(responseData) {
  if (responseData.length === 0 || responseData.trim().length === 0) {
    if (getSettings().show_protect_enrollment) {
      setSetting("show_protect_enrollment", false);
    }
    return;
  }
  // if the user has clicked the Protect CTA, which sets the |show_protect_enrollment| to false
  // then don't re-enroll them, even if the ping server has a show_protect_enrollment = true.
  if (getSettings().show_protect_enrollment === false) {
    return;
  }
  try {
    var pingData = JSON.parse(responseData);
  } catch (e) {
    console.log("Something went wrong with parsing survey data.");
    console.log('error', e);
    console.log('response data', responseData);
    return;
  }
  if (!pingData){
    return;
  }
  if (typeof pingData.protect_enrollment === "boolean") {
    setSetting("show_protect_enrollment", pingData.protect_enrollment);
  }
}


// Attach methods to window
Object.assign(window, {
  adblockIsPaused,
  createPageWhitelistFilter,
  getUserFilters,
  updateFilterLists,
  getDebugInfo,
  createWhitelistFilterForYoutubeChannel,
  openTab,
  readfile,
  saveDomainPauses,
  adblockIsDomainPaused,
  pageIsWhitelisted,
  pageIsUnblockable,
  getCurrentTabInfo,
  getAdblockUserId,
  createPageWhitelistFilter,
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
  addYouTubeHistoryStateUpdateHanlder,
  removeYouTubeHistoryStateUpdateHanlder,
  ytChannelNamePages,
  checkPingResponseForProtect,
  pausedFilterText1,
  pausedFilterText2,
  isLanguageSpecific
});
