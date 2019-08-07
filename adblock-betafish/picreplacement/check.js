// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.
const {checkWhitelisted} = require("whitelisting");
const {recordGeneralMessage} = require('./../servermessages').ServerMessages;
const {SyncService} = require('./sync-service');
const MY_ADBLOCK_FEATURE_VERSION = 0;
const {EventEmitter} = require("events");
let licenseNotifier = new EventEmitter();

var License = (function () {
  const isProd = true;
  var licenseStorageKey = 'license';
  var installTimestampStorageKey = 'install_timestamp';
  var myAdBlockEnrollmentFeatureKey = 'myAdBlockFeature';
  var licenseAlarmName = 'licenseAlarm';
  var theLicense = undefined;
  var oneDayInMinutes = 1140;
  var fiveMinutes = 300000;
  var initialized = false;
  var ajaxRetryCount = 0;
  var overlayMsgInProgress = false;
  var OneHourInMilliSeconds = 3600000;
  var _readyComplete;
  var _promise = new Promise(function (resolve, reject) {
      _readyComplete = resolve;
  });

  var chrome_storage_set = function (key, value, callback) {
    if (value === undefined) {
      chrome.storage.local.remove(key);
      return;
    }

    var saveData = {};
    saveData[key] = value;
    chrome.storage.local.set(saveData, callback);
  };

  const mabConfig = {
    prod: {
      licenseURL: "https://myadblock-licensing.firebaseapp.com/license/",
      syncURL: "https://myadblock.sync.getadblock.com/v1/sync",
      iframeUrl: 'https://getadblock.com/myadblock/enrollment/v3/',
      subscribeKey: "sub-c-9eccffb2-8c6a-11e9-97ab-aa54ad4b08ec"
    },
    dev: {
      licenseURL: "https://dev.myadblock.licensing.getadblock.com/license/",
      syncURL: "https://dev.myadblock.sync.getadblock.com/v1/sync",
      iframeUrl: 'http://dev.getadblock.com/myadblock/enrollment/v3/',
      subscribeKey: "sub-c-9e0a7270-83e7-11e9-99de-d6d3b84c4a25"
    },
  };
  const MAB_CONFIG = isProd ? mabConfig.prod : mabConfig.dev;


  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm && alarm.name === licenseAlarmName) {
      // At this point, no alarms exists, so
      // create an temporary alarm to avoid race condition issues
      chrome.alarms.create(licenseAlarmName, {delayInMinutes: (24 * 60)});
      License.ready().then(function() {
        License.updatePeriodically();
      });
    }
  });

  // Check if the computer was woken up, and if there was a pending alarm
  // that should fired during the sleep, then
  // remove it, and fire the update ourselves.
  // see - https://bugs.chromium.org/p/chromium/issues/detail?id=471524
  chrome.idle.onStateChanged.addListener(function(newState) {
    if (newState === 'active') {
      chrome.alarms.get(licenseAlarmName, function(alarm) {
        if (alarm && Date.now() > alarm.scheduledTime) {
          chrome.alarms.clear(licenseAlarmName, function(wasCleared){
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          var originalTime = alarm.scheduledTime;
          chrome.alarms.clear(licenseAlarmName, function(wasCleared){
            if (wasCleared) {
              chrome.alarms.create(licenseAlarmName, {when: originalTime});
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
  var loadFromStorage = function(callback) {
    chrome.storage.local.get(licenseStorageKey, function (response) {
      var localLicense = storage_get(licenseStorageKey);
      theLicense = response[licenseStorageKey] || localLicense || {};
      if (typeof callback === "function") {
        callback();
      }
    });
  };

  // Check the response from a ping to see if it contains valid show MyAdBlock enrollment instructions.
  // If so, return an object containing data
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var myAdBlockDataFrom = function(responseData) {
      if (responseData.length === 0 || responseData.trim().length === 0) {
        return null;
      }

      try {
        var pingData = JSON.parse(responseData);
        if (!pingData)
          return null;
      } catch (e) {
        console.log("Something went wrong with parsing survey data.");
        console.log('error', e);
        console.log('response data', responseData);
        return null;
      }
      return pingData;
  };


  return {
    licenseStorageKey: licenseStorageKey,
    myAdBlockEnrollmentFeatureKey: myAdBlockEnrollmentFeatureKey,
    initialized: initialized,
    licenseAlarmName: licenseAlarmName,
    licenseTimer: undefined, // the license update timer token
    licenseNotifier: licenseNotifier,
    MAB_CONFIG: MAB_CONFIG,
    isProd: isProd,
    checkPingResponse: function(pingResponseData) {
      if (pingResponseData.length === 0 || pingResponseData.trim().length === 0) {
        loadFromStorage(function() {
          if (theLicense.myadblock_enrollment === true) {
            theLicense.myadblock_enrollment = false;
            License.set(theLicense);
          }
        });
        return;
      }
      var pingData = myAdBlockDataFrom(pingResponseData);
      if (!pingData){
        return;
      }
      if (pingData.myadblock_enrollment === true) {
        loadFromStorage(function() {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
        });

        // Create myAdBlock storage if it doesn't already exist
        chrome.storage.local.get(License.myAdBlockEnrollmentFeatureKey, (myAdBlockInfo) => {
          if (!$.isEmptyObject(myAdBlockInfo)) {
            return;
          }
          var myAdBlockFeature = {
            'version': MY_ADBLOCK_FEATURE_VERSION,
            'displayPopupMenuBanner': true,
            'takeUserToMyAdBlockTab': false,
          };
          chrome.storage.local.set({ myAdBlockFeature });
        });

      }
    },
    get: function() {
      return theLicense;
    },
    set: function(newLicense) {
      if (newLicense) {
        theLicense = newLicense;
        // store in redudant locations
        chrome.storage.local.set({ 'license': theLicense });
        storage_set('license', theLicense);
      }
    },
    initialize: function(callback) {
      loadFromStorage(function() {
        if (typeof callback === "function")  {
          callback();
        }
        _readyComplete();
      });
    },
    // Get the latest license data from the server, and talk to the user if needed.
    update: function() {
      STATS.untilLoaded(function(userID)
      {
        licenseNotifier.emit("license.updating");
        var postData = {};
        postData.u = userID;
        postData.cmd = "license_check";
        var licsenseStatusBefore = License.get().status;
        // license version
        postData.v = "1";
        $.ajax({
            jsonp: false,
            url: License.MAB_CONFIG.licenseURL,
            type: 'post',
            success: function (text, status, xhr) {
                ajaxRetryCount = 0;
                var updatedLicense = {};
                if (typeof text === "object") {
                  updatedLicense = text;
                } else if (typeof text === "string") {
                  try {
                    updatedLicense = JSON.parse(text);
                  } catch (e) {
                    console.log("Something went wrong with parsing license data.");
                    console.log('error', e);
                    console.log(text)
                    return;
                  }
                }
                licenseNotifier.emit("license.updated", updatedLicense);
                if (!updatedLicense) {
                  return;
                }
                // merge the updated license
                theLicense = $.extend(theLicense, updatedLicense);
                theLicense.licenseId = theLicense.code;
                License.set(theLicense);
                // now check to see if we need to do anything because of a status change
                if (licsenseStatusBefore === "active" && updatedLicense.status && updatedLicense.status === "expired") {
                  License.processExpiredLicense();
                  recordGeneralMessage("trial_license_expired");
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                log("license server error response", xhr, textStatus, errorThrown, ajaxRetryCount);
                licenseNotifier.emit("license.updated.error", ajaxRetryCount);
                ajaxRetryCount++;
                if (ajaxRetryCount > 3) {
                  log("Retry Count exceeded, giving up", ajaxRetryCount);
                  return;
                }
                var oneMinute = 1 * 60 * 1000;
                setTimeout(function() {
                  License.updatePeriodically("error" + ajaxRetryCount);
                }, oneMinute);
            },
            data: postData
        });
      });
    },
    processExpiredLicense() {
      var theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting("picreplacement", false);
      setSetting("sync_settings", false);
      setSetting("color_themes", { popup_menu: 'default_theme', options_page: 'default_theme'});
      chrome.alarms.clear(licenseAlarmName);
    },
    ready: function () {
      return _promise;
    },
    updatePeriodically: function() {
      if (!License.isActiveLicense()) {
        return;
      }
      License.update();
      chrome.storage.local.get(installTimestampStorageKey, function (response) {
        var localTimestamp = storage_get(installTimestampStorageKey);
        var originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp || Date.now();
        // If the installation timestamp is missing from both storage locations, save an updated version
        if (!(response[installTimestampStorageKey] || localTimestamp)) {
          var install_timestamp = Date.now();
          storage_set(installTimestampStorageKey, install_timestamp);
          chrome.storage.local.set({ 'install_timestamp': install_timestamp });
        }
        var originalInstallDate = new Date(originalInstallTimestamp);
        var nextLicenseCheck = new Date();
        if (originalInstallDate.getHours() <= nextLicenseCheck.getHours())
        {
          nextLicenseCheck.setDate(nextLicenseCheck.getDate() + 1);
        }
        nextLicenseCheck.setHours(originalInstallDate.getHours());
        nextLicenseCheck.setMinutes(originalInstallDate.getMinutes());
        // we need to add 5 minutes to the 'minutes' to make sure we've allowed enought time for '1' day
        nextLicenseCheck = new Date(nextLicenseCheck.getTime() + fiveMinutes);
        chrome.alarms.create(licenseAlarmName, {when: nextLicenseCheck.getTime()});
      });
    },
    getLicenseInstallationDate: function(callback) {
      if (typeof callback !== "function") {
        return;
      }
      chrome.storage.local.get(installTimestampStorageKey, function (response) {
        var localTimestamp = storage_get(installTimestampStorageKey);
        var originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp;
        if (originalInstallTimestamp) {
          callback(new Date(originalInstallTimestamp));
        } else {
          callback(undefined);
        }
      });
    },
    // activate the current license and configure the extension in licensed mode. Call with an optional delay parameter
    // (in milliseconds) if the first license update should be delayed by a custom delay (default is 30 minutes).
    activate: function(delay) {
      let currentLicense = License.get() || {};
      currentLicense.status = "active";
      License.set(currentLicense);
      reloadOptionsPageTabs();
      if (typeof delay !== 'number') {
        delay = 30 * 60 * 1000; // 30 minutes
      }
      if (!this.licenseTimer) {
        this.licenseTimer = window.setTimeout(function () {
          License.updatePeriodically();
        }, delay);
      }
      setSetting("picreplacement", true);
    },
    isActiveLicense: function() {
      return License && License.get() && License.get().status === "active";
    },
    isMyAdBlockEnrolled: function() {
      return License && License.get() && License.get().myadblock_enrollment === true;
    },
    shouldShowMyAdBlockEnrollment: function() {
      return License.isMyAdBlockEnrolled() && !License.isActiveLicense();
    },
    // fetchLicenseAPI automates the common steps required to call the /license/api endpoint. POST bodies
    // will always automatically contain the command, license and userid so only provide the missing fields
    // in the body parameter. The ok callback handler receives the data returned by the API and the fail
    // handler receives any error information available.
    fetchLicenseAPI: function(command, body, ok, fail) {
      let licenseCode = License.get().code;
      let userID = STATS.userId();
      body.cmd = command;
      body.userid = userID;
      if (licenseCode) {
        body.license = licenseCode;
      }
      let request = new Request('https://myadblock.licensing.getadblock.com/license/api/', {
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
    // resendEmail that contains license information and a "magic link" to activate other extensions.
    // This is a workaround for MAB not being generally available so other extensions needing MAB
    // must be enrolled somehow in MAB. The license is sent to the currently registered email for the
    // original license purchase and is returned to the `ok` handler for UI display. If an error sending
    // the email occurs, the `fail` handler is called with the failure error encountered.
    resendEmail: function(ok, fail) {
      License.fetchLicenseAPI('resend_email', {}, (data) => {
        if (data && data.email) {
          ok(data.email);
        } else {
          fail();
        }
      }, (err) => {
        fail(err);
      })
    }
  };
})();

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.command === "payment_success" && request.version === 1) {
        License.activate();
        sendResponse({ ack: true });
    } else if (typeof request.magicCode === 'string') {
      // Find MAB status: justInstalled | alreadyActive
      let status = License.isMyAdBlockEnrolled() ? 'alreadyActive' : 'justInstalled';
      if (status === 'alreadyActive') {
        sendResponse({ack: true, status});
      } else {
        // We need to validate the magic code
        License.fetchLicenseAPI('validate_magic_code', {magiccode: request.magicCode}, (data) => {
          if (data && data.success === true) {
            // Not sure if we should do something with the `data`
            sendResponse({ack: true, status});
            // Set up extension with MAB enrollment
            License.checkPingResponse(JSON.stringify({myadblock_enrollment: true}));
            // Assume the magic link activates the license and update immediately
            License.activate(0);
          } else {
            sendResponse({ack: false, status});
          }
        }, (err) => {
          sendResponse({ack: false, status, error: err});
        });
      }
    }
    return true;
});

var channels = {};
License.ready().then(function() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!(request.message == "load_my_adblock")) {
      return;
    }
    if (sender.url && sender.url.startsWith("http") && getSettings().picreplacement && channels.isAnyEnabled()) {
      chrome.tabs.executeScript(sender.tab.id, {file: "adblock-picreplacement-image-sizes-map.js", frameId: sender.frameId, runAt:"document_start"}, function(){
          if (chrome.runtime.lastError) {
              log(chrome.runtime.lastError)
          }
      });
      chrome.tabs.executeScript(sender.tab.id, {file: "adblock-picreplacement.js", frameId: sender.frameId, runAt:"document_start"}, function(){
          if (chrome.runtime.lastError) {
              log(chrome.runtime.lastError)
          }
      });
    }
    sendResponse({});
  });

  channels = new Channels();
  Object.assign(window, {
    channels
  });
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message !== "get_random_listing") {
      return;
    }

    var myPage = ext.getPage(sender.tab.id);
    if (checkWhitelisted(myPage) || !License.isActiveLicense()) {
      sendResponse({ disabledOnPage: true });
      return;
    }
    var result = channels.randomListing(request.opts);
    if (result) {
      sendResponse(result);
    } else {
      // if not found, and data collection enabled, send message to log server with domain, and request
      sendResponse({ disabledOnPage: true });
    }
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'recordOneAdReplaced') {
      sendResponse({});
      if (License.isActiveLicense()) {
        replacedCounts.recordOneAdReplaced(sender.tab.id)
      }
    }
  });

  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command !== "picreplacement_inject_jquery")
        return; // not for us
      if (sender.url && sender.url.startsWith("http")) {
        chrome.tabs.executeScript(undefined,
          {allFrames: request.allFrames, file: "adblock-jquery.js"},
          function() {
            if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError)
            }
            sendResponse({});
          }
        );
      }
    }
  );

});
// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
var replacedCounts = (function() {
  var key = "replaced_stats";
  var data = storage_get(key);
  if (!data)
    data = {};
  if (data.start === undefined)
    data.start = Date.now();
  if (data.total === undefined)
    data.total = 0;
  data.version = 1;
  storage_set(key, data);

  return {
    recordOneAdReplaced: function(tabId) {
      var data = storage_get(key);
      data.total += 1;
      storage_set(key, data);

      var myPage = ext.getPage(tabId);
      let replaced = replacedPerPage.get(myPage) || 0;
      replacedPerPage.set( myPage, ++replaced);
    },
    get: function() {
      return storage_get(key);
    },
    getTotalAdsReplaced: function(tabId){
      if (tabId) {
        return replacedPerPage.get(ext.getPage(tabId));
      }
      return this.get().total;
    }
  };
})();

let replacedPerPage = new ext.PageMap();

getReplacedPerPage = page => replacedPerPage.get(page) || 0;

License.initialize(function() {
  if (!License.initialized) {
      License.initialized = true;
  }
});

Object.assign(window, {
  License,
  replacedCounts
});
