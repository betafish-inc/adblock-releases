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
/* global browser, adblockIsPaused */

// This module is conditional imported only into a Chrome build via the
// build config file in ..build\config\chrome.mjs

import getAvailableFiles from './localFilesIndex';
import {
  getSettings, settings,
} from './prefs/settings';
import {
  parseUri,
  chromeStorageGetHelper,
  chromeStorageSetHelper,
  migrateData,
} from './utilities/background/bg-functions';

const LocalCDN = (function getLocalCDN() {
  const urlsMatchPattern = ['http://*/*', 'https://*/*'];
  const hostRegex = /ajax\.googleapis\.com|ajax\.aspnetcdn\.com|ajax\.microsoft\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|yastatic\.net|yandex\.st|libs\.baidu\.com|lib\.sinaapp\.com|upcdn\.b0\.upaiyun\.com/;
  const pathRegex = { jquery: /jquery[/-](\d*\.\d*\.\d*)/ };
  const libraryPaths = { jquery: { prefix: 'jquery-', postfix: '.min.js' } };
  const headersToRemove = ['Cookie', 'Origin', 'Referer'];
  const redirectCountKey = 'redirectCount';
  const dataCountKey = 'redirectDataCount';
  const missedVersionsKey = 'missedVersions';
  let localFiles = {};
  let libraries = [];
  let versionArray = {};

  // Gets a stored value from chrome.storage if available, and parses it. Otherwise,
  // if the value isn't currently stored or if the parse fails, returns a default
  // value.
  // Param: keyName: the key under which the value is stored
  //        defaultValue: the value to be returned if the stored value cannot be
  //                      retrieved
  const getStoredValue = function (keyName, defaultValue) {
    return new Promise((resolve) => {
      chromeStorageGetHelper(keyName).then((response) => {
        let storedValue = null;
        try {
          storedValue = JSON.parse(response);
        } catch (err) {
          storedValue = defaultValue;
        } finally {
          if (!storedValue) {
            storedValue = defaultValue;
          }
        }
        resolve(storedValue);
      });
    });
  };

  // Populates the version array based on the files available locally
  // Pre: localFiles and libraries must be populated first
  const populateVersionArray = function () {
    const libraryVersions = {};
    // go through each libarary
    for (let i = 0; i < libraries.length; i++) {
      // check for path info
      if (libraryPaths[libraries[i]]) {
        // get the filenames
        const filenames = Object.getOwnPropertyNames(localFiles[libraries[i]]);
        libraryVersions[libraries[i]] = [];
        for (let j = 0; j < filenames.length; j++) {
          // extract the version from the filesname
          let version = filenames[j].replace(libraryPaths[libraries[i]].prefix, '');
          version = version.replace(libraryPaths[libraries[i]].postfix, '');
          libraryVersions[libraries[i]].push(version);
        }
      }
    }

    return libraryVersions;
  };

  // Completes necessary set up for the LocalCDN
  // Post:  localFiles, libraries, and versionArray are populated based on
  //        available local files
  const setUp = function () {
    localFiles = getAvailableFiles();
    libraries = Object.getOwnPropertyNames(localFiles);
    versionArray = populateVersionArray();
  };

  // Increments the redirect count by one.
  // The redirect count is loaded from and saved to storage.
  const incrementRedirectCount = function () {
    getStoredValue(redirectCountKey, 0).then((count) => {
      // increment
      let storedRedirectCount = count;
      storedRedirectCount += 1;

      // store updated count
      chromeStorageSetHelper(redirectCountKey, JSON.stringify(storedRedirectCount));
    });
  };

  // Adds the size of the specified file to the data count for that library.
  // The data count is loaded from and saved to storage.
  // Param: targetLibrary: the library that the file belongs to
  //        fileName: the file to be added to the data count
  const addToDataCount = function (targetLibrary, fileName) {
    getStoredValue(dataCountKey, 0).then((count) => {
      // add file size to data count
      let storedDataCount = count;
      storedDataCount += localFiles[targetLibrary][fileName];

      // store updated count
      chromeStorageSetHelper(dataCountKey, JSON.stringify(storedDataCount));
    });
  };

  // Adds the specified version of the specified library to the missed versions
  // object, if it hasn't already been added. Otherwise increments the count for
  // that version.
  // The missed versions object is loaded from and saved to storage.
  // Param: targetLibrary: the library that the missing version belongs to
  //        version: the missing version to be added
  const addMissedVersion = function (targetLibrary, version) {
    getStoredValue(missedVersionsKey, {}).then((storedMissedVersions) => {
      // add new missed version
      const missedVersions = storedMissedVersions;
      if (!missedVersions[targetLibrary]) {
        missedVersions[targetLibrary] = {};
      }
      if (missedVersions[targetLibrary][version] > 0) {
        missedVersions[targetLibrary][version] += 1;
      } else {
        missedVersions[targetLibrary][version] = 1;
      }

      // store updated missed versions
      chromeStorageSetHelper(missedVersionsKey, JSON.stringify(missedVersions));
    });
  };

  // Handles a webRequest.onBeforeRequest event.
  // Redirects any requests for locally available files from a matching host,
  // if AdBlock is not paused. Otherwise allows request to continue as normal.
  // Records any redirects, bytes of data redirected, and missing versions of
  // supported libararies.
  // Param: details: holds information about the request, including the URL.
  const libRequestHandler = function (details) {
    // respect pause
    if (!adblockIsPaused()) {
      let targetLibrary = null;
      const requestUrl = parseUri(details.url);

      // check if the url contains a library keyword
      for (let i = 0; i < libraries.length; i++) {
        if (requestUrl.pathname.indexOf(libraries[i]) !== -1) {
          targetLibrary = libraries[i];
        }
      }

      // check the request host
      if (targetLibrary !== null && hostRegex.test(requestUrl.host)) {
        // check the path
        const matches = pathRegex[targetLibrary].exec(requestUrl.pathname);
        if (matches) {
          const version = matches[1];

          // check if we have the version locally
          if (versionArray[targetLibrary].indexOf(version) !== -1) {
            const libraryPrefix = libraryPaths[targetLibrary].prefix;
            const libraryPostfix = libraryPaths[targetLibrary].postfix;
            const fileName = libraryPrefix + version + libraryPostfix;
            const localPath = `localLib/${targetLibrary}/${fileName}`;
            incrementRedirectCount();
            addToDataCount(targetLibrary, fileName);
            return { redirectUrl: browser.runtime.getURL(localPath) };
          }
          addMissedVersion(targetLibrary, version);
        }
      }
    }

    return { cancel: false };
  };

  // Handles a webrequest.onBeforeSendHeaders event.
  // Strips the cookie, origin, and referer headers (if present) from any requests for
  // a supported libarary from a matching host, if AdBlock is not paused. Otherwise
  // allows request to continue as normal.
  // Param: details: holds information about the request, including the URL and request
  //                 headers
  const stripMetadataHandler = function (details) {
    // respect pause
    if (!adblockIsPaused()) {
      const requestUrl = parseUri(details.url);
      let match = false;

      // check if the url contains a library keyword
      for (let k = 0; k < libraries.length; k++) {
        if (requestUrl.pathname.indexOf(libraries[k]) !== -1) {
          match = true;
        }
      }

      // check for a matching host
      if (match && hostRegex.test(requestUrl.host)) {
        // strip the headers to remove, if present
        for (let i = 0; i < details.requestHeaders.length; i++) {
          const aHeader = details.requestHeaders[i].name;
          if (headersToRemove.includes(aHeader)) {
            details.requestHeaders.splice(i -= 1, 1);
          }
        }
      }
    }

    return { requestHeaders: details.requestHeaders };
  };

  // Sets redirect count, data count, and missed versions back to default
  // (0 for redirect count and data count, and an empty object for missed
  // versions)
  const resetCollectedData = function () {
    chromeStorageSetHelper(redirectCountKey, '0');
    chromeStorageSetHelper(dataCountKey, '0');
    chromeStorageSetHelper(missedVersionsKey, '{}');
  };

  return {
    migrateStoredData() {
      return Promise.all([migrateData(redirectCountKey),
        migrateData(dataCountKey),
        migrateData(missedVersionsKey)]);
    },
    setUp,
    // Starts the LocalCDN listeners
    start() {
      setUp();
      browser.webRequest.onBeforeRequest.addListener(libRequestHandler, { urls: urlsMatchPattern }, ['blocking']);
      browser.webRequest.onBeforeSendHeaders.addListener(stripMetadataHandler, { urls: urlsMatchPattern }, ['blocking', 'requestHeaders']);
    },
    // Stops the LocalCDN listeners and reset data
    end() {
      browser.webRequest.onBeforeRequest.removeListener(libRequestHandler);
      browser.webRequest.onBeforeSendHeaders.removeListener(stripMetadataHandler);
      resetCollectedData();
    },
    // Gets the redirect count as a number of redirects
    getRedirectCount() {
      return getStoredValue(redirectCountKey, 0);
    },
    // Gets the data count as a number of bytes
    getDataCount() {
      return getStoredValue(dataCountKey, 0);
    },
    // Gets the missed versions object, which includes a count of how many
    // times the missed version has been requested
    getMissedVersions() {
      return getStoredValue(missedVersionsKey, undefined);
    },
  };
}());

export default LocalCDN;

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  LocalCDN,
});

settings.onload().then(() => {
  if (getSettings().local_cdn) {
    LocalCDN.migrateStoredData().then(() => {
      LocalCDN.start();
    });
  }
});
