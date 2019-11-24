// Allows interaction with the server to track install rate
// and log messages.

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, exports, require, log, getSettings, determineUserLanguage,
   replacedCounts, chromeStorageSetHelper, getAllSubscriptionsMinusText,
   checkPingResponseForProtect, License, channels */

const { Prefs } = require('prefs');
const { LocalCDN } = require('./localcdn');
const { SURVEY } = require('./survey');
const { recordGeneralMessage, recordErrorMessage } = require('./servermessages').ServerMessages;

const STATS = (function exportStats() {
  const userIDStorageKey = 'userid';
  const totalPingStorageKey = 'total_pings';
  const nextPingTimeStorageKey = 'next_ping_time';
  const statsUrl = 'https://ping.getadblock.com/stats/';
  const FiftyFiveMinutes = 3300000;
  let dataCorrupt = false;

  // Get some information about the version, os, and browser
  const { version } = chrome.runtime.getManifest();
  let match = navigator.userAgent.match(/(CrOS \w+|Windows NT|Mac OS X|Linux) ([\d._]+)?/);
  const os = (match || [])[1] || 'Unknown';
  const osVersion = (match || [])[2] || 'Unknown';
  let flavor = 'E'; // Chrome
  match = navigator.userAgent.match(/(?:Chrome|Version)\/([\d.]+)/);
  const edgeMatch = navigator.userAgent.match(/(?:Edg|Version)\/([\d.]+)/);
  if (edgeMatch) { // null in Chrome browsers
    flavor = 'M'; // MS - Edge
    match = edgeMatch;
  }
  const browserVersion = (match || [])[1] || 'Unknown';

  const firstRun = false;

  let userID;

  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  const storageGet = function (key) {
    const storageKey = `${key}_alt`;
    const store = localStorage;
    if (store === undefined) {
      return undefined;
    }
    const json = store.getItem(storageKey);
    if (json == null) {
      return undefined;
    }
    try {
      return JSON.parse(json);
    } catch (ex) {
      if (ex && ex.message) {
        recordErrorMessage('storage_get_error ', undefined, { errorMessage: ex.message });
      }
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  // If value === undefined, removes key from storage.
  // Returns undefined.
  const storageSet = function (key, value) {
    const storageKey = `${key}_alt`;
    const store = localStorage;

    if (value === undefined) {
      store.removeItem(storageKey);
      return;
    }
    try {
      store.setItem(storageKey, JSON.stringify(value));
    } catch (ex) {
      dataCorrupt = true;
    }
  };

  // Give the user a userid if they don't have one yet.
  function readUserIDPromisified() {
    return new Promise(
      ((resolve) => {
        chrome.storage.local.get(STATS.userIDStorageKey).then((response) => {
          const localuserid = storageGet(STATS.userIDStorageKey);
          if (!response[STATS.userIDStorageKey] && !localuserid) {
            STATS.firstRun = true;
            const timeSuffix = (Date.now()) % 1e8; // 8 digits from end of
            // timestamp
            const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
            const result = [];
            for (let i = 0; i < 8; i++) {
              const choice = Math.floor(Math.random() * alphabet.length);
              result.push(alphabet[choice]);
            }
            userID = result.join('') + timeSuffix;
            // store in redundant locations
            chromeStorageSetHelper(STATS.userIDStorageKey, userID);
            storageSet(STATS.userIDStorageKey, userID);
          } else {
            userID = response[STATS.userIDStorageKey] || localuserid;
            if (!response[STATS.userIDStorageKey] && localuserid) {
              chromeStorageSetHelper(STATS.userIDStorageKey, userID);
            }
            if (response[STATS.userIDStorageKey] && !localuserid) {
              storageSet(STATS.userIDStorageKey, userID);
            }
          }
          resolve(userID);
        });
      }),
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.command !== 'get_adblock_user_id') {
      return undefined;
    }
    readUserIDPromisified().then((resolvedUserID) => {
      sendResponse(resolvedUserID);
    });
    return true;
  });

  const getPingData = function (callbackFN) {
    if (!callbackFN && (typeof callbackFN !== 'function')) {
      return;
    }
    chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
      const settingsObj = getSettings();
      const localTotalPings = storageGet(STATS.totalPingStorageKey);
      const totalPings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      const themeOptionsPage = settingsObj.color_themes.options_page.replace('_theme', '');
      const themePopupMenu = settingsObj.color_themes.popup_menu.replace('_theme', '');
      const data = {
        u: userID,
        v: version,
        f: flavor,
        o: os,
        bv: browserVersion,
        ov: osVersion,
        ad: settingsObj.show_advanced_options ? '1' : '0',
        yt: settingsObj.youtube_channel_whitelist ? '1' : '0',
        l: determineUserLanguage(),
        pc: totalPings,
        dcv2: settingsObj.data_collection_v2 ? '1' : '0',
        cdn: settingsObj.local_cdn ? '1' : '0',
        cdnr: LocalCDN.getRedirectCount(),
        cdnd: LocalCDN.getDataCount(),
        rc: replacedCounts.getTotalAdsReplaced(),
        to: themeOptionsPage,
        tm: themePopupMenu,
        sy: settingsObj.sync_settings ? '1' : '0',
        ir: channels.isAnyEnabled() ? '1' : '0',
        twh: settingsObj.twitch_hiding ? '1' : '0',
      };

      // only on Chrome
      if (flavor === 'E' && Prefs.blocked_total) {
        data.b = Prefs.blocked_total;
      }
      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }
      const subs = getAllSubscriptionsMinusText();
      if (subs) {
        const aa = subs.acceptable_ads;
        const aaPrivacy = subs.acceptable_ads_privacy;

        if (!aa && !aaPrivacy) {
          data.aa = 'u'; // Both filter lists unavailable
        } else if (aa.subscribed) {
          data.aa = '1';
        } else if (aaPrivacy.subscribed) {
          data.aa = '2';
        } else if (!aa.subscribed && !aaPrivacy.subscribed) {
          data.aa = '0'; // Both filter lists unsubscribed
        }
      }

      data.dc = dataCorrupt ? '1' : '0';
      SURVEY.types((res) => {
        data.st = res;
        callbackFN(data);
      });
    });
  };
  // Tell the server we exist.
  const pingNow = function () {
    const handlePingResponse = function (responseData) {
      SURVEY.maybeSurvey(responseData);
      checkPingResponseForProtect(responseData);
    };

    getPingData((data) => {
      const pingData = data;

      if (!pingData.u) {
        return;
      }
      // attempt to stop users that are pinging us 'alot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (pingData.pc > 5000) {
        if (pingData.pc > 5000 && pingData.pc < 100000 && ((pingData.pc % 5000) !== 0)) {
          return;
        }
        if (pingData.pc >= 100000 && ((pingData.pc % 50000) !== 0)) {
          return;
        }
      }
      pingData.cmd = 'ping';
      const ajaxOptions = {
        type: 'POST',
        url: statsUrl,
        data: pingData,
        success: handlePingResponse, // TODO: Remove when we no longer do a/b
        // tests
        error(e) {
          // eslint-disable-next-line no-console
          console.log('Ping returned error: ', e.status);
        },
      };

      if (chrome.management && chrome.management.getSelf) {
        chrome.management.getSelf((info) => {
          pingData.it = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      } else {
        $.ajax(ajaxOptions);
      }

      const missedVersions = LocalCDN.getMissedVersions();
      if (missedVersions) {
        recordGeneralMessage('cdn_miss_stats', undefined, { cdnm: missedVersions });
      }
    });
  };

  // Called just after we ping the server, to schedule our next ping.
  const scheduleNextPing = function () {
    chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
      let localTotalPings = storageGet(totalPingStorageKey);
      if (typeof localTotalPings !== 'number' || Number.isNaN(localTotalPings)) {
        localTotalPings = 0;
      }
      let totalPings = response[STATS.totalPingStorageKey];
      if (typeof totalPings !== 'number' || Number.isNaN(totalPings)) {
        totalPings = 0;
      }
      totalPings = Math.max(localTotalPings, totalPings);
      totalPings += 1;
      // store in redundant locations
      chromeStorageSetHelper(STATS.totalPingStorageKey, totalPings);
      storageSet(STATS.totalPingStorageKey, totalPings);

      let delayHours;
      if (totalPings === 1) { // Ping one hour after install
        delayHours = 1;
      } else if (totalPings < 9) { // Then every day for a week
        delayHours = 24;
      } else { // Then weekly forever
        delayHours = 24 * 7;
      }

      const millis = 1000 * 60 * 60 * delayHours;
      const nextPingTime = Date.now() + millis;

      // store in redundant location
      chromeStorageSetHelper(STATS.nextPingTimeStorageKey, nextPingTime, (error) => {
        if (error) {
          dataCorrupt = true;
        } else {
          dataCorrupt = false;
        }
      });
      storageSet(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  const millisTillNextPing = function (callbackFN) {
    if (!callbackFN || (typeof callbackFN !== 'function')) {
      return;
    }
    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (dataCorrupt) {
      callbackFN(FiftyFiveMinutes);
      return;
    }
    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(() => {
      chrome.storage.local.get(STATS.nextPingTimeStorageKey).then((response) => {
        let localNextPingTime = storageGet(STATS.nextPingTimeStorageKey);
        if (typeof localNextPingTime !== 'number' || Number.isNaN(localNextPingTime)) {
          localNextPingTime = 0;
        }
        let nextPingTimeStored = response[STATS.nextPingTimeStorageKey];
        if (typeof nextPingTimeStored !== 'number' || Number.isNaN(nextPingTimeStored)) {
          nextPingTimeStored = 0;
        }
        const nextPingTime = Math.max(localNextPingTime, nextPingTimeStored);
        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (nextPingTime === 0 && STATS.firstRun) {
          callbackFN(0);
          return;
        }
        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (
          typeof nextPingTime !== 'number'
          || nextPingTime === 0
          || Number.isNaN(nextPingTime)
        ) {
          callbackFN(FiftyFiveMinutes);
          return;
        }
        callbackFN(nextPingTime - Date.now());
      }); // end of get
    }, 10000);
  };

  // Used to rate limit .message()s. Rate limits reset at startup.
  const throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    maxEventsPerHour: 3, // null if no limit
    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt() {
      const now = Date.now();
      const oneHour = 1000 * 60 * 60;
      const times = this.eventTimes;
      const mph = this.maxEventsPerHour;
      // Discard old or irrelevant events
      while (times[0] && (times[0] + oneHour < now || mph === null)) {
        times.shift();
      }
      if (mph === null) {
        return true;
      } // no limit
      if (times.length >= mph) {
        return false;
      } // used our quota this hour
      times.push(now);
      return true;
    },
    eventTimes: [],
  };

  return {
    userIDStorageKey,
    totalPingStorageKey,
    nextPingTimeStorageKey,
    firstRun, // True if AdBlock was just installed.
    userId() {
      return userID;
    },
    version,
    flavor,
    browser: ({
      E: 'Chrome',
    })[flavor],
    browserVersion,
    os,
    osVersion,
    pingNow,
    statsUrl,
    untilLoaded(callback) {
      readUserIDPromisified().then((resUserId) => {
        if (typeof callback === 'function') {
          callback(resUserId);
        }
      });
    },
    // Ping the server when necessary.
    startPinging() {
      function sleepThenPing() {
        millisTillNextPing((delay) => {
          window.setTimeout(() => {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      }

      readUserIDPromisified().then(() => {
        // Do 'stuff' when we're first installed...
        // - send a message
        chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
          if (!response[STATS.totalPingStorageKey]) {
            if (chrome.management && chrome.management.getSelf) {
              chrome.management.getSelf((info) => {
                if (info) {
                  recordGeneralMessage(`new_install_${info.installType}`);
                } else {
                  recordGeneralMessage('new_install');
                }
              });
            } else {
              recordGeneralMessage('new_install');
            }
          }
        });
      });
      // This will sleep, then ping, then schedule a new ping, then
      // call itself to start the process over again.
      sleepThenPing();
    },

    // Record some data, if we are not rate limited.
    msg(message) {
      if (!throttle.attempt()) {
        log('Rate limited:', message);
        return;
      }
      const data = {
        cmd: 'msg2',
        m: message,
        u: userID,
        v: version,
        fr: firstRun,
        f: flavor,
        bv: browserVersion,
        o: os,
        ov: osVersion,
      };
      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }
      $.ajax(statsUrl, {
        type: 'POST',
        data,
        complete(xhr) {
          let mph = parseInt(xhr.getResponseHeader('X-RateLimit-MPH'), 10);
          if (typeof mph !== 'number' || Number.isNaN(mph) || mph < -1) { // Server is sick
            mph = 1;
          }
          if (mph === -1) {
            mph = null;
          } // no rate limit
          throttle.maxEventsPerHour = mph;
        },
      });
    },
  };
}());

exports.STATS = STATS;
