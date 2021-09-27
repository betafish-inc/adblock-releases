'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, settings, getSettings, setSetting, License, STATS, channels, exports, require,
   getSubscriptionsMinusText, chromeStorageSetHelper, getUserFilters, Prefs, abpPrefPropertyNames,
   Subscription, adblockIsDomainPaused, PubNub, adblockIsPaused, filterStorage, parseFilter,
   synchronizer, pausedFilterText1, pausedFilterText2, getUrlFromId, channelsNotifier,
   settingsNotifier, filterNotifier, isWhitelistFilter, recordGeneralMessage */

const { EventEmitter } = require('events');

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
    const storedLog = JSON.parse(localStorage.getItem(syncLogMessageKey) || '[]');
    const theReturnObj = {};
    Object.assign(theReturnObj, storedLog);
    return theReturnObj;
  };

  // TODO - when should we delete the log file???
  const deleteSyncLog = function () {
    localStorage.removeItem(syncLogMessageKey);
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
      flavor: STATS.flavor,
      browserVersion: STATS.browserVersion,
      os: STATS.os,
      osVersion: STATS.osVersion,
      extVersion: STATS.version,
      syncSchemaVersion,
    };
  };

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
    const storedLog = JSON.parse(localStorage.getItem(syncLogMessageKey) || '[]');
    storedLog.push(`${new Date().toUTCString()} , ${msg}`);
    while (storedLog.length > 500) { // only keep the last 500 log entries
      storedLog.shift();
    }
    localStorage.setItem(syncLogMessageKey, JSON.stringify(storedLog));
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

  const processSyncUpdate = function (payload) {
    // do we need a check or comparison of payload.version vs. syncSchemaVersion ?
    if (payload.settings) {
      const keywords = Object.keys(payload.settings);
      // Use a Promise to wait until the previous 'set' is complete because
      // calling 'setSetting' several times in a row in a loop prevents some
      // settings from being saved to storage
      for (let inx = 0, p = Promise.resolve(); inx < keywords.length; inx++) {
        const id = keywords[inx];
        p = p.then(() => new Promise((resolve) => {
          setSetting(id, payload.settings[id], () => {
            resolve();
          });
        }));
      }
    }
    if (payload.subscriptions) {
      const currentSubs = getSubscriptionsMinusText();
      for (const id in currentSubs) {
        const tempId = `url:${currentSubs[id].url}`;
        if (
          !payload.subscriptions[id]
          && !payload.subscriptions[tempId]
          && currentSubs[id].subscribed
          && currentSubs[id].url
        ) {
          const subscription = Subscription.fromURL(currentSubs[id].url);
          setTimeout(() => {
            filterStorage.removeSubscription(subscription);
          }, 1);
        }
      }
      for (const id in payload.subscriptions) {
        if (!currentSubs[id] || !currentSubs[id].subscribed) {
          let url = getUrlFromId(id);
          let subscription = Subscription.fromURL(url);
          if (!url && id.startsWith('url:')) {
            url = id.slice(4);
            subscription = Subscription.fromURL(url);
          }
          filterStorage.addSubscription(subscription);
          synchronizer.execute(subscription);
        }
      }
    }

    if (payload.customFilterRules) {
      // capture, then remove all current custom filters, account for pause filters in
      // current processing
      let currentUserFilters = getUserFilters();
      for (const inx in payload.customFilterRules) {
        const result = parseFilter(payload.customFilterRules[inx]);
        if (result.filter) {
          filterStorage.addFilter(result.filter);
        }
      }
      if (currentUserFilters && currentUserFilters.length) {
        currentUserFilters = cleanCustomFilter(currentUserFilters);
        // Delete / remove filters the user removed...
        if (currentUserFilters) {
          for (let i = 0; (i < currentUserFilters.length); i++) {
            let filter = currentUserFilters[i];
            if (payload.customFilterRules.indexOf(filter) === -1) {
              filter = filter.trim();
              if (filter.length > 0) {
                const result = parseFilter(filter);
                if (result.filter) {
                  filterStorage.removeFilter(result.filter);
                }
              }
            }
          }
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

    const getFailure = function (statusCode, textStatus, errorThrown, responseJSON) {
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

  const getAllExtensionNames = function (callback) {
    syncNotifier.emit('extension.names.downloading');
    $.ajax({
      jsonp: false,
      cache: false,
      headers: {
        'X-GABSYNC-PARAMS': JSON.stringify({
          extensionGUID: STATS.userId(),
          licenseId: License.get().licenseId,
          extInfo: getExtensionInfo(),
        }),
      },
      url: `${License.MAB_CONFIG.syncURL}/devices/list`,
      type: 'GET',
      success(text) {
        let responseObj = {};
        if (typeof text === 'object') {
          responseObj = text;
        } else if (typeof text === 'string') {
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
        syncNotifier.emit('extension.names.downloaded', responseObj);
        if (typeof callback === 'function') {
          callback(responseObj);
        }
      },
      error(xhr) {
        if (xhr.status === 404 && typeof callback === 'function' && xhr.responseText) {
          callback(xhr.responseText);
        }
        syncNotifier.emit('extension.names.downloading.error', xhr.status);
      },
    });
  };

  const setCurrentExtensionName = function (newName) {
    if (newName && newName.trim().length >= 1 && newName.trim().length <= 50) {
      currentExtensionName = newName.trim();
      chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
      const thedata = {
        deviceName: currentExtensionName,
        extensionGUID: STATS.userId(),
        licenseId: License.get().licenseId,
        extInfo: getExtensionInfo(),
      };
      syncNotifier.emit('extension.name.updating');
      $.ajax({
        jsonp: false,
        url: `${License.MAB_CONFIG.syncURL}/devices/add`,
        type: 'post',
        success() {
          syncNotifier.emit('extension.name.updated');
        },
        error(xhr) {
          syncNotifier.emit('extension.name.updated.error', xhr.status);
        },
        data: thedata,
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
    $.ajax({
      jsonp: false,
      url: `${License.MAB_CONFIG.syncURL}/devices/remove`,
      type: 'post',
      success() {
        if (extensionName === currentExtensionName) {
          currentExtensionName = '';
          chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
        }
        syncNotifier.emit('extension.name.removed');
      },
      error(xhr) {
        syncNotifier.emit('extension.name.remove.error', xhr.status);
      },
      data: thedata,
    });
  };


  const removeCurrentExtensionName = function () {
    removeExtensionName(currentExtensionName, STATS.userId());
  };

  // return all of the current user configurable extension options (settings, Prefs, filter list
  // sub, custom rules, themes, etc. Since a comparison will be done in this, and other sync'd
  // extensions, the payload should only contain settings, Prefs, etc and not data that can change
  // from browser to brower, version to version, etc.
  const getSyncInformation = function () {
    const payload = {};
    payload.settings = getSettings();
    payload.subscriptions = {};
    const subscriptions = getSubscriptionsMinusText();

    for (const id in subscriptions) {
      if (subscriptions[id].subscribed && subscriptions[id].url) {
        if (sendFilterListByURL.includes(id)) {
          payload.subscriptions[`url:${subscriptions[id].url}`] = subscriptions[id].url;
        } else {
          payload.subscriptions[id] = subscriptions[id].url;
        }
      }
    }
    payload.customFilterRules = cleanCustomFilter(getUserFilters());
    payload.prefs = {};
    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      payload.prefs[name] = Prefs[name];
    }
    payload.channels = {};
    const guide = channels.getGuide();
    for (const id in guide) {
      payload.channels[guide[id].name] = guide[id].enabled;
    }
    return payload;
  };

  const postDataSync = function (callback, initialGet) {
    if (!getSettings().sync_settings) {
      return;
    }
    const payload = getSyncInformation();
    const thedata = {
      data: JSON.stringify(payload),
      commitVersion: syncCommitVersion,
      extensionGUID: STATS.userId(),
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
      $.ajax({
        jsonp: false,
        url: License.MAB_CONFIG.syncURL,
        type: 'post',
        success(text, status, xhr) {
          lastPostStatusCode = xhr.status;
          let responseObj = {};
          if (typeof text === 'object') {
            responseObj = text;
          } else if (typeof text === 'string') {
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
          if (responseObj && responseObj.commitVersion > syncCommitVersion) {
            syncCommitVersion = text.commitVersion;
            chromeStorageSetHelper(syncCommitVersionKey, responseObj.commitVersion);
          }
          chromeStorageSetHelper(syncPreviousDataKey, thedata.data);
          if (typeof callback === 'function') {
            callback();
          }
          syncNotifier.emit('post.data.sent');
        },
        error(xhr) {
          syncNotifier.emit('post.data.sent.error', xhr.status, initialGet);
          lastPostStatusCode = xhr.status;
          if (xhr.status === 409) {
            // this extension probably had an version of the sync data
            // aka - the sync commit version was behind the sync server
            // so, undo / revert all of the user changes that were just posted
            // by doing a 'GET'
            // because we want the above error to be persisted, will set the
            // 'disableEmitMsg' to true
            getSyncData(false, true);
            return;
          }
          if (xhr.status === 403) {
            process403ErrorCode();
          }
          // all other currently known errors (0, 401, 404, 500).
          pendingPostData = true;
          chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
        },
        data: thedata,
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
      authKey: `${License.get().licenseId}_${STATS.userId()}`,
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
          recordGeneralMessage('pubnub_error', undefined, { licenseId: License.get().licenseId, category: msg.category, operation: msg.operation });
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

      filterNotifier.on('subscription.removed', onFilterListsSubRemoved);
      filterNotifier.on('subscription.added', onFilterListsSubAdded);

      filterNotifier.on('filter.added', onFilterAdded);
      filterNotifier.on('filter.removed', onFilterRemoved);

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

    filterNotifier.off('subscription.added', onFilterListsSubAdded);
    filterNotifier.off('subscription.removed', onFilterListsSubRemoved);

    filterNotifier.off('filter.added', onFilterAdded);
    filterNotifier.off('filter.removed', onFilterRemoved);

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

    window.removeEventListener('online', updateNetworkStatus);
    window.removeEventListener('offline', updateNetworkStatus);
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

    $.ajax({
      jsonp: false,
      cache: false,
      headers: {
        'X-GABSYNC-PARAMS': JSON.stringify({
          extensionGUID: STATS.userId(),
          licenseId: License.get().licenseId,
          commitVersion: syncCommitVersion,
          force: forceParam,
          extInfo: getExtensionInfo(),
        }),
      },
      url: License.MAB_CONFIG.syncURL,
      type: 'GET',
      success(text, textStatus, xhr) {
        if (typeof successCallback === 'function') {
          successCallback(text, xhr.status);
        }
      },
      error(xhr, textStatus, errorThrown) {
        if ((xhr.status !== 404 || xhr.status !== 403) && attemptCount < 3) {
          setTimeout(() => {
            requestSyncData(successCallback, errorCallback, attemptCount, shouldForce);
          }, 1000); // wait 1 second for retry
          return;
        }
        if (typeof errorCallback === 'function') {
          errorCallback(xhr.status, textStatus, errorThrown, xhr.responseJSON);
        }
      },
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
          });
        });
      }

      browser.storage.local.get(syncExtensionNameKey).then((response) => {
        currentExtensionName = response[syncExtensionNameKey] || '';
      });

      browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.command === 'resetLastGetStatusCode') {
          resetLastGetStatusCode();
          sendResponse({});
        }
      });

      browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.command === 'resetLastGetErrorResponse') {
          resetLastGetErrorResponse();
          sendResponse({});
        }
      });

      browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.command === 'resetLastPostStatusCode') {
          resetLastPostStatusCode();
          sendResponse({});
        }
      });

      browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.command === 'resetAllSyncErrors') {
          resetAllErrors();
          sendResponse({});
        }
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
  };
}());

exports.SyncService = SyncService;
