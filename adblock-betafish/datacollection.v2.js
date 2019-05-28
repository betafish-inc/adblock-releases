const {postFilterStatsToLogServer} = require('./servermessages').ServerMessages;

let DataCollectionV2 = exports.DataCollectionV2 = (function()
{

  "use strict";
  const {extractHostFromFrame} = require("url");
  const {RegExpFilter,
         WhitelistFilter,
         ElemHideFilter} = require("filterClasses");
  const {filterNotifier} = require("filterNotifier");
  const {port} = require("messaging");
  const {idleHandler} = require('./idlehandler');
  const HOUR_IN_MS = 1000 * 60 * 60;
  const TIME_LAST_PUSH_KEY = "timeLastPush";

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
    if (!tabInfo || !tabInfo.url || !tabInfo.url.startsWith("http:"))
    {
      return;
    }
    if (getSettings().data_collection_v2 && !adblockIsPaused() && !adblockIsDomainPaused({"url": tabInfo.url, "id": tabId}) && changeInfo.status === 'complete'  )
    {
      chrome.tabs.executeScript(tabId,
      {
          file: 'adblock-datacollection-contentscript.js',
          allFrames: true,
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
        var docDomain = extractHostFromFrame(sender.frame);

        filterStorage.knownSubscriptions.forEach(function(subscription) {
          if (!subscription.disabled) {
            for (let filter of subscription._filters) {
              // We only know the exact filter in case of element hiding emulation.
              // For regular element hiding filters, the content script only knows
              // the selector, so we have to find a filter that has an identical
              // selector and is active on the domain the match was reported from.
              let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                           selectors.includes(filter.selector) &&
                                           filter.isActiveOnDomain(docDomain);

              if (isActiveElemHideFilter)
              {
                addFilterToCache(filter, sender.page);
              }
            }
          }
        });
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
    if (filter && filter.text && (typeof filter.text === 'string') && page && page.url && page.url.hostname)
    {
      var domain = page.url.hostname;
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
      if (filter.subscriptionCount > 0)
      {
        let iterator = filter.subscriptions();
        let result = iterator.next();
        while (!result.done)
        {
          const sub = result.value;
          if (sub.url && dataCollectionCache.filters[text].subscriptions.indexOf(sub.url) === -1)
          {
            dataCollectionCache.filters[text].subscriptions.push(sub.url);
          }
          result = iterator.next();
        }
      }
    }
  };

  var filterListener = function(item, newValue, oldValue, tabIds)
  {
    if (getSettings().data_collection_v2 && !adblockIsPaused())
    {
      for (let tabId of tabIds)
      {
        let page = new ext.Page({id: tabId});
        if (page && !adblockIsDomainPaused({"url": page.url.href, "id": page.id})) {
          addFilterToCache(item, page);
        }
      }
    }
    else if (!getSettings().data_collection_v2)
    {
      filterNotifier.off("filter.hitCount", filterListener);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(function()
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
            if (getUserFilters().length) {
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
            chrome.storage.local.get(TIME_LAST_PUSH_KEY, function(response) {
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
                chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp);
                // Reset memory cache
                dataCollectionCache = {};
                dataCollectionCache.filters = {};
                dataCollectionCache.domains = {};
              });
            });  // end of TIME_LAST_PUSH_KEY
          }
        });
      }, HOUR_IN_MS);
      filterNotifier.on("filter.hitCount", filterListener);
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
    filterNotifier.on("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.addListener(webRequestListener, { urls:  ["http://*/*", "https://*/*"],types: ["main_frame"] });
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    addMessageListener();
  };
  returnObj.end = function()
  {
    dataCollectionCache = {};
    filterNotifier.off("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    chrome.storage.local.remove(TIME_LAST_PUSH_KEY);
    chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  };
  returnObj.getCache = function()
  {
    return dataCollectionCache;
  };

  return returnObj;
})();
