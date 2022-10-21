

/* For ESLint: List any global identifiers used in this file below */
/* global browser, chromeStorageSetHelper, adblockIsPaused,
   adblockIsDomainPaused, parseUri, log,
   getUserFilters, */

import * as info from 'info';
import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import SubscriptionAdapter from './subscriptionadapter';
import postData from './fetch-util';
import { getSettings, settings, setSetting } from './settings';

const DataCollectionV2 = (function getDataCollectionV2() {
  const HOUR_IN_MIN = 60;
  const TIME_LAST_PUSH_KEY = 'timeLastPush';
  const DATA_COLLECTION_ALARM_NAME = 'datacollectionalarm';
  const REPORTING_OPTIONS = {
    filterType: 'all',
    includeElementHiding: false,
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
      for (const sub of ewe.subscriptions.getForFilter(filter.text)) {
        if (sub.enabled && sub.url && sub.downloadable) {
          const subURL = sub.url.substring(0, 256);
          if (!dataCollectionCache.filters[text].subscriptions.includes(subURL)) {
            dataCollectionCache.filters[text].subscriptions.push(subURL);
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
      browser.alarms.clear(DATA_COLLECTION_ALARM_NAME);
    }
  };

  const sendToServer = async function () {
    const dataCollectionSetting = getSettings().data_collection_v2;
    if (!dataCollectionSetting) {
      browser.alarms.clear(DATA_COLLECTION_ALARM_NAME);
    }
    if (dataCollectionSetting && Object.keys(dataCollectionCache.filters).length > 0) {
      const subscribedSubs = [];
      const subs = SubscriptionAdapter.getSubscriptionsMinusText();
      for (const subscription of Object.values(subs)) {
        if (subscription && subscription.url) {
          subscribedSubs.push(subscription.url.substring(0, 256));
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
        postData('https://log.getadblock.com/v2/record_log.php', data)
          .then((postResponse) => {
            if (postResponse.ok) {
              let nowTimestamp = (new Date()).toGMTString();
              try {
                if (postResponse.headers.has('date')) {
                  nowTimestamp = postResponse.headers.get('date');
                }
              } catch (e) {
                nowTimestamp = (new Date()).toGMTString();
              }
              chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp);
              // Reset memory cache
              dataCollectionCache = {};
              dataCollectionCache.filters = {};
              dataCollectionCache.domains = {};
              return;
            }
            log('bad response from log server', postResponse);
          });
      }); // end of TIME_LAST_PUSH_KEY
    }
  };

  const initializeAlarm = function () {
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm && alarm.name === DATA_COLLECTION_ALARM_NAME) {
        sendToServer();
      }
    });
    browser.alarms.create(DATA_COLLECTION_ALARM_NAME, { periodInMinutes: HOUR_IN_MIN });
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    const dataCollectionEnabled = getSettings().data_collection_v2;
    if (dataCollectionEnabled) {
      initializeAlarm();
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
    initializeAlarm();
    setSetting('data_collection_v2', true, callback);
  };
  returnObj.end = function returnObjEnd(callback) {
    dataCollectionCache = {};
    ewe.reporting.onBlockableItem.removeListener(filterListener, REPORTING_OPTIONS);
    browser.webRequest.onBeforeRequest.removeListener(webRequestListener);
    browser.storage.local.remove(TIME_LAST_PUSH_KEY);
    browser.alarms.clear(DATA_COLLECTION_ALARM_NAME);
    setSetting('data_collection_v2', false, callback);
  };
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };

  return returnObj;
}());

export default DataCollectionV2;
