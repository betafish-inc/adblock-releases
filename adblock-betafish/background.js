var getDecodedHostname = require('url').getDecodedHostname;
with (require('filterClasses'))
{
  this.Filter = Filter;
  this.WhitelistFilter = WhitelistFilter;
}

with (require('subscriptionClasses'))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}

with (require('filterValidation'))
{
  this.parseFilter = parseFilter;
  this.parseFilters = parseFilters;
}

var FilterStorage = require('filterStorage').FilterStorage;
var FilterNotifier = require('filterNotifier').FilterNotifier;
var Prefs = require('prefs').Prefs;
var Synchronizer = require('synchronizer').Synchronizer;
var Utils = require('utils').Utils;
var NotificationStorage = require('notification').Notification;

// TODO
// Temporary...
var SAFARI = false;

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
  if (!customFilters || !customFilters.filters || !customFilters.filters.length === 0)
  {
    return false;
  }

  for (var i = 0; i < customFilters.filters.length; i++)
  {
    var text = customFilters.filters[i];
    var whitelist = text.search(/@@\*\$document,domain=\~/);

    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1)
    {
      // Remove protocols
      url = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/)[0];
      var oldFilter = Filter.fromText(text);
      FilterStorage.removeFilter(oldFilter);
      var newFilter = Filter.fromText(text + '|~' + url);
      FilterStorage.addFilter(newFilter);
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
      FilterStorage.removeFilter(filter);
      return true;
    }
  }

  return false;
};

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
var addCustomFilter = function (filterText)
{
  try
  {
    var filter = Filter.fromText(filterText);
    FilterStorage.addFilter(filter);
    if (isSelectorFilter(filterText))
    {
      countCache.addCustomFilterCount(filterText);
    }

    return null;
  }
  catch (ex)
  {
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
  if (!customFilters || !customFilters.filters || !customFilters.filters.length === 0)
  {
    return false;
  }

  var customFiltersArr = customFilters.filters;
  var identifier = host;

  for (var i = 0; i < customFiltersArr.length; i++)
  {
    var entry = customFiltersArr[i];

    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.indexOf(identifier) === 0)
    {
      var filter = Filter.fromText(entry);
      FilterStorage.removeFilter(filter);
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
    ext.storage.set('custom_filter_count', cache);
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
      ext.storage.get('custom_filter_count', function (response)
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
  if (!SAFARI)
  {
    chrome.tabs.reload();
  } else
  {
    activeTab.url = activeTab.url;
  }
};

// Reload already opened tab
// Input:
// tabId: integer - id of the tab which should be reloaded
reloadTab = function (tabId)
{
  var listener = function (tabId, changeInfo, tab)
  {
    if (changeInfo.status === 'complete' && tab.status === 'complete')
    {
      setTimeout(function ()
      {
        chrome.runtime.sendMessage(
        {
          command: 'reloadcomplete',
        });
        chrome.tabs.onUpdated.removeListener(listener);
      }, 2000);
    }
  };

  chrome.tabs.reload(tabId,
  {
    bypassCache: true,
  }, function ()
  {
    chrome.tabs.onUpdated.addListener(listener);
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
  ext.onMessage.addListener(function (message, sender, sendResponse)
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
  ext.pages.query(
  {
    active: true,
    lastFocusedWindow: true,
  }, function (pages)
  {
    if (pages.length === 0)
    {
      return; // For example: only the background devtools or a popup are opened
    }
    page = pages[0];

    if (page && !page.url)
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

    page.unicodeUrl = getUnicodeUrl(page.url.href);
    var disabledSite = pageIsUnblockable(page.unicodeUrl);
    var displayStats = Prefs.show_statsinicon;

    var result =
    {
      page: page,
      disabledSite: disabledSite,
      settings: getSettings()
    };

    if (!disabledSite)
    {
      result.whitelisted = checkWhitelisted(page);
    }

    callback(result);
  });
};

// Returns true if the url cannot be blocked
var pageIsUnblockable = function (url)
{
  if (!url)
  { // Safari empty/bookmarks/top sites page
    return true;
  } else
  {
    var scheme = '';
    if (!url.protocol)
    {
      scheme = parseUri(url).protocol;
    } else
    {
      scheme = url.protocol;
    }

    return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
  }
};

// Returns true if the page is whitelisted.
// Called from a content script
var pageIsWhitelisted = function(sender)
{
  return (checkWhitelisted(sender.page) != undefined);
}

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
var pausedKey = 'paused';
var pausedFilterText = '@@^$document';
var adblockIsPaused = function (newValue)
{
  if (newValue === undefined)
  {
    return (sessionstorage_get(pausedKey) === true);
  }

  // Add a filter to white list every page.
  var result = parseFilter(pausedFilterText);
  if (newValue === true)
  {
    FilterStorage.addFilter(result.filter);
    ext.storage.set(pausedKey, true);
  } else
  {
    FilterStorage.removeFilter(result.filter);
    ext.storage.remove(pausedKey);
  }

  sessionstorage_set(pausedKey, newValue);
};

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
ext.storage.get(pausedKey, function (response)
{
  if (response[pausedKey])
  {
    var pauseHandler = function (action)
    {
      if (action == 'load')
      {
        FilterNotifier.removeListener(pauseHandler);
        var result = parseFilter(pausedFilterText);
        FilterStorage.removeFilter(result.filter);
        ext.storage.remove(pausedKey);
      }
    };

    FilterNotifier.addListener(pauseHandler);
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

if (!SAFARI && chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk')
{
  // Display beta page after each update for beta-users only
  chrome.runtime.onInstalled.addListener(function (details)
  {
    if (details.reason === 'update' || details.reason === 'install')
    {
      ext.pages.open('https://getadblock.com/beta');
    }
  });
}

var openTab = function (url)
{
  ext.pages.open(url);
};

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
// Script injection logic for Safari is done in safari_bg.js
if (!SAFARI)
{
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

  var runBandaids = function (tabUrl, tabId)
  {
    var hostname = parseUri(tabUrl).hostname;
    if (/.*\.mail\.live\.com/i.test(hostname) || /.*\.mastertoons\.com/i.test(hostname) || hostname === 'getadblock.com' || hostname === 'dev.getadblock.com'
        || /.*\.mobilmania\.cz/i.test(hostname) || /.*\.zive\.cz/i.test(hostname) || /.*\.doupe\.cz/i.test(hostname) || /.*\.e15\.cz/i.test(hostname)
        || /.*\.sportrevue\.cz/i.test(hostname) || /.*\.autorevue\.cz/i.test(hostname))
    {
      chrome.tabs.executeScript(tabId,
      {
        file: 'adblock-bandaids.js',
        runAt: 'document_start',
      }, function ()
      {
        if (chrome.runtime.lastError)
        {
          return;
        }
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
        runBandaids(tabs.url, tabs.id);
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
          runBandaids(tabs.url, tabs.id);
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
      }
    }
  };

  var addYouTubeHistoryStateUpdateHanlder = function() {
    chrome.webNavigation.onHistoryStateUpdated.addListener(youTubeHistoryStateUpdateHanlder);
  };

  var removeYouTubeHistoryStateUpdateHanlder = function() {
    chrome.webNavigation.onHistoryStateUpdated.removeListener(youTubeHistoryStateUpdateHanlder);
  };

  _settings.onload().then(function()
  {
    if (getSettings().youtube_channel_whitelist)
    {
      addYouTubeHistoryStateUpdateHanlder();
    }
  });
}

// used by the Options pages, since they don't have access to setContentBlocker
function isSafariContentBlockingAvailable()
{
  return (SAFARI && safari && safari.extension && (typeof safari.extension.setContentBlocker === 'function'));
}

// These functions are usually only called by content scripts.

// DEBUG INFO

// Get debug info as a JSON object for bug reporting and ad reporting
var getDebugInfo = function (callback)
{
  response = {};
  response.other_info = {};

  // Is this installed build of AdBlock the official one?
  if (!SAFARI)
  {
    if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk')
    {
      response.other_info.buildtype = ' Beta';
    } else if (chrome.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom' || chrome.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj')
    {
      response.other_info.buildtype = ' Stable';
    } else
    {
      response.other_info.buildtype = ' Unofficial';
    }
  } else
  {
    if (safari.extension.baseURI.indexOf('com.betafish.adblockforsafari-UAMUU4S2D9') > -1)
    {
      response.other_info.buildtype = ' Stable';
    } else
    {
      response.other_info.buildtype = ' Unofficial';
    }
  }

  // Get AdBlock version
  response.other_info.version = chrome.runtime.getManifest().version;

  // Get subscribed filter lists
  var subscriptionInfo = {};
  var subscriptions = getSubscriptionsMinusText();
  for (var id in subscriptions)
  {
    if (subscriptions[id].subscribed)
    {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
      subscriptionInfo[id].downloadCount = subscriptions[id].downloadCount;
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  response.subscriptions = subscriptionInfo;

  var userFilters = getUserFilters();
  if (userFilters && userFilters.filters && userFilters.filters.length)
  {
    response.custom_filters = userFilters.filters;
  }

  // Get settings
  var adblockSettings = {};
  var settings = getSettings();
  for (setting in settings)
  {
    adblockSettings[setting] = JSON.stringify(settings[setting]);
  }

  response.settings = adblockSettings;
  response.prefs = JSON.stringify(Prefs);
  response.other_info.browser = STATS.browser;
  response.other_info.browserVersion = STATS.browserVersion;
  response.other_info.osVersion = STATS.osVersion;
  response.other_info.os = STATS.os;
  if (window['blockCounts'])
  {
    response.other_info.blockCounts = blockCounts.get();
  }

  // Get total pings
  ext.storage.get('total_pings', function (storageResponse)
  {
    response.other_info.total_pings = storageResponse.total_pings || 0;

    // Now, add exclude filters (if there are any)
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (secondResponse)
    {
      if (secondResponse && secondResponse[excludeFiltersKey])
      {
        response.excluded_filters = secondResponse[excludeFiltersKey];
      }
      // Now, add the migration messages (if there are any)
      var migrateLogMessageKey = 'migrateLogMessageKey';
      chrome.storage.local.get(migrateLogMessageKey, function (thirdResponse)
      {
        if (thirdResponse && thirdResponse[migrateLogMessageKey])
        {
          messages = thirdResponse[migrateLogMessageKey].split('\n');
          for (var i = 0; i < messages.length; i++)
          {
            var key = 'migration_message_' + i;
            response.other_info[key] = messages[i];
          }
        }
        if (callback)
        {
          callback(response);
        }
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists()
{
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (subscription instanceof DownloadableSubscription)
    {
      Synchronizer.execute(subscription, true, true);
    }
  }

  if (malwareList)
  {
    malwareList.checkFilterUpdates(true);
  }
}

function getUserFilters()
{
  var filters = [];
  var exceptions = [];

  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (!(subscription instanceof SpecialSubscription))
    {
      continue;
    }

    for (var j = 0; j < subscription.filters.length; j++)
    {
      var filter = subscription.filters[j];
      if (filter instanceof WhitelistFilter &&  /^@@\|\|([^\/:]+)\^\$document$/.test(filter.text))
      {
        exceptions.push(RegExp.$1);
      } else {
        filters.push(filter.text);
      }
    }
  }

  return {filters: filters, exceptions: exceptions};
}

// Remove comment when migration code is removed
// STATS = STATS();
// STATS.startPinging();

// malwareList = new MalwareList();
// malwareList.init();

log('\n===FINISHED LOADING===\n\n');
