

/* For ESLint: List any global identifiers used in this file below */
/* global browser, ext, chromeStorageSetHelper, adblockIsPaused,
   adblockIsDomainPaused, parseUri, settings,
   getUserFilters, Utils, replacedCounts, setSetting, storageGet, storageSet */

import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import { getSettings } from './settings';

const LocalDataCollection = (function getLocalDataCollection() {
  const easyPrivacyURL = 'https://easylist-downloads.adblockplus.org/easyprivacy.txt';
  const FIFTEEN_MINS = 1000 * 60 * 15;
  let intervalFN;
  const EXT_STATS_KEY = 'ext_stats_key';
  const STORED_DATA_CLEAN = 'STORED_DATA_CLEAN';
  const REPORTING_OPTIONS = {
    filterType: 'all',
    includeElementHiding: true,
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
      browser.tabs.get(details.tabId).then((tab) => {
        if (tab.incognito) {
          return;
        }
        const theURL = new URL(details.url);
        const domain = theURL.hostname;
        initializeDomainIfNeeded(domain);
        const { text } = filter;
        let isAd = true;
        for (const sub of ewe.subscriptions.getForFilter(text)) {
          if (!sub.disabled && sub.url && sub.url === easyPrivacyURL) {
            isAd = false;
          }
        }
        if (isAd) {
          dataCollectionCache.domains[domain].ads += 1;
        } else {
          dataCollectionCache.domains[domain].trackers += 1;
        }
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
    } else if (!getSettings().local_data_collection) {
      LocalDataCollection.end();
    }
  };

  // 'clean' the stored data
  // there was a bug that allowed blank domains ("") to be saved in the data
  // the following code removes the blank domain
  // this function only needs to run once
  const cleanStoredData = function () {
    if (storageGet(STORED_DATA_CLEAN)) {
      return;
    }
    browser.storage.local.get(LocalDataCollection.EXT_STATS_KEY).then((hourlyResponse) => {
      const savedData = hourlyResponse[LocalDataCollection.EXT_STATS_KEY] || {};
      const parsedData = {};
      for (const timestamp in savedData) {
        if (!Number.isNaN(timestamp)) {
          for (const domain in savedData[timestamp].doms) {
            if (domain && domain.length > 1) { // check if domain is not blank
              const domData = savedData[timestamp].doms[domain];
              if (!parsedData[timestamp]) {
                parsedData[timestamp] = {};
                parsedData[timestamp].v = '1';
                parsedData[timestamp].doms = {};
              }
              parsedData[timestamp].doms[domain] = {};
              parsedData[timestamp].doms[domain].ads = domData.ads;
              parsedData[timestamp].doms[domain].trackers = domData.trackers;
              parsedData[timestamp].doms[domain].adsReplaced = domData.adsReplaced;
            }
          }
        }
      }
      chromeStorageSetHelper(LocalDataCollection.EXT_STATS_KEY, parsedData);
      storageSet(STORED_DATA_CLEAN, true);
    });
  };

  const clearCache = function () {
    dataCollectionCache = {};
    dataCollectionCache.domains = {};
  };

  const saveCacheData = function (callback) {
    if (getSettings().local_data_collection && !$.isEmptyObject(dataCollectionCache.domains)) {
      const hourSnapShot = JSON.parse(JSON.stringify({
        v: '1',
        doms: dataCollectionCache.domains,
      }));
      browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
        const savedData = hourlyResponse[EXT_STATS_KEY] || { };
        savedData[Date.now().toString()] = hourSnapShot;
        chromeStorageSetHelper(EXT_STATS_KEY, savedData, callback);
        clearCache();
      });
    } else {
      if (!getSettings().local_data_collection) {
        clearInterval(intervalFN);
      }
      if (typeof callback === 'function') {
        callback();
      }
    }
  };

  const startProcessInterval = function () {
    intervalFN = window.setInterval(() => {
      saveCacheData();
    }, FIFTEEN_MINS);
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    if (getSettings().local_data_collection) {
      startProcessInterval();
      ewe.reporting.onBlockableItem.addListener(filterListener, REPORTING_OPTIONS);
      replacedCounts.adReplacedNotifier.on('adReplaced', adReplacedListener);
      cleanStoredData();
    }
  });// End of then

  const returnObj = {};
  returnObj.EXT_STATS_KEY = EXT_STATS_KEY;
  returnObj.start = function returnObjStart(callback) {
    dataCollectionCache.domains = {};
    ewe.reporting.onBlockableItem.addListener(filterListener, REPORTING_OPTIONS);
    replacedCounts.adReplacedNotifier.on('adReplaced', adReplacedListener);
    startProcessInterval();
    setSetting('local_data_collection', true, callback);
  };
  returnObj.end = function returnObjEnd(callback) {
    clearInterval(intervalFN);
    clearCache();
    storageSet(STORED_DATA_CLEAN);
    ewe.reporting.onBlockableItem.removeListener(filterListener, REPORTING_OPTIONS);
    replacedCounts.adReplacedNotifier.off('adReplaced', adReplacedListener);
    setSetting('local_data_collection', false, callback);
  };
  returnObj.clearCache = clearCache;
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };
  returnObj.saveCacheData = saveCacheData;
  returnObj.easyPrivacyURL = easyPrivacyURL;
  returnObj.exportRawStats = function returnObjFilterStats(callback) {
    browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
      const savedData = hourlyResponse[EXT_STATS_KEY] || { };
      if (typeof callback === 'function') {
        callback(savedData);
      }
    });
  };
  returnObj.getRawStatsSize = function returnObjFilterStatsSize(callback) {
    LocalDataCollection.exportRawStats((rawStats) => {
      callback(JSON.stringify(rawStats).length);
    });
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
