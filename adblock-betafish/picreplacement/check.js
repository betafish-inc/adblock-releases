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
/* global ext, browser, translate, openTab,
   emitPageBroadcast, isTrustedSenderDomain */


// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.

import { EventEmitter } from '../../vendor/adblockplusui/adblockpluschrome/lib/events';
import { TabSessionStorage } from '../../vendor/adblockplusui/adblockpluschrome/lib/storage/tab-session';

import { TELEMETRY } from '../telemetry';
import { Channels } from './channels';
import { getSettings, setSetting } from '../prefs/settings';
import { showIconBadgeCTA, NEW_BADGE_REASONS } from '../alias/icon';
import { initialize } from '../alias/subscriptionInit';
import ServerMessages from '../servermessages';
import SubscriptionAdapter from '../subscriptionadapter';
import postData from '../fetch-util';
import {
  chromeStorageSetHelper,
  chromeStorageGetHelper,
  migrateData,
  log,
  storageSet,
  reloadOptionsPageTabs,
} from '../utilities/background/bg-functions';

const licenseNotifier = new EventEmitter();

export const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = 'license';
  const installTimestampStorageKey = 'install_timestamp';
  const userClosedSyncCTAKey = 'user_closed_sync_cta';
  const userSawSyncCTAKey = 'user_saw_sync_cta';
  const pageReloadedOnSettingChangeKey = 'page_reloaded_on_user_settings_change';
  const licenseAlarmName = 'licenseAlarm';
  const sevenDayAlarmName = 'sevenDayLicenseAlarm';

  let theLicense;
  const fiveMinutes = 300000;
  const initialized = false;
  let ajaxRetryCount = 0;
  let readyComplete;
  const licensePromise = new Promise(((resolve) => {
    readyComplete = resolve;
  }));
  const themesForCTA = [
    'solarized_theme', 'solarized_light_theme', 'watermelon_theme', 'sunshine_theme', 'ocean_theme',
  ];
  let currentThemeIndex = 0;
  const mabConfig = {
    prod: {
      licenseURL: 'https://myadblock-licensing.firebaseapp.com/license/',
      syncURL: 'https://myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9eccffb2-8c6a-11e9-97ab-aa54ad4b08ec',
      payURL: 'https://getadblock.com/premium/enrollment/',
      subscriptionURL: 'https://getadblock.com/premium/manage-subscription/',
    },
    dev: {
      licenseURL: 'https://dev.myadblock.licensing.getadblock.com/license/',
      syncURL: 'https://dev.myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9e0a7270-83e7-11e9-99de-d6d3b84c4a25',
      payURL: 'https://getadblock.com/premium/enrollment/?testmode=true',
      subscriptionURL: 'https://dev.getadblock.com/premium/manage-subscription/',
    },
  };
  TELEMETRY.untilLoaded((userID) => {
    mabConfig.prod.payURL = `${mabConfig.prod.payURL}?u=${userID}`;
    mabConfig.dev.payURL = `${mabConfig.dev.payURL}&u=${userID}`;
  });
  const MAB_CONFIG = isProd ? mabConfig.prod : mabConfig.dev;

  const sevenDayAlarmIdleListener = function (newState) {
    if (newState === 'active') {
      License.checkSevenDayAlarm();
    }
  };

  const removeSevenDayAlarmStateListener = function () {
    browser.idle.onStateChanged.removeListener(sevenDayAlarmIdleListener);
  };

  const addSevenDayAlarmStateListener = function () {
    removeSevenDayAlarmStateListener();
    browser.idle.onStateChanged.addListener(sevenDayAlarmIdleListener);
  };

  const cleanUpSevenDayAlarm = function () {
    removeSevenDayAlarmStateListener();
    browser.storage.local.remove(License.sevenDayAlarmName);
    browser.alarms.clear(License.sevenDayAlarmName);
  };

  const processSevenDayAlarm = function () {
    cleanUpSevenDayAlarm();
    showIconBadgeCTA(true, NEW_BADGE_REASONS.SEVEN_DAY);
  };

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === licenseAlarmName) {
      // At this point, no alarms exists, so
      // create an temporary alarm to avoid race condition issues
      browser.alarms.create(licenseAlarmName, { delayInMinutes: (24 * 60) });
      License.ready().then(() => {
        License.updatePeriodically();
      });
    }
    if (alarm && alarm.name === sevenDayAlarmName) {
      processSevenDayAlarm();
    }
  });

  // Check if the computer was woken up, and if there was a pending alarm
  // that should fired during the sleep, then
  // remove it, and fire the update ourselves.
  // see - https://bugs.chromium.org/p/chromium/issues/detail?id=471524
  browser.idle.onStateChanged.addListener((newState) => {
    if (newState === 'active') {
      browser.alarms.get(licenseAlarmName).then((alarm) => {
        if (alarm && Date.now() > alarm.scheduledTime) {
          browser.alarms.clear(licenseAlarmName).then(() => {
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          const originalTime = alarm.scheduledTime;
          browser.alarms.clear(licenseAlarmName).then((wasCleared) => {
            if (wasCleared) {
              browser.alarms.create(licenseAlarmName, { when: originalTime });
            }
          });
        } else {
          License.updatePeriodically();
        }
      });
    }
  });

  // check the 7 alarm when the browser starts
  // or is woken up
  const checkSevenDayAlarm = function () {
    browser.alarms.get(License.sevenDayAlarmName).then((alarm) => {
      if (alarm && Date.now() > alarm.scheduledTime) {
        browser.alarms.clear(License.sevenDayAlarmName).then(() => {
          showIconBadgeCTA(true, NEW_BADGE_REASONS.SEVEN_DAY);
          removeSevenDayAlarmStateListener();
          browser.storage.local.remove(License.sevenDayAlarmName);
        });
      } else if (alarm) {
        // if the alarm should fire in the future,
        // re-add the license so it fires at the correct time
        const originalTime = alarm.scheduledTime;
        browser.alarms.clear(License.sevenDayAlarmName).then((wasCleared) => {
          if (wasCleared) {
            browser.alarms.create(License.sevenDayAlarmName, { when: originalTime });
            browser.storage.local.set({ [License.sevenDayAlarmName]: true });
            License.addSevenDayAlarmStateListener();
          }
        });
      } else {
        // since there's no alarm, we may need to show the 'new' text,
        // check if the temporary seven day alarm indicator is set, and
        // if the install date is 7 days or more than now
        browser.storage.local.get(License.sevenDayAlarmName).then((data) => {
          if (data && data[License.sevenDayAlarmName]) {
            browser.storage.local.get('blockage_stats').then((response) => {
              const { blockage_stats } = response;
              if (blockage_stats && blockage_stats.start) {
                const installDate = new Date(blockage_stats.start);
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
                const diffDays = Math.round((now - installDate) / oneDay);
                if (diffDays >= 7) {
                  showIconBadgeCTA(true, NEW_BADGE_REASONS.SEVEN_DAY);
                  removeSevenDayAlarmStateListener();
                  browser.storage.local.remove(License.sevenDayAlarmName);
                }
              }
            });
          }
        });
        removeSevenDayAlarmStateListener();
      }
    });
  };
  addSevenDayAlarmStateListener();

  // Load the license from persistent storage
  // Should only be called during startup / initialization
  const loadFromStorage = function (callback) {
    browser.storage.local.get(licenseStorageKey).then((response) => {
      theLicense = response[licenseStorageKey] || {};
      if (typeof callback === 'function') {
        callback();
      }
    });
  };
  const checkForManagedSettings = function () {
    return new Promise(((resolve) => {
      if ('managed' in browser.storage) {
        browser.storage.managed.get(null).then((items) => {
          for (const key in items) {
            if (key === 'suppress_premium_cta') {
              theLicense = License.get();
              theLicense[key] = items[key];
              License.set(theLicense);
            }
          }
          resolve();
        },
        // Opera and FF doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {
          resolve();
        });
      } else {
        resolve();
      }
    }));
  };

  // Clean up / remove old, unused data in localStorage
  function cleanUpLocalStorage() {
    storageSet(licenseStorageKey);
  }

  return {
    licenseStorageKey,
    userClosedSyncCTAKey,
    userSawSyncCTAKey,
    themesForCTA,
    pageReloadedOnSettingChangeKey,
    initialized,
    licenseAlarmName,
    sevenDayAlarmName,
    checkSevenDayAlarm,
    addSevenDayAlarmStateListener,
    removeSevenDayAlarmStateListener,
    cleanUpSevenDayAlarm,
    licenseTimer: undefined, // the license update timer token
    licenseNotifier,
    MAB_CONFIG,
    isProd,
    enrollUser(enrollReason) {
      loadFromStorage(() => {
        // only enroll users if they were not previously enrolled
        if (typeof theLicense.myadblock_enrollment === 'undefined') {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
          if (enrollReason === 'update') {
            showIconBadgeCTA(true, NEW_BADGE_REASONS.UPDATE);
          }
        }
      });
    },
    get() {
      return theLicense;
    },
    set(newLicense) {
      if (newLicense) {
        theLicense = newLicense;
        browser.storage.local.set({ license: theLicense });
      }
    },
    initialize(callback) {
      loadFromStorage(() => {
        checkForManagedSettings().then(() => {
          if (typeof callback === 'function') {
            callback();
          }
          cleanUpLocalStorage();
          readyComplete();
        });
      });
    },
    getCurrentPopupMenuThemeCTA() {
      const theme = License.themesForCTA[currentThemeIndex];
      const lastThemeIndex = License.themesForCTA.length - 1;
      currentThemeIndex = lastThemeIndex === currentThemeIndex ? 0 : currentThemeIndex += 1;
      return theme || '';
    },
    // Get the latest license data from the server, and talk to the user if needed.
    update() {
      TELEMETRY.untilLoaded((userID) => {
        licenseNotifier.emit('license.updating');
        const postDataObj = {};
        postDataObj.u = userID;
        postDataObj.cmd = 'license_check';
        const licsenseStatusBefore = License.get().status;
        // license version
        postDataObj.v = '1';
        postData(License.MAB_CONFIG.licenseURL, postDataObj).then(async (response) => {
          if (response.ok) {
            const responseObj = await response.json();
            ajaxRetryCount = 0;
            const updatedLicense = responseObj;
            licenseNotifier.emit('license.updated', updatedLicense);
            if (!updatedLicense) {
              return;
            }
            // merge the updated license
            theLicense = { ...theLicense, ...updatedLicense };
            theLicense.licenseId = theLicense.code;
            License.set(theLicense);
            // now check to see if we need to do anything because of a status change
            if (
              licsenseStatusBefore === 'active'
              && updatedLicense.status
              && updatedLicense.status === 'expired'
            ) {
              License.processExpiredLicense();
              ServerMessages.recordGeneralMessage('trial_license_expired');
            }
          } else {
            log('license server error response', response.status, ajaxRetryCount);
            licenseNotifier.emit('license.updated.error', ajaxRetryCount);
            ajaxRetryCount += 1;
            if (ajaxRetryCount > 3) {
              log('Retry Count exceeded, giving up', ajaxRetryCount);
              return;
            }
            const oneMinute = 1 * 60 * 1000;
            setTimeout(() => {
              License.updatePeriodically(`error${ajaxRetryCount}`);
            }, oneMinute);
          }
        })
          .catch((error) => {
            log('license server returned error: ', error);
          });
      });
    },
    processExpiredLicense() {
      theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting('picreplacement', false);
      licenseNotifier.emit('license.expired');
      if (getSettings().sync_settings) {
        // We have to import the "sync-service" module on demand,
        // as the "sync-service" module in turn requires this module.
        /* eslint-disable import/no-cycle */
        (import('./sync-service')).disableSync();
      }
      setSetting('color_themes', { popup_menu: 'default_theme', options_page: 'default_theme' });
      SubscriptionAdapter.unsubscribe({ adblockId: 'distraction-control-push' });
      SubscriptionAdapter.unsubscribe({ adblockId: 'distraction-control-newsletter' });
      SubscriptionAdapter.unsubscribe({ adblockId: 'distraction-control-survey' });
      SubscriptionAdapter.unsubscribe({ adblockId: 'distraction-control-video' });
      browser.alarms.clear(licenseAlarmName);
    },
    ready() {
      return licensePromise;
    },
    updatePeriodically() {
      if (!License.isActiveLicense()) {
        return;
      }
      License.update();
      browser.storage.local.get(installTimestampStorageKey).then((response) => {
        let installTimestamp = response[installTimestampStorageKey];
        const originalInstallTimestamp = installTimestamp || Date.now();
        // If the installation timestamp is missing from storage,
        // save an updated version
        if (!(response[installTimestampStorageKey])) {
          installTimestamp = Date.now();
          browser.storage.local.set({ install_timestamp: installTimestamp });
        }
        const originalInstallDate = new Date(originalInstallTimestamp);
        let nextLicenseCheck = new Date();
        if (originalInstallDate.getHours() <= nextLicenseCheck.getHours()) {
          nextLicenseCheck.setDate(nextLicenseCheck.getDate() + 1);
        }
        nextLicenseCheck.setHours(originalInstallDate.getHours());
        nextLicenseCheck.setMinutes(originalInstallDate.getMinutes());
        // Add 5 minutes to the 'minutes' to make sure we've allowed enought time for '1' day
        nextLicenseCheck = new Date(nextLicenseCheck.getTime() + fiveMinutes);
        browser.alarms.create(licenseAlarmName, { when: nextLicenseCheck.getTime() });
      });
    },
    async getLicenseInstallationDate() {
      const response = await browser.storage.local.get(installTimestampStorageKey);
      const originalInstallTimestamp = response[installTimestampStorageKey];
      if (originalInstallTimestamp) {
        return (new Date(originalInstallTimestamp));
      }
      return undefined;
    },
    // activate the current license and configure the extension in licensed mode.
    // Call with an optional delay parameter (in milliseconds) if the first license
    // update should be delayed by a custom delay (default is 0 minutes).
    activate(delayMs) {
      let delay = delayMs;
      const currentLicense = License.get() || {};
      currentLicense.status = 'active';
      License.set(currentLicense);
      reloadOptionsPageTabs();
      if (typeof delay !== 'number') {
        delay = 0; // 0 minutes
      }
      if (!this.licenseTimer) {
        this.licenseTimer = setTimeout(() => {
          License.updatePeriodically();
        }, delay);
      }
      setSetting('picreplacement', false);
    },
    getFormattedActiveSinceDate() {
      if (
        !License
        || !License.isActiveLicense()
        || !License.get()
        || !License.get().createdAtUTC
        || !Number.isInteger(License.get().createdAtUTC)
      ) {
        return null;
      }
      const dateFormat = { year: 'numeric', month: 'long' };
      let formattedDate = null;
      try {
        const createdAtUTC = parseInt(License.get().createdAtUTC, 10);
        formattedDate = new Date(createdAtUTC).toLocaleDateString(undefined, dateFormat);
      } catch (e) {
        return null;
      }
      return formattedDate;
    },
    isActiveLicense() {
      return License && License.get() && License.get().status === 'active';
    },
    isLicenseCodeValid() {
      return License && License.get().code && typeof License.get().code === 'string';
    },
    isMyAdBlockEnrolled() {
      return License && License.get() && License.get().myadblock_enrollment === true;
    },
    shouldShowMyAdBlockEnrollment() {
      return License.isMyAdBlockEnrolled()
        && !License.isActiveLicense()
        && License.shouldShowPremiumCTA();
    },
    shouldShowPremiumDcCTA() {
      return (License && License.isActiveLicense() && License.get().suppress_premium_cta !== true);
    },
    shouldShowPremiumCTA() {
      return !(License && License.get().suppress_premium_cta === true);
    },
    shouldShowBlacklistCTA(newValue) {
      if (!License.shouldShowPremiumCTA()) {
        return false;
      }
      const currentLicense = License.get() || {};
      if (typeof newValue === 'boolean') {
        currentLicense.showBlacklistCTA = newValue;
        License.set(currentLicense);
        return null;
      }

      if (typeof currentLicense.showBlacklistCTA === 'undefined') {
        currentLicense.showBlacklistCTA = true;
        License.set(currentLicense);
      }
      return License && License.get() && License.get().showBlacklistCTA === true;
    },
    shouldShowWhitelistCTA(newValue) {
      if (!License.shouldShowPremiumCTA()) {
        return false;
      }
      const currentLicense = License.get() || {};
      if (typeof newValue === 'boolean') {
        currentLicense.showWhitelistCTA = newValue;
        License.set(currentLicense);
        return null;
      }

      if (typeof currentLicense.showWhitelistCTA === 'undefined') {
        currentLicense.showWhitelistCTA = true;
        License.set(currentLicense);
      }
      return License && License.get() && License.get().showWhitelistCTA === true;
    },
    displayPopupMenuNewCTA() {
      const isNotActive = !License.isActiveLicense();
      const variant = License.get() ? License.get().var : undefined;
      return License && isNotActive && [3, 4].includes(variant) && License.shouldShowPremiumCTA();
    },
    // fetchLicenseAPI automates the common steps required to call the /license/api endpoint.
    // POST bodies will always automatically contain the command, license and userid so only
    // provide the missing fields in the body parameter. The ok callback handler receives the
    // data returned by the API and the fail handler receives any error information available.
    fetchLicenseAPI(command, requestBody, ok, requestFail) {
      const licenseCode = License.get().code;
      const userID = TELEMETRY.userId();
      const body = requestBody;
      let fail = requestFail;
      body.cmd = command;
      body.userid = userID;
      if (licenseCode) {
        body.license = licenseCode;
      }
      const request = new Request('https://myadblock.licensing.getadblock.com/license/api/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      fetch(request)
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          fail(response.status);
          fail = null;
          return Promise.resolve({});
        })
        .then((data) => {
          ok(data);
        })
        .catch((err) => {
          fail(err);
        });
    },
  };
}());

const replacedPerPage = new TabSessionStorage('ab:premium:replacedPerPage');

// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
export const replacedCounts = (function getReplacedCount() {
  const adReplacedNotifier = new EventEmitter();
  const key = 'replaced_stats';
  migrateData(key, true).then(() => {
    chromeStorageGetHelper(key).then((data) => {
      let replacedCountData = data;
      if (!data) {
        replacedCountData = {};
      }
      if (replacedCountData.start === undefined) {
        replacedCountData.start = Date.now();
      }
      if (replacedCountData.total === undefined) {
        replacedCountData.total = 0;
      }
      replacedCountData.version = 1;
      chromeStorageSetHelper(key, replacedCountData);
      storageSet(key);
    });
  });

  return {
    recordOneAdReplaced(tabId) {
      chromeStorageGetHelper(key).then((replacedCountData) => {
        const data = replacedCountData;
        data.total += 1;
        chromeStorageSetHelper(key, data);
        browser.tabs.get(tabId).then(async (tab) => {
          let replaced = await replacedPerPage.get(tabId) || 0;
          await replacedPerPage.set(tabId, replaced += 1);
          adReplacedNotifier.emit('adReplaced', tabId, tab.url);
        });
      });
    },
    get() {
      return chromeStorageGetHelper(key);
    },
    async getTotalAdsReplaced(tabId) {
      if (tabId) {
        return replacedPerPage.get(tabId);
      }
      return this.get().then(data => data.total);
    },
    adReplacedNotifier,
  };
}());

// for use in the premium enrollment process
// de-coupled from the `License.ready().then` code below because the delay
// prevents the addListener from being fired in a timely fashion.
const onInstalledPromise = new Promise(((resolve) => {
  browser.runtime.onInstalled.addListener((details) => {
    resolve(details);
  });
}));

// the order of Promises below dictacts the order of the data in the detailsArray
Promise.all([onInstalledPromise, License.ready(), initialize]).then((detailsArray) => {
  // Enroll existing users in Premium
  if (detailsArray.length > 0 && detailsArray[0].reason) {
    License.enrollUser(detailsArray[0].reason);
    if (detailsArray[0].reason === 'install') {
      // create an alarm that will fire in ~ 7 days to show the "New" badge text
      browser.alarms.create(License.sevenDayAlarmName, { delayInMinutes: (60 * 24 * 7) });
      License.addSevenDayAlarmStateListener();
      browser.storage.local.set({ [License.sevenDayAlarmName]: true });
    }
  }
});

License.ready().then(() => {
  License.checkSevenDayAlarm();

  if (License.isActiveLicense()) {
    License.updatePeriodically();
  }
});

License.initialize(() => {
  if (!License.initialized) {
    License.initialized = true;
  }
});

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  License,
  replacedCounts,
});

export const channels = new Channels(License);
