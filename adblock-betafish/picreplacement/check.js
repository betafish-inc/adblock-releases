'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global ext, chrome, require, storageGet, storageSet, log, STATS, Channels, Prefs,
   getSettings, setSetting, translate, reloadOptionsPageTabs */

// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.
const { checkWhitelisted } = require('whitelisting');
const { EventEmitter } = require('events');
const { recordGeneralMessage } = require('./../servermessages').ServerMessages;

const MY_ADBLOCK_FEATURE_VERSION = 0;
const licenseNotifier = new EventEmitter();

const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = 'license';
  const installTimestampStorageKey = 'install_timestamp';
  const statsInIconKey = 'current_show_statsinicon';
  const popupMenuCtaClosedKey = 'popup_menu_cta_closed';
  const licenseAlarmName = 'licenseAlarm';
  let theLicense;
  const fiveMinutes = 300000;
  const initialized = false;
  let ajaxRetryCount = 0;
  let readyComplete;
  const licensePromise = new Promise(((resolve) => {
    readyComplete = resolve;
  }));

  const mabConfig = {
    prod: {
      licenseURL: 'https://myadblock-licensing.firebaseapp.com/license/',
      syncURL: 'https://myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9eccffb2-8c6a-11e9-97ab-aa54ad4b08ec',
      payURL: 'https://getadblock.com/myadblock/enrollment/v4/',
    },
    dev: {
      licenseURL: 'https://dev.myadblock.licensing.getadblock.com/license/',
      syncURL: 'https://dev.myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9e0a7270-83e7-11e9-99de-d6d3b84c4a25',
      payURL: 'https://getadblock.com/myadblock/enrollment/v4/?testmode=true',
    },
  };
  const MAB_CONFIG = isProd ? mabConfig.prod : mabConfig.dev;


  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === licenseAlarmName) {
      // At this point, no alarms exists, so
      // create an temporary alarm to avoid race condition issues
      chrome.alarms.create(licenseAlarmName, { delayInMinutes: (24 * 60) });
      License.ready().then(() => {
        License.updatePeriodically();
      });
    }
  });

  // Check if the computer was woken up, and if there was a pending alarm
  // that should fired during the sleep, then
  // remove it, and fire the update ourselves.
  // see - https://bugs.chromium.org/p/chromium/issues/detail?id=471524
  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === 'active') {
      chrome.alarms.get(licenseAlarmName, (alarm) => {
        if (alarm && Date.now() > alarm.scheduledTime) {
          chrome.alarms.clear(licenseAlarmName, () => {
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          const originalTime = alarm.scheduledTime;
          chrome.alarms.clear(licenseAlarmName, (wasCleared) => {
            if (wasCleared) {
              chrome.alarms.create(licenseAlarmName, { when: originalTime });
            }
          });
        } else {
          License.updatePeriodically();
        }
      });
    }
  });

  // Load the license from persistent storage
  // Should only be called during startup / initialization
  const loadFromStorage = function (callback) {
    chrome.storage.local.get(licenseStorageKey).then((response) => {
      const localLicense = storageGet(licenseStorageKey);
      theLicense = response[licenseStorageKey] || localLicense || {};
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  // Check the response from a ping to see if it contains valid show MyAdBlock enrollment
  // instructions. If so, return an object containing data. Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  const myAdBlockDataFrom = function (responseData) {
    if (responseData.length === 0 || responseData.trim().length === 0) {
      return null;
    }
    let pingData;
    try {
      pingData = JSON.parse(responseData);
      if (!pingData) {
        return null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Something went wrong with parsing survey data.');
      // eslint-disable-next-line no-console
      console.log('error', e);
      // eslint-disable-next-line no-console
      console.log('response data', responseData);
      return null;
    }
    return pingData;
  };

  return {
    licenseStorageKey,
    popupMenuCtaClosedKey,
    initialized,
    licenseAlarmName,
    licenseTimer: undefined, // the license update timer token
    licenseNotifier,
    MAB_CONFIG,
    isProd,
    checkPingResponse(pingResponseData) {
      if (pingResponseData.length === 0 || pingResponseData.trim().length === 0) {
        loadFromStorage(() => {
          if (theLicense.myadblock_enrollment === true) {
            theLicense.myadblock_enrollment = false;
            License.set(theLicense);
          }
        });
        return;
      }
      const pingData = myAdBlockDataFrom(pingResponseData);
      if (!pingData) {
        return;
      }
      if (pingData.myadblock_enrollment === true) {
        loadFromStorage(() => {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
          License.showIconBadgeCTA(true);
        });
      }
    },
    get() {
      return theLicense;
    },
    set(newLicense) {
      if (newLicense) {
        theLicense = newLicense;
        // store in redudant locations
        chrome.storage.local.set({ license: theLicense });
        storageSet('license', theLicense);
      }
    },
    initialize(callback) {
      loadFromStorage(() => {
        if (typeof callback === 'function') {
          callback();
        }
        readyComplete();
      });
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
      chrome.alarms.clear(licenseAlarmName);
    },
    ready() {
      return licensePromise;
    },
    updatePeriodically() {
      if (!License.isActiveLicense()) {
        return;
      }
      License.update();
      chrome.storage.local.get(installTimestampStorageKey).then((response) => {
        let installTimestamp = response[installTimestampStorageKey];
        const localTimestamp = storageGet(installTimestampStorageKey);
        const originalInstallTimestamp = installTimestamp || localTimestamp || Date.now();
        // If the installation timestamp is missing from both storage locations,
        // save an updated version
        if (!(response[installTimestampStorageKey] || localTimestamp)) {
          installTimestamp = Date.now();
          storageSet(installTimestampStorageKey, installTimestamp);
          chrome.storage.local.set({ install_timestamp: installTimestamp });
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
        chrome.alarms.create(licenseAlarmName, { when: nextLicenseCheck.getTime() });
      });
    },
    getLicenseInstallationDate(callback) {
      if (typeof callback !== 'function') {
        return;
      }
      chrome.storage.local.get(installTimestampStorageKey).then((response) => {
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
    // update should be delayed by a custom delay (default is 30 minutes).
    activate(delayMs) {
      let delay = delayMs;
      const currentLicense = License.get() || {};
      currentLicense.status = 'active';
      License.set(currentLicense);
      reloadOptionsPageTabs();
      if (typeof delay !== 'number') {
        delay = 30 * 60 * 1000; // 30 minutes
      }
      if (!this.licenseTimer) {
        this.licenseTimer = window.setTimeout(() => {
          License.updatePeriodically();
        }, delay);
      }
      setSetting('picreplacement', false);
    },
    isActiveLicense() {
      return License && License.get() && License.get().status === 'active';
    },
    isMyAdBlockEnrolled() {
      return License && License.get() && License.get().myadblock_enrollment === true;
    },
    shouldShowMyAdBlockEnrollment() {
      return License.isMyAdBlockEnrolled() && !License.isActiveLicense();
    },
    displayPopupMenuNewCTA() {
      const isNotActive = !License.isActiveLicense();
      const variant = License.get() ? License.get().var : undefined;
      return License && isNotActive && [3, 4].includes(variant);
    },
    /**
     * Handles the display of the New badge on the toolbar icon.
     * @param {Boolean} [showBadge] true shows the badge, false removes the badge
     */
    showIconBadgeCTA(showBadge) {
      if (showBadge) {
        storageSet(statsInIconKey, Prefs.show_statsinicon);
        Prefs.show_statsinicon = false;
        chrome.browserAction.setBadgeBackgroundColor({ color: '#03bcfc' });
        chrome.browserAction.setBadgeText({ text: translate('new_badge') });
      } else {
        // Restore show_statsinicon if we previously stored its value
        const storedValue = storageGet(statsInIconKey);
        if (typeof storedValue === 'boolean') {
          Prefs.show_statsinicon = storedValue;
        }
        chrome.browserAction.setBadgeText({ text: '' });
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
    // resendEmail that contains license information and a "magic link" to activate other
    // extensions. This is a workaround for MAB not being generally available so other extensions
    // needing MAB must be enrolled somehow in MAB. The license is sent to the currently registered
    // email for the original license purchase and is returned to the `ok` handler for UI display.
    // If an error sending the email occurs, the `fail` handler is called with the failure error.
    resendEmail(ok, fail) {
      License.fetchLicenseAPI('resend_email', {}, (data) => {
        if (data && data.email) {
          ok(data.email);
        } else {
          fail();
        }
      }, (err) => {
        fail(err);
      });
    },
  };
}());

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.command === 'payment_success' && request.version === 1) {
      License.activate();
      sendResponse({ ack: true });
    } else if (typeof request.magicCode === 'string') {
      // Find MAB status: justInstalled | alreadyActive
      const status = License.isMyAdBlockEnrolled() ? 'alreadyActive' : 'justInstalled';
      if (status === 'alreadyActive') {
        sendResponse({ ack: true, status });
      } else {
        // We need to validate the magic code
        License.fetchLicenseAPI('validate_magic_code', { magiccode: request.magicCode }, (data) => {
          if (data && data.success === true) {
            // Not sure if we should do something with the `data`
            sendResponse({ ack: true, status });
            // Set up extension with MAB enrollment
            License.checkPingResponse(JSON.stringify({ myadblock_enrollment: true }));
            // Assume the magic link activates the license and update immediately
            License.activate(0);
          } else {
            sendResponse({ ack: false, status });
          }
        }, (err) => {
          sendResponse({ ack: false, status, error: err });
        });
      }
    }

    return true;
  },
);

const replacedPerPage = new ext.PageMap();

// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
const replacedCounts = (function getReplacedCount() {
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

      const myPage = ext.getPage(tabId);
      let replaced = replacedPerPage.get(myPage) || 0;
      replacedPerPage.set(myPage, replaced += 1);
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
  };
}());

let channels = {};
License.ready().then(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!(request.message === 'load_my_adblock')) {
      return;
    }
    if (sender.url && sender.url.startsWith('http') && getSettings().picreplacement) {
      const logError = function (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      };
      chrome.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement-image-sizes-map.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
      chrome.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
    }
    sendResponse({});
  });

  channels = new Channels();
  Object.assign(window, {
    channels,
  });
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message !== 'get_random_listing') {
      return;
    }

    const myPage = ext.getPage(sender.tab.id);
    if (checkWhitelisted(myPage) || !License.isActiveLicense()) {
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'recordOneAdReplaced') {
      sendResponse({});
      if (License.isActiveLicense()) {
        replacedCounts.recordOneAdReplaced(sender.tab.id);
      }
    }
  });

  chrome.extension.onRequest.addListener(
    (request, sender) => {
      if (request.command !== 'picreplacement_inject_jquery') {
        return;
      } // not for us
      if (sender.url && sender.url.startsWith('http') && sender.tab && sender.tab.id) {
        chrome.tabs.executeScript(sender.tab.id, { allFrames: request.allFrames, file: 'adblock-jquery.js' });
      }
    },
  );
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
