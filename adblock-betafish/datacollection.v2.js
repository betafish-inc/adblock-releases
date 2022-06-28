

/* For ESLint: List any global identifiers used in this file below */
/* global browser, chromeStorageSetHelper, adblockIsPaused,
   adblockIsDomainPaused, parseUri,
   getUserFilters, */

import * as info from 'info';
import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import SubscriptionAdapter from './subscriptionadapter';
import ServerMessages from './servermessages';
import { getSettings, settings, setSetting } from './settings';

import idleHandler from './idlehandler';

const DataCollectionV2 = (function getDataCollectionV2() {
  const HOUR_IN_MS = 1000 * 60 * 60;
  const TIME_LAST_PUSH_KEY = 'timeLastPush';
  const REPORTING_OPTIONS = {
    filterType: 'all',
    includeElementHiding: true,
  };

  // Setup memory cache
  let dataCollectionCache = {};
  dataCollectionCache.filters = {};
  dataCollectionCache.domains = {};

  const addFilterToCache = function (details, filter) {
    const validFilterText = filter && filter.text && (typeof filter.text === 'string');
    if (validFilterText && details && details.url) {
      let domain = details.url.hostname;
      if (!domain) {
        domain = new URL(details.url).hostname;
        if (!domain) {
          return;
        }
      }
      const { text } = filter;

      if (!(text in dataCollectionCache.filters)) {
        dataCollectionCache.filters[text] = {};
        dataCollectionCache.filters[text].firstParty = {};
        dataCollectionCache.filters[text].thirdParty = {};
        dataCollectionCache.filters[text].subscriptions = [];
      }
      if (filter.thirdParty) {
        if (!dataCollectionCache.filters[text].thirdParty[domain]) {
          dataCollectionCache.filters[text].thirdParty[domain] = {};
          dataCollectionCache.filters[text].thirdParty[domain].hits = 0;
        }
        dataCollectionCache.filters[text].thirdParty[domain].hits += 1;
      } else {
        if (!dataCollectionCache.filters[text].firstParty[domain]) {
          dataCollectionCache.filters[text].firstParty[domain] = {};
          dataCollectionCache.filters[text].firstParty[domain].hits = 0;
        }
        dataCollectionCache.filters[text].firstParty[domain].hits += 1;
      }
      for (const sub of ewe.subscriptions.getDownloadable()) {
        const dataCollectionSubscriptions = dataCollectionCache.filters[text].subscriptions;
        if (!sub.disabled && sub.url && dataCollectionSubscriptions.indexOf(sub.url) === -1) {
          if (sub.url.length > 256) {
            dataCollectionCache.filters[text].subscriptions.push(sub.substring(0, 256));
          } else {
            dataCollectionCache.filters[text].subscriptions.push(sub.url);
          }
        }
      }
    }
  };

  const webRequestListener = function (details) {
    if (details.url && details.type === 'main_frame' && !adblockIsPaused() && !adblockIsDomainPaused({ url: details.url, id: details.id })) {
      const domain = parseUri(details.url).host;
      if (!dataCollectionCache.domains[domain]) {
        dataCollectionCache.domains[domain] = {};
        dataCollectionCache.domains[domain].pages = 0;
      }
      dataCollectionCache.domains[domain].pages += 1;
    }
  };

  const filterListener = function ({ request, filter }) {
    if (getSettings().data_collection_v2 && !adblockIsPaused()) {
      addFilterToCache(request, filter);
    } else if (!getSettings().data_collection_v2) {
      ewe.reporting.onBlockableItem.removeListener(filterListener, REPORTING_OPTIONS);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    const dataCollectionEnabled = getSettings().data_collection_v2;
    if (dataCollectionEnabled) {
      window.setInterval(() => {
        idleHandler.scheduleItemOnce(async () => {
          if (dataCollectionEnabled && Object.keys(dataCollectionCache.filters).length > 0) {
            const subscribedSubs = [];
            const subs = SubscriptionAdapter.getAllSubscriptionsMinusText();
            for (const id in subs) {
              if (subs[id].subscribed) {
                if (subs[id].url && subs[id].url.length > 256) {
                  subscribedSubs.push(subs[id].url.substring(0, 256));
                } else {
                  subscribedSubs.push(subs[id].url);
                }
              }
            }
            if (await getUserFilters().length) {
              subscribedSubs.push('customlist');
            }
            const data = {
              version: '5',
              addonName: info.addonName,
              addonVersion: info.addonVersion,
              application: info.application,
              applicationVersion: info.applicationVersion,
              platform: info.platform,
              platformVersion: info.platformVersion,
              appLocale: browser.i18n.getUILanguage(),
              filterListSubscriptions: subscribedSubs,
              domains: dataCollectionCache.domains,
              filters: dataCollectionCache.filters,
            };
            browser.storage.local.get(TIME_LAST_PUSH_KEY).then((response) => {
              let timeLastPush = 'n/a';
              if (response[TIME_LAST_PUSH_KEY]) {
                const serverTimestamp = new Date(response[TIME_LAST_PUSH_KEY]);
                // Format the timeLastPush
                const yearStr = `${serverTimestamp.getUTCFullYear()}`;
                let monthStr = `${serverTimestamp.getUTCMonth() + 1}`;
                let dateStr = `${serverTimestamp.getUTCDate()}`;
                let hourStr = `${serverTimestamp.getUTCHours()}`;
                // round the minutes up to the nearest 10
                let minStr = `${Math.floor(serverTimestamp.getUTCMinutes() / 10) * 10}`;

                if (monthStr.length === 1) {
                  monthStr = `0${monthStr}`;
                }
                if (dateStr.length === 1) {
                  dateStr = `0${dateStr}`;
                }
                if (hourStr.length === 1) {
                  hourStr = `0${hourStr}`;
                }
                if (minStr.length === 1) {
                  minStr = `0${minStr}`;
                }
                if (minStr === '60') {
                  minStr = '00';
                }
                timeLastPush = `${yearStr}-${monthStr}-${dateStr} ${hourStr}:${minStr}:00`;
              }
              data.timeOfLastPush = timeLastPush;
              ServerMessages.postFilterStatsToLogServer(data, (text, status, xhr) => {
                let nowTimestamp = (new Date()).toGMTString();
                if (xhr && typeof xhr.getResponseHeader === 'function') {
                  try {
                    if (xhr.getResponseHeader('Date')) {
                      nowTimestamp = xhr.getResponseHeader('Date');
                    }
                  } catch (e) {
                    nowTimestamp = (new Date()).toGMTString();
                  }
                }
                chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp);
                // Reset memory cache
                dataCollectionCache = {};
                dataCollectionCache.filters = {};
                dataCollectionCache.domains = {};
              });
            }); // end of TIME_LAST_PUSH_KEY
          }
        });
      }, HOUR_IN_MS);
      ewe.reporting.onBlockableItem.addListener(filterListener, REPORTING_OPTIONS);
      browser.webRequest.onBeforeRequest.addListener(webRequestListener, {
        urls: ['http://*/*', 'https://*/*'],
        types: ['main_frame'],
      });
    }
  });// End of then

  const returnObj = {};
  returnObj.start = function returnObjStart(callback) {
    dataCollectionCache.filters = {};
    dataCollectionCache.domains = {};
    ewe.reporting.onBlockableItem.addListener(filterListener, REPORTING_OPTIONS);
    browser.webRequest.onBeforeRequest.addListener(webRequestListener, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    });
    setSetting('data_collection_v2', true, callback);
  };
  returnObj.end = function returnObjEnd(callback) {
    dataCollectionCache = {};
    ewe.reporting.onBlockableItem.removeListener(filterListener, REPORTING_OPTIONS);
    browser.webRequest.onBeforeRequest.removeListener(webRequestListener);
    browser.storage.local.remove(TIME_LAST_PUSH_KEY);
    setSetting('data_collection_v2', false, callback);
  };
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };

  return returnObj;
}());

export default DataCollectionV2;
