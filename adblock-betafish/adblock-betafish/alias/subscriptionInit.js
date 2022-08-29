/** @module adblock-betafish/alias/subscriptionInit */

/** similar to adblockpluschrome\lib\subscriptionInit.js */

/** @module subscriptionInit */

import { Prefs } from 'prefs';
import * as info from 'info';
import * as ewe from '../../vendor/webext-sdk/dist/ewe-api';

import { port } from "../../vendor/adblockplusui/adblockpluschrome/lib/messaging";

import { TELEMETRY } from '../telemetry';

let firstRun;
let subscriptionsCallback = null;
let userNotificationCallback = null;
let reinitialized = false;
let dataCorrupted = false;

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
 async function detectFirstRun(foundSubscriptions, foundStorage) {
   let userFilters = await ewe.filters.getUserFilters();
   firstRun = !foundSubscriptions && !userFilters.length;

   if (firstRun && (foundStorage || Prefs.currentVersion))
     reinitialized = true;

   Prefs.currentVersion = info.addonVersion;
 }

/**
 * In case of data corruption, we don't want to show users
 * any non-essential notifications so we need to instruct
 * the notification manager to ignore them.
 *
 * @param {boolean} value
 */
function setDataCorrupted(value) {
  dataCorrupted = value;
  ewe.notifications.ignored = value;
}

/*
 * Remove any subscriptions that a user or administrator has added to a
 * central / common configuration (such as the Windows Registry)
 *
 * @return {Promise}
 */

function removeSubscriptions() {
  return new Promise(function (resolve, reject) {
    if ("managed" in browser.storage) {
      browser.storage.managed.get(null).then(
        items => {
          for (let key in items) {
            if (key === "remove_subscriptions" && Array.isArray(items[key]) && items[key].length) {
              for (let inx = 0; inx < items[key].length; inx++) {
                ewe.subscriptions.remove(items[key][inx]);
              }
            }
          }
          resolve();
        },

        // Opera doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {
          resolve();
        }
      );
    } else {
      resolve();
    }
  });
}

function openInstalled() {
  TELEMETRY.untilLoaded(function (userID) {
    browser.tabs.create({
      url:
        "https://getadblock.com/installed/?u=" +
        userID +
        "&lg=" +
        browser.i18n.getUILanguage() +
        "&dc=" +
        dataCorrupted
    });
  });
}

function addSubscriptions() {
  // Remove "acceptable ads" if Gecko
  // Add "AdBlock Custom" subscriptions
  if (firstRun) {
    for (let url of Prefs.additional_subscriptions) {
      try {
        ewe.subscriptions.add(url);
        ewe.subscriptions.sync(url);
      }
      catch (ex) {
        console.error(`Failed to add additional subscription: ${url}`);
      }
    }
    if (info.platform === "gecko") {
      try {
        ewe.subscriptions.remove(ewe.subscriptions.ACCEPTABLE_ADS_URL);
      }
      catch (ex) {
        console.error(`Failed to remove AA subscription`);
      }
    }

    try {
      ewe.subscriptions.add("https://cdn.adblockcdn.com/filters/adblock_custom.txt");
      ewe.subscriptions.sync("https://cdn.adblockcdn.com/filters/adblock_custom.txt");
    }
    catch (ex) {
      console.error(`Failed to add additional subscription`);

    }
  }

  // Show first run page or the updates page. The latter is only shown
  // on Chromium (since the current updates page announces features that
  // aren't new to Firefox users), and only if this version of the
  // updates page hasn't been shown yet.

  if (firstRun && !Prefs.suppress_first_run_page) {
    // Always show the first run page if a data corruption was detected
    // (either through failure of reading from or writing to storage.local).
    // The first run page could notify the user about the data corruption.
    if (firstRun || dataCorrupted) {
      openInstalled();
    }
  }
}

/**
 * We need to check whether we can safely write to/read from storage
 * before we start relying on it for storing preferences.
 */
async function testStorage() {
  let testKey = "readwrite_test";
  let testValue = Math.random();

  try {
    await browser.storage.local.set({ [testKey]: testValue });
    let result = await browser.storage.local.get(testKey);
    if (result[testKey] != testValue)
      throw new Error("Storage test: Failed to read and write value");
  } finally {
    await browser.storage.local.remove(testKey);
  }
}

const initialize = async function () {
  const [eweFirstRun] = await Promise.all([
    ewe.start({ name: info.addonName, version: info.addonVersion }),
    Prefs.untilLoaded.catch(() => { setDataCorrupted(true); }),
    testStorage().catch(() => { setDataCorrupted(true); })
  ]);

  await detectFirstRun(
    eweFirstRun.foundSubscriptions,
    eweFirstRun.foundStorage
  );
  // adding default filter lists
  addSubscriptions();
  await removeSubscriptions();
  return Promise.resolve();
}();

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
function isDataCorrupted() {
  return dataCorrupted;
}

export { initialize, isDataCorrupted };


/**
 * @typedef {object} subscriptionsGetInitIssuesResult
 * @property {boolean} dataCorrupted
 *   true if it appears that the user's extension data was corrupted.
 * @property {boolean} reinitialized
 *   true if we have reset the user's settings due to data corruption.
 */

/**
 * Returns an Object with boolean flags for any subscription initialization
 * issues.
 *
 * @event "subscriptions.getInitIssues"
 * @returns {subscriptionsGetInitIssuesResult}
 */
port.on("subscriptions.getInitIssues", (message, sender) => ({ dataCorrupted, reinitialized }));
