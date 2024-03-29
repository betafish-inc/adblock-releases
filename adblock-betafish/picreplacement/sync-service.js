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
/* global browser, channels,
   getUserFilters, Prefs, abpPrefPropertyNames,
   adblockIsDomainPaused, PubNub, adblockIsPaused,
   pausedFilterText1, pausedFilterText2,
   isWhitelistFilter, getCustomFilterMetaData */

/** @module SyncService */

import { TELEMETRY } from '../telemetry';
import { EventEmitter } from '../../vendor/adblockplusui/adblockpluschrome/lib/events';
import * as ewe from '../../vendor/webext-sdk/dist/ewe-api';
// check.js imports disableSync from here
// eslint-disable-next-line import/no-cycle
import { License } from './check';
import { channelsNotifier } from './channels';
import SubscriptionAdapter from '../subscriptionadapter';
import {
  getSettings, setSetting, settingsNotifier, settings,
} from '../prefs/settings';
import ServerMessages from '../servermessages';
import postData from '../fetch-util';
import {
  chromeStorageDeleteHelper,
  chromeStorageGetHelper,
  log,
  chromeStorageSetHelper,
} from '../utilities/background/bg-functions';

const SyncService = (function getSyncService() {
  let storedSyncDomainPauses = [];
  let syncCommitVersion = 0;
  let currentExtensionName = '';
  let pubnub;
  const syncSchemaVersion = 1;
  const syncCommitVersionKey = 'SyncCommitKey';
  const syncLogMessageKey = 'SyncLogMessageKey';
  const syncPreviousDataKey = 'SyncPreviousDataKey';
  const syncExtensionNameKey = 'SyncExtensionNameKey';
  const syncPendingPostDataKey = 'syncPendingPostDataKey';
  const syncNotifier = new EventEmitter();
  let lastPostStatusCode = 200;
  let pendingPostData = false;
  let lastGetStatusCode = 200;
  let lastGetErrorResponse = {};
  const debounceWaitTime = 3000; // time in ms before posting data
  // Below is a list of filter list ids that have been added since the
  // sync feature was added to AdBlock, therefore these filter lists should be sent
  // with an ID of 'url:...' instead of the id in the betafish-subscriptions.json file
  // any adds to the the betafish-subscriptions.json file should be added here as well.
  const sendFilterListByURL = ['nordic', 'annoyances',
    'fb_notifications', 'easylist_plus_romanian', 'idcac'];

  function setCommitVersion(newVersionNum) {
    syncCommitVersion = newVersionNum;
  }

  function getLastPostStatusCode() {
    return lastPostStatusCode;
  }

  function resetLastPostStatusCode() {
    lastPostStatusCode = 200;
  }

  function setLastPostStatusCode(newCode) {
    lastPostStatusCode = newCode;
  }

  function getLastGetStatusCode() {
    return lastGetStatusCode;
  }

  function resetLastGetStatusCode() {
    lastGetStatusCode = 200;
  }

  function setLastGetStatusCode(newCode) {
    lastGetStatusCode = newCode;
  }

  function getLastGetErrorResponse() {
    return lastGetErrorResponse;
  }

  function resetLastGetErrorResponse() {
    lastGetErrorResponse = {};
  }

  function setLastGetErrorResponse(newObject) {
    lastGetErrorResponse = newObject;
  }

  function resetAllErrors() {
    resetLastGetErrorResponse();
    resetLastGetStatusCode();
    resetLastPostStatusCode();
  }

  const getCurrentExtensionName = function () {
    return currentExtensionName;
  };

  const getSyncLog = function () {
    return new Promise((resolve) => {
      chromeStorageGetHelper(syncLogMessageKey).then((logMsgs) => {
        const storedLog = JSON.parse(logMsgs || '[]');
        const theReturnObj = {};
        Object.assign(theReturnObj, storedLog);
        resolve(theReturnObj);
      });
    });
  };

  // TODO - when should we delete the log file???
  const deleteSyncLog = function () {
    chromeStorageDeleteHelper(syncLogMessageKey);
  };

  const migrateSyncLog = function () {
    /* eslint-disable no-restricted-globals */
    if (typeof self.localStorage === 'undefined') {
      return;
    }
    let storedMsgs = localStorage.getItem(syncLogMessageKey);
    if (!storedMsgs) {
      return;
    }
    storedMsgs = JSON.parse(storedMsgs);
    while (storedMsgs.length > 500) { // only keep the last 500 log entries
      storedMsgs.shift();
    }
    chromeStorageSetHelper(syncLogMessageKey, JSON.stringify(storedMsgs), (error) => {
      if (!error) {
        localStorage.removeItem(syncLogMessageKey);
      }
    });
  };

  function debounced(delay, fn) {
    let timerId;
    return function debouncedAgain(...args) {
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        fn(...args);
        timerId = null;
      }, delay);
    };
  }

  // return meta data about the extension installation
  const getExtensionInfo = function () {
    return {
      flavor: TELEMETRY.flavor,
      browserVersion: TELEMETRY.browserVersion,
      os: TELEMETRY.os,
      osVersion: TELEMETRY.osVersion,
      extVersion: TELEMETRY.version,
      syncSchemaVersion,
    };
  };

  /*
  ** @param arrOne, arrTwo - Arrays to compare
  ** @returns {boolean} - true if a and b are the same array
  **                      has the length and same values in any order
  **                      otherwise false
  */
  function arrayComparison(arrOne, arrTwo) {
    if (!Array.isArray(arrOne) || !Array.isArray(arrTwo)) {
      return false;
    }
    if (arrOne.length !== arrTwo.length) {
      return false;
    }
    return arrOne.every(element => arrTwo.includes(element));
  }

  /*
  ** @param a, b        - values (Object, Date, etc.)
  ** @returns {boolean} - true if a and b are the same object or
  **                      same primitive value or
  **                      have the same properties with the same values
  **                      otherwise false
  */
  function objectComparison(a, b) {
    // Helper to return a value's internal object [[Class]]
    // That this returns [object Type] even for primitives
    function getClass(obj) {
      return Object.prototype.toString.call(obj);
    }

    // If a and b reference the same value, return true
    if (a === b) {
      return true;
    }

    // If a and b aren't the same type, return false
    if (typeof a !== typeof b) {
      return false;
    }

    // Already know types are the same, so if type is number
    // and both NaN, return true
    if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
      return true;
    }

    // Get internal [[Class]]
    const aClass = getClass(a);
    const bClass = getClass(b);

    // Return false if not same class
    if (aClass !== bClass) {
      return false;
    }

    // If they're Boolean, String or Number objects, check values
    if (
      aClass === '[object Boolean]'
      || aClass === '[object String]'
      || aClass === '[object Number]'
    ) {
      if (a.valueOf() !== b.valueOf()) {
        return false;
      }
    }

    // If they're RegExps, Dates or Error objects, check stringified values
    if (aClass === '[object RegExp]' || aClass === '[object Date]' || aClass === '[object Error]') {
      if (a.toString() !== b.toString()) {
        return false;
      }
    }

    // For functions, check stringigied values are the same
    // Almost impossible to be equal if a and b aren't trivial
    // and are different functions
    if (aClass === '[object Function]' && a.toString() !== b.toString()) {
      return false;
    }

    // For all objects, (including Objects, Functions, Arrays and host objects),
    // check the properties
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    // If they don't have the same number of keys, return false
    if (aKeys.length !== bKeys.length) {
      return false;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      return arrayComparison(a, b);
    }

    // Check they have the same keys
    if (!aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key))) {
      return false;
    }

    // Check key values - uses ES5 Object.keys
    return aKeys.every(key => objectComparison(a[key], b[key]));
  }

  const isDomainPauseFilter = function (filterText) {
    if (isWhitelistFilter(filterText)) {
      const domains = adblockIsDomainPaused();
      for (const domain in domains) {
        if (`@@${domain}$document` === filterText) {
          return true;
        }
      }
    }
    return false;
  };

  const isPauseFilter = function (filterText) {
    return (
      isWhitelistFilter(filterText) && ((pausedFilterText1 === filterText)
        || (pausedFilterText2 === filterText))
    );
  };

  function getCommitVersion() {
    return syncCommitVersion;
  }

  // Sync log message processing

  const addSyncLogText = function (msg) {
    chromeStorageGetHelper(syncLogMessageKey).then((logMsgs) => {
      const storedLog = JSON.parse(logMsgs || '[]');
      storedLog.push(`${new Date().toUTCString()} , ${msg}`);
      while (storedLog.length > 500) { // only keep the last 500 log entries
        storedLog.shift();
      }
      chromeStorageSetHelper(syncLogMessageKey, JSON.stringify(storedLog));
    });
  };

  const onExtensionNamesDownloadingAddLogEntry = function () {
    addSyncLogText('extension.names.downloading');
  };

  const onExtensionNamesDownloadedAddLogEntry = function () {
    addSyncLogText('extension.names.downloaded');
  };

  const onExtensionNamesDownloadingErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.names.downloading.error: ${errorCode}`);
  };

  const onExtensionNameUpdatingAddLogEntry = function () {
    addSyncLogText('extension.name.updating');
  };

  const onExtensionNameUpdatedAddLogEntry = function () {
    addSyncLogText('extension.name.updated');
  };

  const onExtensionNameUpdatedErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.names.updated.error: ${errorCode}`);
  };

  const onExtensionNameRemoveAddLogEntry = function () {
    addSyncLogText('extension.name.remove');
  };

  const onExtensionNameRemovedAddLogEntry = function () {
    addSyncLogText('extension.name.removed');
  };

  const onExtensionNamesRemoveErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.name.remove.error: ${errorCode}`);
  };

  const onPostDataSendingAddLogEntry = function () {
    addSyncLogText('post.data.sending');
  };

  const onPostDataSentAddLogEntry = function () {
    addSyncLogText(`post.data.sent, commit version: ${getCommitVersion()}`);
  };

  const onPostDataSentErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`post.data.sent.error: ${errorCode}`);
  };

  const onSyncDataGettingAddLogEntry = function () {
    addSyncLogText('sync.data.getting');
  };

  const onSyncDataReceievedAddLogEntry = function () {
    addSyncLogText(`sync.data.receieved, commit version: ${getCommitVersion()}`);
  };

  const onSyncDataGettingErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`sync.data.getting.error: ${errorCode}`);
  };

  const onSyncDataGettingErrorInitialFailAddLogEntry = function (errorCode) {
    addSyncLogText(`sync.data.getting.error.initial.fail: ${errorCode}`);
  };

  function cleanCustomFilter(filters) {
    // Remove the global pause white-list item if adblock is paused
    if (adblockIsPaused()) {
      let index = filters.indexOf(pausedFilterText1);
      if (index >= 0) {
        filters.splice(index, 1);
      }
      index = filters.indexOf(pausedFilterText2);
      if (index >= 0) {
        filters.splice(index, 1);
      }
    }

    // Remove the domain pause white-list items
    const domainPauses = adblockIsDomainPaused();
    for (const aDomain in domainPauses) {
      const index = filters.indexOf(`@@${aDomain}$document`);
      if (index >= 0) {
        filters.splice(index, 1);
      }
    }
    return filters;
  }

  const processSyncUpdate = async function (payload) {
    log('processing sync update', payload);
    // do we need a check or comparison of payload.version vs. syncSchemaVersion ?
    if (payload.settings) {
      const keywords = Object.keys(payload.settings);
      // Use a Promise to wait until the previous 'set' is complete because
      // calling 'setSetting' several times in a row in a loop prevents some
      // settings from being saved to storage
      for (let inx = 0, p = Promise.resolve(); inx < keywords.length; inx++) {
        const id = keywords[inx];
        p = p.then(() => new Promise((resolve) => {
          let value = payload.settings[id];
          // since we receive a 'show_statsinpopup' property on the |Prefs| object
          // from older versions of AdBLock, use the incoming value from |Prefs|
          // object for backward compatability
          if (
            id === 'display_menu_stats'
            && payload.prefs
            && Object.prototype.hasOwnProperty.call(payload.prefs, 'show_statsinpopup')
          ) {
            value = payload.prefs.show_statsinpopup;
          }
          setSetting(id, value, () => {
            resolve();
          });
        }));
      }
    }
    if (payload.subscriptions) {
      const currentSubs = await SubscriptionAdapter.getSubscriptionsMinusText();
      for (const id in currentSubs) {
        if (!payload.subscriptions[id] && currentSubs[id].subscribed) {
          // eslint-disable-next-line no-await-in-loop
          await ewe.subscriptions.remove(currentSubs[id].url);
        }
      }
      for (const id in payload.subscriptions) {
        if (!currentSubs[id] || !currentSubs[id].subscribed) {
          let url = SubscriptionAdapter.getUrlFromId(id);
          if (!url && id.startsWith('url:')) {
            url = id.slice(4);
          }
          if (url) {
            // eslint-disable-next-line no-await-in-loop
            await ewe.subscriptions.add(url);
            ewe.subscriptions.sync(url);
          }
        }
      }
    }

    if (payload.customFilterRules) {
      // capture, then remove all current custom filters, account for pause filters in
      // current processing
      let currentUserFilters = await getUserFilters();
      const onlyUserFilters = currentUserFilters.map(filter => filter.text);
      let results = [];
      for (const inx in payload.customFilterRules) {
        if (
          !ewe.filters.validate(payload.customFilterRules[inx])
          && !onlyUserFilters.includes(payload.customFilterRules[inx])
        ) {
          results.push(ewe.filters.add([payload.customFilterRules[inx]]));
        }
      }
      await Promise.all(results);
      results = [];
      if (currentUserFilters && currentUserFilters.length) {
        currentUserFilters = cleanCustomFilter(currentUserFilters);
        // Delete / remove filters the user removed...
        if (currentUserFilters) {
          for (let i = 0; (i < currentUserFilters.length); i++) {
            const filter = currentUserFilters[i];
            if (!payload.customFilterRules.includes(filter.text)) {
              if (filter.text.length > 0) {
                if (!ewe.filters.validate(filter.text)) {
                  results.push(ewe.filters.remove([filter.text]));
                }
              }
            }
          }
        }
      }
      await Promise.all(results);
    }
    if (payload.customRuleMetaData) {
      let currentUserFilters = await getUserFilters();
      currentUserFilters = currentUserFilters.map(filter => filter.text);
      for (const ruleText in payload.customRuleMetaData) {
        if (currentUserFilters.includes(ruleText)) {
          ewe.filters.setMetadata(ruleText, payload.customRuleMetaData[ruleText]);
        }
      }
    }
    if (payload.prefs) {
      for (const key in payload.prefs) {
        Prefs[key] = payload.prefs[key];
        // add any new Prefs to the array of Preferences we're tracking for sync
        if (abpPrefPropertyNames.indexOf(key) < 0) {
          abpPrefPropertyNames.push(key);
        }
        // since we no long use the 'show_statsinpopup' property on the |Prefs| object,
        // manually set Settings property for backward compatability
        if (key === 'show_statsinpopup') {
          setSetting('display_menu_stats', payload.prefs[key]);
        }
      }
    }
    if (payload.channels) {
      for (const name in payload.channels) {
        const channelId = channels.getIdByName(name);
        if (channelId) {
          channels.setEnabled(channelId, payload.channels[name]);
        } else {
          // create a new channel to save the channel name and the enabled indicator
          channels.add({ name, param: undefined, enabled: payload.channels[name] });
        }
      }
    }
  };

  const process403ErrorCode = function () {
    // eslint-disable-next-line no-use-before-define
    disableSync(false);
  };

  // Retreive or 'get' the sync data from the sync server
  // Input: initialGet:boolean - if true, and the server returns a 404 error code,
  //                             then a 'post' is invoked
  //        disableEmitMsg:boolean - if true, then no sync notifier message will be emitted
  //                                 (usually used for post error processing)
  //        callback:function - function that will be called when success or failure occurs
  //        shouldForce:boolean - optional, force a response from the server (even if the commit
  //                              versions match), defaults to false
  const getSyncData = function (initialGet, disableEmitMsg, callback, shouldForce) {
    const getSuccess = function (text, statusCode) {
      let responseObj = {};
      if (text && typeof text === 'object') {
        responseObj = text;
      } else if (text && typeof text === 'string') {
        try {
          responseObj = JSON.parse(text);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('Something went wrong with parsing license data.');
          // eslint-disable-next-line no-console
          console.log('error', e);
          // eslint-disable-next-line no-console
          console.log(text);
          return;
        }
      }
      if (responseObj && ((responseObj.commitVersion > syncCommitVersion) || shouldForce)) {
        if (responseObj.data) {
          try {
            processSyncUpdate(JSON.parse(responseObj.data));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('failed to parse response data from server', responseObj.data);
            // eslint-disable-next-line no-console
            console.log(e);
          }
        }
        syncCommitVersion = responseObj.commitVersion;
        chromeStorageSetHelper(syncCommitVersionKey, responseObj.commitVersion);
        chromeStorageSetHelper(syncPreviousDataKey, responseObj.data);
        pendingPostData = false; // reset in case an update is received from another extension
        chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
      }
      if (!disableEmitMsg) {
        syncNotifier.emit('sync.data.receieved');
      }
      if (typeof callback === 'function') {
        callback(statusCode);
      }
    };

    const getFailure = function (statusCode, textStatus, responseJSON) {
      lastGetStatusCode = statusCode;
      lastGetErrorResponse = responseJSON;
      if (initialGet && statusCode === 404) {
        // eslint-disable-next-line no-use-before-define
        postDataSync(callback, initialGet);
        // now that the initial post is complete, enable Sync (add listeners, etc.)
        // with 'initialGet' now set to false
        // eslint-disable-next-line no-use-before-define
        enableSync();
        return;
      }
      if (initialGet && !disableEmitMsg) {
        syncNotifier.emit('sync.data.getting.error.initial.fail', statusCode);
      } else if (!disableEmitMsg) {
        syncNotifier.emit('sync.data.getting.error', statusCode, responseJSON);
        if (statusCode === 403) {
          process403ErrorCode();
        }
      }
      if (typeof callback === 'function') {
        callback(statusCode);
      }
    };

    if (!disableEmitMsg) {
      syncNotifier.emit('sync.data.getting');
    }
    lastGetStatusCode = 200;
    lastGetErrorResponse = {};
    // eslint-disable-next-line no-use-before-define
    requestSyncData(getSuccess, getFailure, undefined, shouldForce);
  };

  const getAllExtensionNames = function () {
    return new Promise((resolve) => {
      syncNotifier.emit('extension.names.downloading');
      fetch(`${License.MAB_CONFIG.syncURL}/devices/list`, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'X-GABSYNC-PARAMS': JSON.stringify({
            extensionGUID: TELEMETRY.userId(),
            licenseId: License.get().licenseId,
            extInfo: getExtensionInfo(),
          }),
        },
      })
        .then(async (response) => {
          if (response.ok) {
            const responseObj = await response.json();
            syncNotifier.emit('extension.names.downloaded', responseObj);
            resolve(responseObj);
            return;
          }
          if (response.status === 404) {
            syncNotifier.emit('extension.names.downloading.error', response.status);
            const text = await response.text();
            resolve(text);
            return;
          }
          log('sync server error: ', response);
        })
        .catch((error) => {
          syncNotifier.emit('extension.names.downloading.error');
          log('sync server returned error: ', error);
        });
    });
  };

  const setCurrentExtensionName = function (newName) {
    if (newName && newName.trim().length >= 1 && newName.trim().length <= 50) {
      currentExtensionName = newName.trim();
      chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
      const thedata = {
        deviceName: currentExtensionName,
        extensionGUID: TELEMETRY.userId(),
        licenseId: License.get().licenseId,
        extInfo: getExtensionInfo(),
      };
      syncNotifier.emit('extension.name.updating');
      postData(`${License.MAB_CONFIG.syncURL}/devices/add`, thedata)
        .then((response) => {
          if (response.ok) {
            syncNotifier.emit('extension.name.updated');
          } else {
            syncNotifier.emit('extension.name.updated.error', response.status);
          }
        })
        .catch((error) => {
          syncNotifier.emit('extension.name.updated.error');
          log('message server returned error: ', error);
        });
    }
  };
  const removeExtensionName = function (extensionName, extensionGUID) {
    const thedata = {
      deviceName: extensionName,
      extensionGUID,
      licenseId: License.get().licenseId,
      extInfo: getExtensionInfo(),
    };
    syncNotifier.emit('extension.name.remove');
    postData(`${License.MAB_CONFIG.syncURL}/devices/remove`, thedata)
      .then((response) => {
        if (response.ok) {
          if (extensionName === currentExtensionName) {
            currentExtensionName = '';
            chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
          }
          syncNotifier.emit('extension.name.removed');
        } else {
          syncNotifier.emit('extension.name.remove.error', response.status);
        }
      })
      .catch((error) => {
        syncNotifier.emit('extension.name.remove.error');
        log('message server returned error: ', error);
      });
  };


  const removeCurrentExtensionName = function () {
    removeExtensionName(currentExtensionName, TELEMETRY.userId());
  };

  // return all of the current user configurable extension options (settings, Prefs, filter list
  // sub, custom rules, themes, etc. Since a comparison will be done in this, and other sync'd
  // extensions, the payload should only contain settings, Prefs, etc and not data that can change
  // from browser to brower, version to version, etc.
  const getSyncInformation = async function () {
    const payload = {};
    payload.settings = getSettings();
    payload.subscriptions = {};
    const subscriptions = await SubscriptionAdapter.getSubscriptionsMinusText();

    for (const id in subscriptions) {
      if (subscriptions[id].subscribed) {
        const { adblockId } = subscriptions[id];
        let { mv2URL: url } = subscriptions[id];
        if (!url) {
          ({ url } = subscriptions[id]);
        }
        if (sendFilterListByURL.includes(adblockId)) {
          payload.subscriptions[`url:${url}`] = url;
        } else {
          payload.subscriptions[adblockId] = url;
        }
      }
    }
    let userFilters = await getUserFilters();
    userFilters = userFilters.map(filter => filter.text).sort();
    payload.customFilterRules = cleanCustomFilter(userFilters);

    const metaDataArr = await getCustomFilterMetaData();
    if (metaDataArr && metaDataArr.length) {
      const ruleMetaData = {};
      for (let inx = 0; inx < metaDataArr.length; inx++) {
        if (metaDataArr[inx].text && metaDataArr[inx].metaData) {
          ruleMetaData[metaDataArr[inx].text] = metaDataArr[inx].metaData;
        }
      }
      payload.customRuleMetaData = ruleMetaData;
    }
    payload.prefs = {};
    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      payload.prefs[name] = Prefs[name];
    }
    // since we no long use the 'show_statsinpopup' property on the |Prefs| object,
    // manually set it using the new 'show_statsinpopup' property on the Settings object
    // for backward compatability
    payload.prefs.show_statsinpopup = getSettings().display_menu_stats;
    payload.channels = {};
    const guide = channels.getGuide();
    for (const id in guide) {
      payload.channels[guide[id].name] = guide[id].enabled;
    }
    return payload;
  };

  const postDataSync = async function (callback, initialGet) {
    if (!getSettings().sync_settings) {
      return;
    }
    const payload = await getSyncInformation();
    const thedata = {
      data: JSON.stringify(payload),
      commitVersion: syncCommitVersion,
      extensionGUID: TELEMETRY.userId(),
      licenseId: License.get().licenseId,
      extInfo: getExtensionInfo(),
    };
    browser.storage.local.get(syncPreviousDataKey).then((response) => {
      const previousData = response[syncPreviousDataKey] || '{}';
      if (objectComparison(payload, JSON.parse(previousData))) {
        return;
      }
      syncNotifier.emit('post.data.sending');
      lastPostStatusCode = 200;
      pendingPostData = false;
      chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
      log('sending sync \'payload\' to server', thedata);
      log('sending sync \'thedata\' to server', payload);
      postData(License.MAB_CONFIG.syncURL, thedata).then((postResponse) => {
        lastPostStatusCode = postResponse.status;
        if (postResponse.ok) {
          postResponse.json().then((responseObj) => {
            if (responseObj && responseObj.commitVersion > syncCommitVersion) {
              syncCommitVersion = responseObj.commitVersion;
              chromeStorageSetHelper(syncCommitVersionKey, responseObj.commitVersion);
            }
            chromeStorageSetHelper(syncPreviousDataKey, responseObj.data);
            if (typeof callback === 'function') {
              callback();
            }
            syncNotifier.emit('post.data.sent');
          });
        } else {
          syncNotifier.emit('post.data.sent.error', postResponse.status, initialGet);
          lastPostStatusCode = postResponse.status;
          if (postResponse.status === 409) {
            // this extension probably had an version of the sync data
            // aka - the sync commit version was behind the sync server
            // so, undo / revert all of the user changes that were just posted
            // by doing a 'GET'
            // because we want the above error to be persisted, will set the
            // 'disableEmitMsg' to true
            getSyncData(false, true);
            return;
          }
          if (postResponse.status === 403) {
            process403ErrorCode();
          }
          // all other currently known errors (0, 401, 404, 500).
          pendingPostData = true;
          chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
        }
      })
        .catch((error) => {
          syncNotifier.emit('extension.name.updated.error');
          // eslint-disable-next-line no-console
          console.log('message server returned error: ', error);
        });
    });
  };

  const processUserSyncRequest = function () {
    if (pendingPostData) {
      postDataSync();
    } else {
      getSyncData(false, false, undefined, true);
    }
  };

  const processEventChangeRequest = function () {
    if (pendingPostData) {
      postDataSync();
    } else {
      getSyncData();
    }
  };

  const postDataSyncHandler = debounced(debounceWaitTime, postDataSync);

  // Sync Listeners
  function onFilterAdded(filter, subscription, position, calledPreviously) {
    // a delay is added to allow the domain pause filters time to be saved to storage
    // otherwise the domain pause filter check below would always fail
    if (calledPreviously === undefined) {
      setTimeout(() => {
        onFilterAdded(filter, subscription, position, true);
      }, 500);
      return;
    }
    if (isPauseFilter(filter.text)) {
      return;
    }
    if (isDomainPauseFilter(filter.text)) {
      storedSyncDomainPauses.push(filter.text);
      return;
    }
    postDataSyncHandler();
  }

  function onFilterRemoved(filter) {
    if (isPauseFilter(filter.text)) {
      return;
    }
    if (isDomainPauseFilter(filter.text)) {
      const filterTextIndex = storedSyncDomainPauses.indexOf(filter.text);
      storedSyncDomainPauses = storedSyncDomainPauses.slice(filterTextIndex);
      return;
    }
    postDataSyncHandler();
  }

  // a delay is added to allow the domain pause filters time to be saved to storage
  // otherwise the domain pause filter check below would always fail
  const onFilterListsSubAdded = function (sub, calledPreviously) {
    log('onFilterListsSubAdded', sub);
    if (calledPreviously === undefined) {
      setTimeout(() => {
        onFilterListsSubAdded(sub, true);
      }, 500);
      return;
    }
    let containsPauseFilter = false;
    if (sub.url && sub.url.startsWith('~user~') && sub._filterText.length) {
      const arrayLength = sub._filterText.length;
      for (let i = 0; i < arrayLength; i++) {
        const filter = sub._filterText[i];
        containsPauseFilter = isPauseFilter(filter);
        if (!containsPauseFilter && isDomainPauseFilter(filter)) {
          containsPauseFilter = true;
          storedSyncDomainPauses.push(filter.text);
        }
      }
    }
    if (containsPauseFilter) {
      return;
    }
    postDataSyncHandler();
  };

  const onFilterListsSubRemoved = function (sub) {
    let containsPauseFilter = false;
    if (sub.url && sub.url.startsWith('~user~') && sub._filterText.length) {
      const arrayLength = sub._filterText.length;
      for (let i = 0; i < arrayLength; i++) {
        const filter = sub._filterText[i];
        containsPauseFilter = isPauseFilter(filter);
        if (!containsPauseFilter && isDomainPauseFilter(filter.text)) {
          containsPauseFilter = true;
          const filterTextIndex = storedSyncDomainPauses.indexOf(filter.text);
          storedSyncDomainPauses = storedSyncDomainPauses.slice(filterTextIndex);
          return;
        }
      }
    }
    if (containsPauseFilter) {
      return;
    }
    postDataSyncHandler();
  };

  const onSettingsChanged = function (name) {
    if (name === 'sync_settings') {
      return; // don't process any sync setting changes
    }
    postDataSyncHandler();
  };

  const updateNetworkStatus = function () {
    if (navigator.onLine) {
      processEventChangeRequest();
    }
  };

  function processFetchRequest(commitVersion) {
    let fetchCommitVersion = commitVersion;
    if (!fetchCommitVersion) {
      return;
    }
    if (typeof fetchCommitVersion === 'string') {
      fetchCommitVersion = Number.parseInt(fetchCommitVersion, 10);
    }
    if (fetchCommitVersion === syncCommitVersion) {
      return;
    }
    getSyncData();
  }

  function enablePubNub() {
    pubnub = new PubNub({
      subscribeKey: License.MAB_CONFIG.subscribeKey,
      authKey: `${License.get().licenseId}_${TELEMETRY.userId()}`,
      ssl: true,
    });

    pubnub.addListener({
      message(response) {
        if (response.message && response.message && response.message.commitVersion) {
          processFetchRequest(response.message.commitVersion);
        }
      },
      status(msg) {
        if (msg.category === 'PNNetworkUpCategory') {
          pubnub.subscribe({
            channels: [License.get().licenseId],
          });
        }
        if (msg.error === true && msg.category && msg.operation) {
          ServerMessages.recordGeneralMessage('pubnub_error', undefined, { licenseId: License.get().licenseId, category: msg.category, operation: msg.operation });
        }
      },
    });

    pubnub.subscribe({
      channels: [License.get().licenseId],
    });
  }

  const enableSync = function (initialGet) {
    setSetting('sync_settings', true);
    const addListeners = function () {
      syncNotifier.on('sync.data.getting.error', onSyncDataGettingErrorAddLogEntry);
      syncNotifier.on('sync.data.getting.error.initial.fail', onSyncDataGettingErrorInitialFailAddLogEntry);
      syncNotifier.on('extension.names.downloading', onExtensionNamesDownloadingAddLogEntry);
      syncNotifier.on('sync.data.receieved', onSyncDataReceievedAddLogEntry);
      syncNotifier.on('sync.data.getting', onSyncDataGettingAddLogEntry);
      syncNotifier.on('post.data.sent.error', onPostDataSentErrorAddLogEntry);
      syncNotifier.on('post.data.sending', onPostDataSendingAddLogEntry);
      syncNotifier.on('post.data.sent', onPostDataSentAddLogEntry);
      syncNotifier.on('extension.name.remove.error', onExtensionNamesRemoveErrorAddLogEntry);
      syncNotifier.on('extension.name.removed', onExtensionNameRemovedAddLogEntry);
      syncNotifier.on('extension.name.remove', onExtensionNameRemoveAddLogEntry);
      syncNotifier.on('extension.name.updated.error', onExtensionNameUpdatedErrorAddLogEntry);
      syncNotifier.on('extension.name.updated', onExtensionNameUpdatedAddLogEntry);
      syncNotifier.on('extension.name.updating', onExtensionNameUpdatingAddLogEntry);
      syncNotifier.on('extension.names.downloaded', onExtensionNamesDownloadedAddLogEntry);
      syncNotifier.on('extension.names.downloading.error', onExtensionNamesDownloadingErrorAddLogEntry);

      // eslint-disable-next-line no-use-before-define
      License.licenseNotifier.on('license.expired', processDisableSync);

      ewe.subscriptions.onAdded.addListener(onFilterListsSubAdded);
      ewe.subscriptions.onRemoved.addListener(onFilterListsSubRemoved);

      ewe.filters.onAdded.addListener(onFilterAdded);
      ewe.filters.onRemoved.addListener(onFilterRemoved);

      settingsNotifier.on('settings.changed', onSettingsChanged);
      channelsNotifier.on('channels.changed', postDataSyncHandler);

      for (const inx in abpPrefPropertyNames) {
        const name = abpPrefPropertyNames[inx];
        Prefs.on(name, postDataSyncHandler);
      }
      // wait a moment at start to allow all of the backgound scripts to load
      setTimeout(() => {
        enablePubNub();
      }, 1000);

      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);
    };

    if (initialGet) {
      SyncService.getSyncData(initialGet, false, (response) => {
        if (response === 200 || response === 304) {
          addListeners();
        }
      });
      return;
    }

    addListeners();
  };

  function disablePubNub() {
    if (!pubnub) {
      return;
    }

    pubnub.removeAllListeners();
    pubnub.unsubscribeAll();
    pubnub = undefined;
  }

  const disableSync = function (removeName) {
    setSetting('sync_settings', false);
    syncCommitVersion = 0;
    disablePubNub();
    ewe.subscriptions.onAdded.removeListener(onFilterListsSubAdded);
    ewe.subscriptions.onRemoved.removeListener(onFilterListsSubRemoved);

    ewe.filters.onAdded.removeListener(onFilterAdded);
    ewe.filters.onRemoved.removeListener(onFilterRemoved);

    settingsNotifier.off('settings.changed', onSettingsChanged);
    channelsNotifier.off('channels.changed', postDataSyncHandler);

    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      Prefs.off(name, postDataSyncHandler);
    }

    storedSyncDomainPauses = [];
    if (removeName) {
      removeCurrentExtensionName();

      currentExtensionName = '';
      chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
    }

    syncNotifier.off('sync.data.getting.error', onSyncDataGettingErrorAddLogEntry);
    syncNotifier.off('sync.data.getting.error.initial.fail', onSyncDataGettingErrorInitialFailAddLogEntry);
    syncNotifier.off('extension.names.downloading', onExtensionNamesDownloadingAddLogEntry);
    syncNotifier.off('sync.data.receieved', onSyncDataReceievedAddLogEntry);
    syncNotifier.off('sync.data.getting', onSyncDataGettingAddLogEntry);
    syncNotifier.off('post.data.sent.error', onPostDataSentErrorAddLogEntry);
    syncNotifier.off('post.data.sending', onPostDataSendingAddLogEntry);
    syncNotifier.off('post.data.sent', onPostDataSentAddLogEntry);
    syncNotifier.off('extension.name.remove.error', onExtensionNamesRemoveErrorAddLogEntry);
    syncNotifier.off('extension.name.removed', onExtensionNameRemovedAddLogEntry);
    syncNotifier.off('extension.name.remove', onExtensionNameRemoveAddLogEntry);
    syncNotifier.off('extension.name.updated.error', onExtensionNameUpdatedErrorAddLogEntry);
    syncNotifier.off('extension.name.updated', onExtensionNameUpdatedAddLogEntry);
    syncNotifier.off('extension.name.updating', onExtensionNameUpdatingAddLogEntry);
    syncNotifier.off('extension.names.downloaded', onExtensionNamesDownloadedAddLogEntry);
    syncNotifier.off('extension.names.downloading.error', onExtensionNamesDownloadingErrorAddLogEntry);

    // eslint-disable-next-line no-use-before-define
    License.licenseNotifier.off('license.expired', processDisableSync);
    window.removeEventListener('online', updateNetworkStatus);
    window.removeEventListener('offline', updateNetworkStatus);
  };

  const processDisableSync = function () {
    disableSync(true);
  };

  // Retreive the sync data from the sync server
  // Input: successCallback:function - function that will be called when success occurs, the
  //                                   callback will be provided the response data
  //        errorCallback:function - function that will be called when  failure occurs, the
  //                                 callback will be provided the error code
  //        totalAttempts:integer - the number of 'get' attempts made (only used internally by
  //                               the retry logic)
  //        shouldForce:boolean - optional, force a response from the server (even if the commit
  //                              versions match), defaults to false
  const requestSyncData = function (successCallback, errorCallback, totalAttempts, shouldForce) {
    let attemptCount = totalAttempts;
    if (!attemptCount) {
      attemptCount = 1;
    } else {
      attemptCount += 1;
    }
    const forceParam = shouldForce || false;

    fetch(License.MAB_CONFIG.syncURL, {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'X-GABSYNC-PARAMS': JSON.stringify({
          extensionGUID: TELEMETRY.userId(),
          licenseId: License.get().licenseId,
          commitVersion: syncCommitVersion,
          force: forceParam,
          extInfo: getExtensionInfo(),
        }),
      },
    })
      .then(async (response) => {
        if (response.ok && typeof successCallback === 'function') {
          const text = await response.text();
          successCallback(text, response.status);
        }
        if (!response.ok) {
          if ((response.status !== 404 || response.status !== 403) && attemptCount < 3) {
            setTimeout(() => {
              requestSyncData(successCallback, errorCallback, attemptCount, shouldForce);
            }, 1000); // wait 1 second for retry
            return;
          }
          if (typeof errorCallback === 'function') {
            const responseObj = await response.json();
            errorCallback(response.status, response.status, responseObj);
          }
        }
      })
      .catch((error) => {
        log('message server returned error: ', error);
        errorCallback(error.message);
      });
  };

  settings.onload().then(() => {
    License.ready().then(() => {
      if (getSettings().sync_settings) {
        browser.storage.local.get(syncCommitVersionKey).then((response) => {
          syncCommitVersion = response[syncCommitVersionKey] || 0;
          browser.storage.local.get(syncPendingPostDataKey).then((postDataResponse) => {
            pendingPostData = postDataResponse[syncPendingPostDataKey] || false;
            processEventChangeRequest();
            enableSync();
            migrateSyncLog();
          });
        });
      }

      browser.storage.local.get(syncExtensionNameKey).then((response) => {
        currentExtensionName = response[syncExtensionNameKey] || '';
      });
    });
  });

  return {
    enableSync,
    disableSync,
    getSyncData,
    processFetchRequest,
    getCurrentExtensionName,
    getAllExtensionNames,
    setCurrentExtensionName,
    removeCurrentExtensionName,
    removeExtensionName,
    syncNotifier,
    getCommitVersion,
    setCommitVersion,
    getLastPostStatusCode,
    resetLastPostStatusCode,
    setLastPostStatusCode,
    getLastGetStatusCode,
    resetLastGetStatusCode,
    setLastGetStatusCode,
    getLastGetErrorResponse,
    resetLastGetErrorResponse,
    setLastGetErrorResponse,
    resetAllErrors,
    getSyncLog,
    deleteSyncLog,
    processUserSyncRequest,
    processEventChangeRequest,
    addSyncLogText,
  };
}());

export default SyncService;
