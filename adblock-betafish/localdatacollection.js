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
/* global browser, ext, adblockIsPaused, adblockIsDomainPaused, settings,
   getUserFilters, Utils, replacedCounts, setSetting,  */

import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import { getSettings } from './prefs/settings';
import { isEmptyObject, chromeStorageSetHelper } from './utilities/background/bg-functions';

const LocalDataCollection = (function getLocalDataCollection() {
  const easyPrivacyURL = 'https://easylist-downloads.adblockplus.org/easyprivacy.txt';
  const FIFTEEN_MINS = 15;
  const EXT_STATS_KEY = 'ext_stats_key';
  const STATS_ALARM_NAME = 'statsalarm';
  const STATS_STORAGE_KEY = 'ab:stats.storage.key';
  const REPORTING_OPTIONS = {
    filterType: 'blocking',
    includeElementHiding: false,
  };

  // Setup memory cache
  let dataCollectionCache = {};
  dataCollectionCache.domains = {};

  const initializeDomainIfNeeded = function (domain) {
    if (!(domain in dataCollectionCache.domains)) {
      dataCollectionCache.domains[domain] = {};
      dataCollectionCache.domains[domain].ads = 0;
      dataCollectionCache.domains[domain].trackers = 0;
      dataCollectionCache.domains[domain].adsReplaced = 0;
    }
  };

  const addFilterToCache = function (details, filter) {
    const validFilterText = filter && filter.text && (typeof filter.text === 'string');
    if (details.tabId > 0 && validFilterText && validFilterText && details && details.url) {
      browser.tabs.get(details.tabId).then(async (tab) => {
        if (tab.incognito) {
          return;
        }
        const theURL = new URL(details.url);
        const domain = theURL.hostname;
        initializeDomainIfNeeded(domain);
        const { text } = filter;
        let isAd = true;
        const subscriptions = await ewe.subscriptions.getForFilter(text);
        subscriptions.forEach((sub) => {
          if (!sub.disabled && sub.url && sub.url === easyPrivacyURL) {
            isAd = false;
          }
        });
        if (isAd) {
          dataCollectionCache.domains[domain].ads += 1;
        } else {
          dataCollectionCache.domains[domain].trackers += 1;
        }
        chromeStorageSetHelper(STATS_STORAGE_KEY, dataCollectionCache);
      });
    }
  };

  const filterListener = function ({ request, filter }) {
    if (getSettings().local_data_collection && !adblockIsPaused()) {
      addFilterToCache(request, filter);
    } else if (!getSettings().local_data_collection) {
      LocalDataCollection.end();
    }
  };

  const adReplacedListener = function (tabId, url) {
    if (getSettings().local_data_collection && !adblockIsPaused()) {
      const domain = new URL(url).hostname;
      initializeDomainIfNeeded(domain);
      dataCollectionCache.domains[domain].adsReplaced += 1;
      chromeStorageSetHelper(STATS_STORAGE_KEY, dataCollectionCache);
    } else if (!getSettings().local_data_collection) {
      LocalDataCollection.end();
    }
  };


  const clearCache = function () {
    dataCollectionCache = {};
    dataCollectionCache.domains = {};
    browser.storage.local.remove(STATS_STORAGE_KEY);
  };

  const saveCacheData = function () {
    return new Promise(async (resolve) => {
      if (getSettings().local_data_collection && !isEmptyObject(dataCollectionCache.domains)) {
        const hourSnapShot = JSON.parse(JSON.stringify({
          v: '1',
          doms: dataCollectionCache.domains,
        }));
        browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
          const savedData = hourlyResponse[EXT_STATS_KEY] || { };
          savedData[Date.now().toString()] = hourSnapShot;
          chromeStorageSetHelper(EXT_STATS_KEY, savedData, resolve);
          clearCache();
        });
      } else {
        if (!getSettings().local_data_collection) {
          browser.alarms.clear(STATS_ALARM_NAME);
        }
        resolve();
      }
    });
  };

  const loadCache = async function () {
    const response = await browser.storage.local.get(STATS_STORAGE_KEY);
    if (response[STATS_STORAGE_KEY]) {
      dataCollectionCache = response[STATS_STORAGE_KEY];
    }
  };

  const initialize = function () {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      // Not our alarm, nothing to do
      if (!alarm && alarm.name !== STATS_ALARM_NAME) {
        return;
      }
      await settings.onload();
      // If we're collecting data and the alarm has fired, process the memory cache
      if (getSettings().local_data_collection) {
        await loadCache();
        saveCacheData();
      } else {
        browser.alarms.clear(STATS_ALARM_NAME);
      }
    });
    // If enabled at startup, enable periodic processing of memory cache
    settings.onload().then(async () => {
      if (!getSettings().local_data_collection) {
        return;
      }
      await loadCache();
      browser.alarms.create(STATS_ALARM_NAME, { periodInMinutes: FIFTEEN_MINS });
      ewe.reporting.onBlockableItem.addListener(filterListener, REPORTING_OPTIONS);
      replacedCounts.adReplacedNotifier.on('adReplaced', adReplacedListener);
    });
  };
  initialize();

  const returnObj = {};
  returnObj.EXT_STATS_KEY = EXT_STATS_KEY;

  returnObj.start = function returnObjStart() {
    return new Promise((resolve) => {
      dataCollectionCache.domains = {};
      setSetting('local_data_collection', true, () => {
        initialize();
        resolve();
      });
    });
  };

  returnObj.end = function returnObjEnd() {
    return new Promise((resolve) => {
      browser.alarms.clear(STATS_ALARM_NAME);
      clearCache();
      ewe.reporting.onBlockableItem.removeListener(filterListener, REPORTING_OPTIONS);
      replacedCounts.adReplacedNotifier.off('adReplaced', adReplacedListener);
      setSetting('local_data_collection', false, resolve);
    });
  };
  returnObj.clearCache = clearCache;
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };
  returnObj.saveCacheData = saveCacheData;
  returnObj.easyPrivacyURL = easyPrivacyURL;
  returnObj.exportRawStats = async function returnObjFilterStats() {
    const hourlyResponse = await browser.storage.local.get(EXT_STATS_KEY);
    return Promise.resolve(hourlyResponse[EXT_STATS_KEY] || { });
  };
  returnObj.getRawStatsSize = async function returnObjFilterStatsSize() {
    const rawStats = await LocalDataCollection.exportRawStats();
    return Promise.resolve((JSON.stringify(rawStats).length));
  };
  // Note: the following function is used for testing purposes
  // Import filter list statistics which will be converted to the format needed / used
  // by the 'stats' tab.
  // Inputs: filterStatsArray: array of stringified JSON filter list statistics data
  //         from the DataCollection V2 messages.
  // Returns: a Promise, resolved when complete
  returnObj.importFilterStats = function returnObjFilterStats(filterStatsArray) {
    return new Promise((resolve) => {
      let parsedfilterStats = {};
      try {
        parsedfilterStats = JSON.parse(filterStatsArray);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
        resolve(`error : ${e.toString()}`);
        return;
      }
      browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
        const savedData = hourlyResponse[EXT_STATS_KEY] || { };
        for (let inx = 0; inx < parsedfilterStats.length; inx++) {
          const dupDataCache = parsedfilterStats[inx];
          // only process new data
          // don't overwrite existing data
          if (!savedData[Date.parse(dupDataCache.timeOfLastPush)]) {
            const hourSnapShot = {};
            const initializeDomainDataObject = function (domain) {
              hourSnapShot[domain] = {};
              hourSnapShot[domain].ads = 0;
              hourSnapShot[domain].trackers = 0;
              hourSnapShot[domain].adsReplaced = 0;
              if (dupDataCache.domains[domain] && typeof dupDataCache.domains[domain].adsReplaced === 'number') {
                hourSnapShot[domain].adsReplaced = dupDataCache.domains[domain].adsReplaced;
              }
            };
            for (const domain in dupDataCache.domains) {
              initializeDomainDataObject(domain);
            }
            const processDomainByFilterType = function (filter, domains, filterRequestType) {
              for (const domain in domains) {
                if (!hourSnapShot[domain]) {
                  initializeDomainDataObject(domain);
                }
                if (dupDataCache.filters[filter].subscriptions
                    && dupDataCache.filters[filter].subscriptions.length
                    && dupDataCache.filters[filter].subscriptions.includes(easyPrivacyURL)) {
                  hourSnapShot[domain].trackers
                    += dupDataCache.filters[filter][filterRequestType][domain].hits;
                } else {
                  hourSnapShot[domain].ads
                    += dupDataCache.filters[filter][filterRequestType][domain].hits;
                }
              }
            };
            for (const filter in dupDataCache.filters) {
              processDomainByFilterType(filter, dupDataCache.filters[filter].firstParty, 'firstParty');
              processDomainByFilterType(filter, dupDataCache.filters[filter].thirdParty, 'thirdParty');
            }
            savedData[Date.parse(dupDataCache.timeOfLastPush)] = JSON.parse(JSON.stringify({
              v: '1',
              doms: hourSnapShot,
            }));
          }
        }// end for loop
        chromeStorageSetHelper(EXT_STATS_KEY, savedData);
        resolve(' success! ');
      });
    });
  };
  return returnObj;
}());

export default LocalDataCollection;
