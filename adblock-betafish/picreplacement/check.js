'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global ext, browser, require, storageGet, storageSet, log, STATS, Channels, Prefs,
   getSettings, setSetting, translate, reloadOptionsPageTabs, filterNotifier, openTab,
   emitPageBroadcast */

// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.
const { checkAllowlisted } = require('allowlisting');
const { EventEmitter } = require('events');
const browserAction = require('browserAction');
const { recordGeneralMessage } = require('./../servermessages').ServerMessages;
const { premiumMigration } = require('./../data_migration_premium');

const licenseNotifier = new EventEmitter();

const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = 'license';
  const installTimestampStorageKey = 'install_timestamp';
  const statsInIconKey = 'current_show_statsinicon';
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
  STATS.untilLoaded((userID) => {
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
    License.showIconBadgeCTA(true);
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
      browser.alarms.get(licenseAlarmName, (alarm) => {
        if (alarm && Date.now() > alarm.scheduledTime) {
          browser.alarms.clear(licenseAlarmName, () => {
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          const originalTime = alarm.scheduledTime;
          browser.alarms.clear(licenseAlarmName, (wasCleared) => {
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
    browser.alarms.get(License.sevenDayAlarmName, (alarm) => {
      if (alarm && Date.now() > alarm.scheduledTime) {
        browser.alarms.clear(License.sevenDayAlarmName, () => {
          License.showIconBadgeCTA(true);
          removeSevenDayAlarmStateListener();
          browser.storage.local.remove(License.sevenDayAlarmName);
        });
      } else if (alarm) {
        // if the alarm should fire in the future,
        // re-add the license so it fires at the correct time
        const originalTime = alarm.scheduledTime;
        browser.alarms.clear(License.sevenDayAlarmName, (wasCleared) => {
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
                  License.showIconBadgeCTA(true);
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
      const localLicense = storageGet(licenseStorageKey);
      theLicense = response[licenseStorageKey] || localLicense || {};
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

  return {
    statsInIconKey,
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
            License.showIconBadgeCTA(true);
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
        // store in redudant locations
        browser.storage.local.set({ license: theLicense });
        storageSet('license', theLicense);
      }
    },
    initialize(callback) {
      loadFromStorage(() => {
        checkForManagedSettings().then(() => {
          if (typeof callback === 'function') {
            callback();
          }
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
      STATS.untilLoaded((userID) => {
        licenseNotifier.emit('license.updating');
        const postData = {};
        postData.u = userID;
        postData.cmd = 'license_check';
        const licsenseStatusBefore = License.get().status;
        // license version
        postData.v = '1';
        $.ajax({
          jsonp: false,
          url: License.MAB_CONFIG.licenseURL,
          type: 'post',
          success(text) {
            ajaxRetryCount = 0;
            let updatedLicense = {};
            if (typeof text === 'object') {
              updatedLicense = text;
            } else if (typeof text === 'string') {
              try {
                updatedLicense = JSON.parse(text);
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
            licenseNotifier.emit('license.updated', updatedLicense);
            if (!updatedLicense) {
              return;
            }
            // merge the updated license
            theLicense = $.extend(theLicense, updatedLicense);
            theLicense.licenseId = theLicense.code;
            License.set(theLicense);
            // now check to see if we need to do anything because of a status change
            if (
              licsenseStatusBefore === 'active'
              && updatedLicense.status
              && updatedLicense.status === 'expired'
            ) {
              License.processExpiredLicense();
              recordGeneralMessage('trial_license_expired');
            }
          },
          error(xhr, textStatus, errorThrown) {
            log('license server error response', xhr, textStatus, errorThrown, ajaxRetryCount);
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
          },
          data: postData,
        });
      });
    },
    processExpiredLicense() {
      theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting('picreplacement', false);
      setSetting('sync_settings', false);
      setSetting('color_themes', { popup_menu: 'default_theme', options_page: 'default_theme' });
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
        const localTimestamp = storageGet(installTimestampStorageKey);
        const originalInstallTimestamp = installTimestamp || localTimestamp || Date.now();
        // If the installation timestamp is missing from both storage locations,
        // save an updated version
        if (!(response[installTimestampStorageKey] || localTimestamp)) {
          installTimestamp = Date.now();
          storageSet(installTimestampStorageKey, installTimestamp);
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
    getLicenseInstallationDate(callback) {
      if (typeof callback !== 'function') {
        return;
      }
      browser.storage.local.get(installTimestampStorageKey).then((response) => {
        const localTimestamp = storageGet(installTimestampStorageKey);
        const originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp;
        if (originalInstallTimestamp) {
          callback(new Date(originalInstallTimestamp));
        } else {
          callback(undefined);
        }
      });
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
        this.licenseTimer = window.setTimeout(() => {
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
    /**
     * Handles the display of the New badge on the toolbar icon.
     * @param {Boolean} [showBadge] true shows the badge, false removes the badge
     */
    showIconBadgeCTA(showBadge) {
      if (!License.shouldShowPremiumCTA()) {
        return;
      }
      if (showBadge) {
        let newBadgeText = translate('new_badge');
        // Text that exceeds 4 characters is truncated on the toolbar badge,
        // so we default to English
        if (!newBadgeText || newBadgeText.length >= 5) {
          newBadgeText = 'New';
        }
        storageSet(statsInIconKey, Prefs.show_statsinicon);
        Prefs.show_statsinicon = false;
        // wait 10 seconds to allow any other ABP setup tasks to finish
        setTimeout(() => {
          // process currrently opened tabs
          browser.tabs.query({}).then((tabs) => {
            for (const tab of tabs) {
              browserAction.setBadge(tab.id, { color: '#03bcfc', number: newBadgeText });
            }
            // set for new tabs
            browser.browserAction.setBadgeBackgroundColor({ color: '#03bcfc' });
            browser.browserAction.setBadgeText({ text: newBadgeText });
          });
        }, 10000); // 10 seconds
      } else {
        // Restore show_statsinicon if we previously stored its value
        const storedValue = storageGet(statsInIconKey);
        if (typeof storedValue === 'boolean') {
          Prefs.show_statsinicon = storedValue;
          storageSet(statsInIconKey); // remove the data, since we no longer need it

          browser.browserAction.setBadgeText({ text: '' });
        }
      }
    },
    // fetchLicenseAPI automates the common steps required to call the /license/api endpoint.
    // POST bodies will always automatically contain the command, license and userid so only
    // provide the missing fields in the body parameter. The ok callback handler receives the
    // data returned by the API and the fail handler receives any error information available.
    fetchLicenseAPI(command, requestBody, ok, requestFail) {
      const licenseCode = License.get().code;
      const userID = STATS.userId();
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

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'payment_success' && request.version === 1) {
    License.activate();
    premiumMigration.checkforLegacyAdBlockPremium(request.origin, sender);
    sendResponse({ ack: true });
  }
});

const replacedPerPage = new ext.PageMap();

// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
const replacedCounts = (function getReplacedCount() {
  const adReplacedNotifier = new EventEmitter();
  const key = 'replaced_stats';
  let data = storageGet(key);
  if (!data) {
    data = {};
  }
  if (data.start === undefined) {
    data.start = Date.now();
  }
  if (data.total === undefined) {
    data.total = 0;
  }
  data.version = 1;
  storageSet(key, data);

  return {
    recordOneAdReplaced(tabId) {
      data = storageGet(key);
      data.total += 1;
      storageSet(key, data);
      browser.tabs.get(tabId).then((tab) => {
        const myPage = new ext.Page(tab);
        let replaced = replacedPerPage.get(myPage) || 0;
        replacedPerPage.set(myPage, replaced += 1);
        adReplacedNotifier.emit('adReplaced', tabId, tab.url);
      });
    },
    get() {
      return storageGet(key);
    },
    getTotalAdsReplaced(tabId) {
      if (tabId) {
        return replacedPerPage.get(ext.getPage(tabId));
      }
      return this.get().total;
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
const onBehaviorPromise = new Promise(((resolve) => {
  filterNotifier.on('filter.behaviorChanged', () => {
    resolve();
  });
}));
// the order of Promises below dictacts the order of the data in the detailsArray
Promise.all([onInstalledPromise, License.ready(), onBehaviorPromise]).then((detailsArray) => {
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

let channels = {};
License.ready().then(() => {
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!(request.message === 'load_my_adblock')) {
      return;
    }
    if (sender.url && sender.url.startsWith('http') && getSettings().picreplacement) {
      const logError = function (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      };
      browser.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement-image-sizes-map.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
      browser.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
    }
    sendResponse({});
  });

  channels = new Channels();
  Object.assign(window, {
    channels,
  });
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message !== 'get_random_listing') {
      return;
    }

    const myPage = ext.getPage(sender.tab.id);
    if (checkAllowlisted(myPage) || !License.isActiveLicense()) {
      sendResponse({ disabledOnPage: true });
      return;
    }
    const result = channels.randomListing(request.opts);
    if (result) {
      sendResponse(result);
    } else {
      // if not found, and data collection enabled, send message to log server with domain,
      // and request
      sendResponse({ disabledOnPage: true });
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'recordOneAdReplaced') {
      sendResponse({});
      if (License.isActiveLicense()) {
        replacedCounts.recordOneAdReplaced(sender.tab.id);
      }
    }
  });

  License.checkSevenDayAlarm();

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'setBlacklistCTAStatus') {
      if (typeof request.isEnabled === 'boolean') {
        License.shouldShowBlacklistCTA(request.isEnabled);
      }
      sendResponse({});
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'setWhitelistCTAStatus') {
      if (typeof request.isEnabled === 'boolean') {
        License.shouldShowWhitelistCTA(request.isEnabled);
      }
      sendResponse({});
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'openPremiumPayURL') {
      openTab(License.MAB_CONFIG.payURL);
      sendResponse({});
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'cleanUpSevenDayAlarm') {
      License.cleanUpSevenDayAlarm();
      sendResponse({});
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'showIconBadgeCTA' && typeof request.value === 'boolean') {
      License.showIconBadgeCTA(request.value);
      sendResponse({});
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'License.MAB_CONFIG' && typeof request.url === 'string') {
      sendResponse({ url: License.MAB_CONFIG[request.url] });
    }
  });
});

License.initialize(() => {
  if (!License.initialized) {
    License.initialized = true;
  }
});

Object.assign(window, {
  License,
  replacedCounts,
});
