// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.

var License = (function () {
  var licenseStorageKey = 'license';
  var installTimestampStorageKey = 'install_timestamp';
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
      if (responseData.length === 0 || responseData.trim().length === 0)
        return null;

      try {
        var pingData = JSON.parse(responseData);
        if (!pingData)
          return;
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
    initialized: initialized,
    licenseAlarmName: licenseAlarmName,
    checkPingResponse: function(pingResponseData) {
      var pingData = myAdBlockDataFrom(pingResponseData);
      if (!pingData){
        return;
      }
      if (pingData.myadblock_enrollment === true) {
        loadFromStorage(function() {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
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
        var postData = {};
        postData.u = STATS.userId();
        postData.cmd = "license_check";
        var licsenseStatusBefore = License.get().status;
        // license version
        postData.v = "1";
        $.ajax({
            jsonp: false,
            url: "https://myadblock.licensing.getadblock.com/license/",
            type: 'post',
            success: function (text, status, xhr) {
                ajaxRetryCount = 0;
                var updatedLicense = {};
                try {
                  updatedLicense = JSON.parse(text);
                } catch (e) {
                  console.log("Something went wrong with parsing license data.");
                  console.log('error', e);
                  return;
                }
                if (!updatedLicense) {
                  return;
                }
                // merge the updated license
                theLicense = $.extend(theLicense, updatedLicense);
                License.set(theLicense);
                // now check to see if we need to do anything because of a status change
                if (licsenseStatusBefore === "active" && updatedLicense.status && updatedLicense.status === "expired") {
                  License.processExpiredLicense();
                  recordGeneralMessage("trial_license_expired");
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                log("license server error response", xhr, textStatus, errorThrown, ajaxRetryCount);
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
    isActiveLicense: function() {
      return License && License.get() && License.get().status === "active";
    },
    shouldShowMyAdBlockEnrollment: function() {
      return License && License.get() && License.get().myadblock_enrollment && !License.isActiveLicense();
    }
  };
})();

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.command === "payment_success" && request.transID && request.selections && request.version === 1) {
        var currentLicense = {};
        currentLicense.status = "active";
        License.set(currentLicense);
        var delay = 30 * 60 * 1000; // 30 minutes
        window.setTimeout(function() {
          License.updatePeriodically();
        }, delay);
        setSetting("picreplacement", true);
        var guide = channels.getGuide();
        for (var id in guide) {
          if (guide[id].name === "CatsChannel") {
            channels.setEnabled(id, request.selections.cat);
          }
          if (guide[id].name === "DogsChannel") {
            channels.setEnabled(id, request.selections.dog);
          }
          if (guide[id].name === "LandscapesChannel") {
            channels.setEnabled(id, request.selections.landscape);
          }
        }
        sendResponse({ ack: true });
    }
});

var channels = {};

License.ready().then(function() {

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!(request.message == "load_my_adblock")) {
      return;
    }
    if (sender.url && sender.url.startsWith("http") && getSettings().picreplacement) {
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
      chrome.tabs.executeScript(undefined,
        {allFrames: request.allFrames, file: "adblock-jquery.js"},
        function() { sendResponse({}); }
      );
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