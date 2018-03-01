DataCollectionV2 = (function()
{

  "use strict";
  const {extractHostFromFrame} = require("url");
  const {RegExpFilter,
         WhitelistFilter,
         ElemHideFilter} = require("filterClasses");
  var HOUR_IN_MS = 1000 * 60 * 60;
  var TIME_LAST_PUSH_KEY = "timeLastPush";

  // Setup memory cache
  var dataCollectionCache = {};
  dataCollectionCache.filters = {};
  dataCollectionCache.domains = {};

  var handleTabUpdated = function(tabId, changeInfo, tabInfo)
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    if (!tabInfo || !tabInfo.url)
    {
      return;
    }
    let url = parseUri(tabInfo.url);
    if (url.protocol !== "http:" && url.protocol !== "https:")
    {
      return;
    }
    if (getSettings().data_collection_v2 && !adblockIsPaused() && !adblockIsDomainPaused({"url": tabInfo.url, "id": tabId}) && changeInfo.status === 'loading'  )
    {
      chrome.tabs.executeScript(tabId,
      {
          file: 'adblock-datacollection-contentscript.js',
          allFrames: true,
          runAt: 'document_idle'
      }, function()
      {
        if (chrome.runtime.lastError)
        {
          return;
        }
      });
    }
  };

  var addMessageListener = function()
  {
    port.on("datacollection.elementHide", (message, sender) =>
    {
      if (getSettings().data_collection_v2 && !adblockIsPaused() && !adblockIsDomainPaused({"url": sender.page.url, "id": sender.page.id}))
      {
        var selectors = message.selectors;
        var filters = message.filters;
        var docDomain = extractHostFromFrame(sender.frame);

        for (let subscription of FilterStorage.subscriptions)
        {
          if (subscription.disabled)
            continue;

          for (let filter of subscription.filters)
          {
            // We only know the exact filter in case of element hiding emulation.
            // For regular element hiding filters, the content script only knows
            // the selector, so we have to find a filter that has an identical
            // selector and is active on the domain the match was reported from.
            let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                         selectors.includes(filter.selector) &&
                                         filter.isActiveOnDomain(docDomain);

            if (isActiveElemHideFilter || filters.includes(filter.text))
            {
              addFilterToCache(filter, sender.page);
            }
          }
        }
      }
    });
  };

  var webRequestListener = function(details)
  {
    if (details.url && details.type === "main_frame" && !adblockIsPaused() && !adblockIsDomainPaused({"url": details.url, "id": details.id}))
    {
      var domain = parseUri(details.url).host;
      if (!dataCollectionCache.domains[domain]) {
        dataCollectionCache.domains[domain] = {};
        dataCollectionCache.domains[domain].pages = 0;
      }
      dataCollectionCache.domains[domain].pages++;
    }
  };

  var addFilterToCache = function(filter, page)
  {
      if (filter && filter.text && (typeof filter.text === 'string') && page && page.url)
      {
        var domain = parseUri(page.url).host;
        if (!domain)
        {
          return;
        }
        var text = filter.text;

        if (!(text in dataCollectionCache.filters))
        {
          dataCollectionCache.filters[text] = {};
          dataCollectionCache.filters[text].firstParty = {};
          dataCollectionCache.filters[text].thirdParty = {};
          dataCollectionCache.filters[text].subscriptions = [];
        }
        if (filter.thirdParty)
        {
          if (!dataCollectionCache.filters[text].thirdParty[domain])
          {
            dataCollectionCache.filters[text].thirdParty[domain] = {};
            dataCollectionCache.filters[text].thirdParty[domain].hits = 0;
          }
          dataCollectionCache.filters[text].thirdParty[domain].hits++;
        }
        else
        {
          if (!dataCollectionCache.filters[text].firstParty[domain])
          {
            dataCollectionCache.filters[text].firstParty[domain] = {};
            dataCollectionCache.filters[text].firstParty[domain].hits = 0;
          }
          dataCollectionCache.filters[text].firstParty[domain].hits++;
        }
        if (filter.subscriptions && filter.subscriptions.length > 0)
        {
          filter.subscriptions.forEach(function(sub)
          {
            if (sub.url && dataCollectionCache.filters[text].subscriptions.indexOf(sub.url) === -1)
            {
              dataCollectionCache.filters[text].subscriptions.push(sub.url);
            }
          });
        }
      }
  };

  var filterListener = function(item, newValue, oldValue, page)
  {
    if (getSettings().data_collection_v2 && !adblockIsPaused() && (!page || !adblockIsDomainPaused({"url": page.unicodeUrl, "id": page.id})))
    {
      addFilterToCache(item, page);
    }
    else
    {
      FilterNotifier.removeListener(filterListener);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  _settings.onload().then(function()
  {
    if (getSettings().data_collection_v2)
    {
      window.setInterval(function()
      {
        idleHandler.scheduleItemOnce(function()
        {
          if (getSettings().data_collection_v2 && Object.keys(dataCollectionCache.filters).length > 0)
          {
            var subscribedSubs = [];
            var subs = getAllSubscriptionsMinusText();
            for (var id in subs) {
              if (subs[id].subscribed) {
                subscribedSubs.push(subs[id].url);
              }
            }
            if (getUserFilters()) {
              subscribedSubs.push("customlist");
            }
            var data = {
              version:                 "4",
              addonName:               require("info").addonName,
              addonVersion:            require("info").addonVersion,
              application:             require("info").application,
              applicationVersion:      require("info").applicationVersion,
              platform:                require("info").platform,
              platformVersion:         require("info").platformVersion,
              appLocale:               Utils.appLocale,
              filterListSubscriptions: subscribedSubs,
              domains:                 dataCollectionCache.domains,
              filters:                 dataCollectionCache.filters
            };
            ext.storage.get(TIME_LAST_PUSH_KEY, function(response) {
              var timeLastPush = "n/a";
              if (response[TIME_LAST_PUSH_KEY]) {
                var serverTimestamp = new Date(response[TIME_LAST_PUSH_KEY]);
                // Format the timeLastPush
                var yearStr = serverTimestamp.getUTCFullYear() + "";
                var monthStr = (serverTimestamp.getUTCMonth() + 1) + "";
                var dateStr = serverTimestamp.getUTCDate() + "";
                var hourStr = serverTimestamp.getUTCHours() + "";
                // round the minutes up to the nearest 10
                var minStr = (Math.floor(serverTimestamp.getUTCMinutes() / 10) * 10) + "";

                if (monthStr.length === 1) {
                   monthStr = "0" + monthStr;
                }
                if (dateStr.length === 1) {
                   dateStr = "0" + dateStr;
                }
                if (hourStr.length === 1) {
                   hourStr = "0" + hourStr;
                }
                if (minStr.length === 1) {
                   minStr = "0" + minStr;
                }
                if (minStr === "60") {
                   minStr = "00";
                }
                timeLastPush = yearStr + "-" + monthStr + "-" + dateStr + " " + hourStr + ":" + minStr + ":00";
              }
              data.timeOfLastPush = timeLastPush;
              postFilterStatsToLogServer( data, function(text, status, xhr) {
                var nowTimestamp = (new Date()).toGMTString();
                if (xhr && typeof xhr.getResponseHeader === "function") {
                  try {
                    if (xhr.getResponseHeader("Date")) {
                      nowTimestamp = xhr.getResponseHeader("Date");
                    }
                  } catch(e) {
                    nowTimestamp = (new Date()).toGMTString();
                  }
                }
                ext.storage.set(TIME_LAST_PUSH_KEY, nowTimestamp);
                // Reset memory cache
                dataCollectionCache = {};
                dataCollectionCache.filters = {};
                dataCollectionCache.domains = {};
              });
            });  // end of TIME_LAST_PUSH_KEY
          }
        });
      }, HOUR_IN_MS);
      FilterNotifier.on("filter.hitCount", filterListener);
      chrome.webRequest.onBeforeRequest.addListener(webRequestListener, { urls:  ["http://*/*", "https://*/*"],types: ["main_frame"] });
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
      addMessageListener();
    }
  });// End of then

  var returnObj = {};
  returnObj.start = function()
  {
    dataCollectionCache.filters = {};
    dataCollectionCache.domains = {};
    FilterNotifier.on("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.addListener(webRequestListener, { urls:  ["http://*/*", "https://*/*"],types: ["main_frame"] });
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    addMessageListener();
  };
  returnObj.end = function()
  {
    dataCollectionCache = {};
    FilterNotifier.off("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    ext.storage.remove(TIME_LAST_PUSH_KEY);
    chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  };
  returnObj.getCache = function()
  {
    return dataCollectionCache;
  };

  return returnObj;
})();
