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
/* global browser, log, License, runBandaids, openTab */

// Set to true to get noisier console.log statements
const VERBOSE_DEBUG = false;
/* eslint-disable import/no-mutable-exports */
export let log = function log() {
};
// Enabled in adblock_start_common.js and background.js if the user wants
export const logging = function (enabled) {
  if (enabled) {
    /* eslint-disable no-shadow */
    log = function log(...args) {
      if (VERBOSE_DEBUG || args[0] !== '[DEBUG]') { // comment out for verbosity
        // eslint-disable-next-line no-console
        console.log(...args);
      }
    };
  } else {
    /* eslint-disable no-shadow */
    log = function log() {
    };
  }
};
logging(false); // disabled by default


// Determine what language the user's browser is set to use
export const determineUserLanguage = function () {
  return browser.i18n.getUILanguage();
};

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
const parseUriRegEx = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@/]*(?::[^:@/]*)?@)?(([^:/?#]*)(?::(\d*))?))((?:[^?#/]*\/)*[^?#]*)(\?[^#]*)?(#.*)?/;
export const parseUri = function (url) {
  const matches = parseUriRegEx.exec(url);

  // The key values are identical to the JS location object values for that key
  const keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'port',
    'pathname', 'search', 'hash'];
  const uri = {};
  for (let i = 0; (matches && i < keys.length); i++) {
    uri[keys[i]] = matches[i] || '';
  }
  return uri;
};

// Parses the search part of a URL into a key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function parseSearch(searchQuery) {
  const params = {};
  let search = searchQuery;
  let pair;

  // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
  search = search.substring(search.indexOf('?') + 1).split('&');

  for (let i = 0; i < search.length; i++) {
    pair = search[i].split('=');
    if (pair[0] && !pair[1]) {
      pair[1] = '';
    }
    const pairKey = decodeURIComponent(pair[0]);
    const pairValue = decodeURIComponent(pair[1]);
    if (pairKey && pairValue !== 'undefined') {
      params[pairKey] = pairValue;
    }
  }
  return params;
};

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
// keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function stripThirdPlusLevelDomain(domain, keepDot) {
  if (domain) {
    const match = domain.match(/([^.]+\.(?:co\.)?[^.]+)\.?$/) || [domain, domain];
    return match[keepDot ? 0 : 1].toLowerCase();
  }

  return domain;
};

const sessionStorageMap = new Map();
//
// Inputs: key:string.
// Returns value if key exists, else undefined.
/**
 * @deprecated consider using SessionStorage
 */
export const sessionStorageGet = function (key) {
  return sessionStorageMap.get(key);
};

// Inputs: key:string, value:object.
// If value === undefined, removes key from storage.
// Returns undefined.
/**
 * @deprecated consider using SessionStorage
 */
export const sessionStorageSet = function (key, value) {
  if (value === undefined) {
    sessionStorageMap.delete(key);
    return;
  }
  sessionStorageMap.set(key, value);
};


// Inputs: key:string.
// Returns object from localStorage.
// The following two functions should only be used when
// multiple 'sets' & 'gets' may occur in immediately preceding each other
// browser.storage.local.get & set instead
// deprecated on background / service worker pages
/**
 * @deprecated consider using browser.storage.local
 */
export const storageGet = function (key) {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }
  const store = localStorage;
  const json = store.getItem(key);
  if (json == null) {
    return undefined;
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    log(`Couldn't parse json for ${key}`, e);
    return undefined;
  }
};

// Inputs: key:string, value:object.
// If value === undefined, removes key from storage.
// Returns undefined.
/**
 * @deprecated consider using browser.storage.local
 */
export const storageSet = function (key, value) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const store = localStorage;
  if (value === undefined) {
    store.removeItem(key);
    return;
  }
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.log(ex);
  }
};

export const chromeStorageSetHelper = function (key, value, callback) {
  const items = {};
  items[key] = value;
  browser.storage.local.set(items).then(() => {
    if (typeof callback === 'function') {
      callback();
    }
  }).catch((error) => {
    if (typeof callback === 'function') {
      callback(error);
    }
  });
};

export const chromeStorageGetHelper = function (storageKey) {
  return new Promise(((resolve, reject) => {
    browser.storage.local.get(storageKey).then((items) => {
      resolve(items[storageKey]);
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      reject(error);
    });
  }));
};

export const chromeStorageDeleteHelper = function (key) {
  return browser.storage.local.remove(key);
};

// Migrate any stored data from localStorage to
// chrome.storage.local
// if the data is successfully migrated to chrome.storage,
// then the original data in localStorage is removed
// Inputs:
//   key: string - the data storage key
//   parseData: Boolean - indicates if the stored data should be parse prior to being saved
//                        in chrome.storage
export const migrateData = function (key, parseData) {
  return new Promise((resolve, reject) => {
    /* eslint-disable no-restricted-globals */
    if (typeof self.localStorage === 'undefined') {
      resolve();
    }
    let data = localStorage.getItem(key);
    if (data) {
      if (parseData) {
        data = JSON.parse(data);
      }

      chromeStorageSetHelper(key, data, (error) => {
        if (!error) {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
          }
          resolve();
        } else {
          reject(error);
        }
      });
    } else {
      resolve();
    }
  });
};

export const reloadOptionsPageTabs = function () {
  const optionTabQuery = {
    url: `chrome-extension://${browser.runtime.id}/options.html*`,
  };
  browser.tabs.query(optionTabQuery).then((tabs) => {
    for (const i in tabs) {
      browser.tabs.reload(tabs[i].id);
    }
  });
};

// eslint-disable-next-line max-len
export const isEmptyObject = obj => !!(obj && Object.keys(obj).length === 0 && obj.constructor === Object);

// mimics jQuery's functionality
export function extend(primaryArg, ...args) {
  const obj = primaryArg;
  for (let i = 0; i < args.length; i++) {
    for (const key in args[i]) {
      if (Object.prototype.hasOwnProperty.call(args[i], key)) {
        obj[key] = args[i][key];
      }
    }
  }
  return obj;
}

// Creates the meta data to be saved with a users custom filter rules
// Return a new object that the following structure:
// created - a Integer representing the number of milliseconds elapsed
//           since January 1, 1970 00:00:00 UTC.
// origin - a String representing the method that user added the filter rule
//
// Inputs: origin? - optional value
export const createFilterMetaData = (origin) => {
  const data = { created: Date.now() };
  if (origin) {
    data.origin = origin;
  }
  return data;
};
