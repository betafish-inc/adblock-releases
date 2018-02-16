// Allows interaction with the server to track install rate
// and log messages.
STATS = (function()
{
  var userIDStorageKey = "userid";
  var totalPingStorageKey = "total_pings";
  var nextPingTimeStorageKey = "next_ping_time";
  var stats_url = "https://ping.getadblock.com/stats/";

  var FiftyFiveMinutes = 3300000;

  var dataCorrupt = false;

  // Get some information about the version, os, and browser
  var version = chrome.runtime.getManifest().version;
  var match = navigator.userAgent.match(/(CrOS\ \w+|Windows\ NT|Mac\ OS\ X|Linux)\ ([\d\._]+)?/);
  var os = (match || [])[1] || "Unknown";
  var osVersion = (match || [])[2] || "Unknown";
  var flavor;
  if (window.opr)
    flavor = "O"; // Opera
  else if (window.safari)
    flavor = "S"; // Safari
  else
    flavor = "E"; // Chrome
  if (flavor === "O")
    match = navigator.userAgent.match(/(?:OPR)\/([\d\.]+)/);
  else
    match = navigator.userAgent.match(/(?:Chrome|Version)\/([\d\.]+)/);
  var browserVersion = (match || [])[1] || "Unknown";

  var firstRun = false;

  var user_ID;

  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  var storage_get = function(key) {
    var store = localStorage;
    if (store === undefined) {
        return undefined;
    }
    key = key + "_alt";
    var json = store.getItem(key);
    if (json == null)
      return undefined;
    try {
      return JSON.parse(json);
    } catch (ex) {
      if (ex && ex.message) {
        recordErrorMessage('storage_get_error ', undefined, { errorMessage: ex.message});
      }
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  // If value === undefined, removes key from storage.
  // Returns undefined.
  var storage_set = function(key, value) {
    var store = localStorage;
    key = key + "_alt";
    if (value === undefined) {
      store.removeItem(key);
      return;
    }
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (ex) {
      dataCorrupt = true;
    }
  };

  // Give the user a userid if they don't have one yet.
  function readUserIDPromisified() {
    return new Promise(
      function (resolve, reject) {
        ext.storage.get(STATS.userIDStorageKey,
          (response) => {
            var localuserid = storage_get(STATS.userIDStorageKey);
            if (!response[STATS.userIDStorageKey] && !localuserid)
            {
              STATS.firstRun = true;
              var time_suffix = (Date.now()) % 1e8; // 8 digits from end of
                                                    // timestamp
              var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
              var result = [];
              for (var i = 0; i < 8; i++)
              {
                var choice = Math.floor(Math.random() * alphabet.length);
                result.push(alphabet[choice]);
              }
              user_ID = result.join('') + time_suffix;
              // store in redudant locations
              ext.storage.set(STATS.userIDStorageKey, user_ID);
              storage_set(STATS.userIDStorageKey, user_ID);
            }
            else
            {
              user_ID = response[STATS.userIDStorageKey] || localuserid;
              if (!response[STATS.userIDStorageKey] && localuserid)
              {
                ext.storage.set(STATS.userIDStorageKey, user_ID);
              }
              if (response[STATS.userIDStorageKey] && !localuserid)
              {
                storage_set(STATS.userIDStorageKey, user_ID);
              }
            }
            resolve(user_ID);
          });
        });
  }

  ext.onMessage.addListener(function(message, sender, sendResponse)
  {
    if (message.command !== "get_adblock_user_id")
    {
      return;
    }
    readUserIDPromisified().then(function(userID)
    {
      sendResponse(userID);
    });
    return true;
  });

  var getPingData = function(callbackFN)
  {
    if (!callbackFN && (typeof callbackFN !== 'function'))
    {
      return;
    }
    ext.storage.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(STATS.totalPingStorageKey);
      var total_pings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      var data = {
        u : user_ID,
        v : version,
        f : flavor,
        o : os,
        bv : browserVersion,
        ov : osVersion,
        ad: getSettings().show_advanced_options ? '1': '0',
        l : determineUserLanguage(),
        pc : total_pings,
        cb : getSettings().safari_content_blocking ? '1' : '0',
        dcv2 : getSettings().data_collection_v2 ? '1' : '0',
        cdn: getSettings().local_cdn ? '1' : '0',
        cdnr: LocalCDN.getRedirectCount(),
        cdnd: LocalCDN.getDataCount(),
      };
      // only on Chrome
      if (flavor === "E" && Prefs.blocked_total)
      {
        data["b"] = Prefs.blocked_total;
      }
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      var subs = getAllSubscriptionsMinusText();
      if (subs["acceptable_ads"])
      {
        data["aa"] = subs["acceptable_ads"].subscribed ? '1' : '0';
      }
      else
      {
        data["aa"] = 'u';
      }
      data["dc"] = dataCorrupt ? '1' : '0';
      SURVEY.types(function(response)
      {
          data["st"] = response;
          callbackFN(data);
      });
    });
  };
  // Tell the server we exist.
  var pingNow = function()
  {
    getPingData(function(data)
    {
      if (!data.u)
      {
        return;
      }
      // attempt to stop users that are pinging us 'alot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (data.pc > 5000)
      {
        if (data.pc > 5000 && data.pc < 100000 && ((data.pc % 5000) !== 0))
        {
          return;
        }
        if (data.pc >= 100000 && ((data.pc % 50000) !== 0))
        {
          return;
        }
      }
      data["cmd"] = 'ping';
      var ajaxOptions = {
        type : 'POST',
        url : stats_url,
        data : data,
        success : handlePingResponse, // TODO: Remove when we no longer do a/b
                                      // tests
        error : function(e)
        {
          console.log("Ping returned error: ", e.status);
        },
      };

      if (chrome.management && chrome.management.getSelf)
      {
        chrome.management.getSelf(function(info)
        {
          data["it"] = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      }
      else
      {
        $.ajax(ajaxOptions);
      }

      // send Local CDN missed versions stats as well
      recordGeneralMessage("cdn_miss_stats", undefined, {"cdnm": LocalCDN.getMissedVersions()});
    });
  };

  var handlePingResponse = function(responseData, textStatus, jqXHR)
  {
    SURVEY.maybeSurvey(responseData);
  };

  // Called just after we ping the server, to schedule our next ping.
  var scheduleNextPing = function()
  {
    ext.storage.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(totalPingStorageKey);
      localTotalPings = isNaN(localTotalPings) ? 0 : localTotalPings;
      var total_pings = response[STATS.totalPingStorageKey]
      total_pings = isNaN(total_pings) ? 0 : total_pings;
      total_pings = Math.max(localTotalPings, total_pings);
      total_pings += 1;
      // store in redudant locations
      ext.storage.set(STATS.totalPingStorageKey, total_pings);
      storage_set(STATS.totalPingStorageKey, total_pings);

      var delay_hours;
      if (total_pings == 1) // Ping one hour after install
        delay_hours = 1;
      else if (total_pings < 9) // Then every day for a week
        delay_hours = 24;
      else
        // Then weekly forever
        delay_hours = 24 * 7;

      var millis = 1000 * 60 * 60 * delay_hours;
      var nextPingTime = Date.now() + millis;

      // store in redudant location
      ext.storage.set(STATS.nextPingTimeStorageKey, nextPingTime, function()
      {
        if (chrome.runtime.lastError)
        {
          dataCorrupt = true;
        }
        else
        {
          dataCorrupt = false;
        }
      });
      storage_set(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  var millisTillNextPing = function(callbackFN)
  {
    if (!callbackFN || (typeof callbackFN !== 'function'))
    {
      return;
    }
    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (dataCorrupt)
    {
      callbackFN(FiftyFiveMinutes);
      return;
    }
    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(function()
    {
      ext.storage.get(STATS.nextPingTimeStorageKey, function(response)
      {
        var local_next_ping_time = storage_get(STATS.nextPingTimeStorageKey);
        local_next_ping_time = isNaN(local_next_ping_time) ? 0 : local_next_ping_time;
        var next_ping_time = isNaN(response[STATS.nextPingTimeStorageKey]) ? 0 : response[STATS.nextPingTimeStorageKey];
        next_ping_time = Math.max(local_next_ping_time, next_ping_time);
        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (next_ping_time === 0 && STATS.firstRun)
        {
          callbackFN(0);
          return;
        }
        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (next_ping_time === 0 || isNaN(next_ping_time))
        {
          callbackFN(FiftyFiveMinutes);
          return;
        }
        callbackFN(next_ping_time - Date.now());
      }); // end of get
    }, 10000);
  };

  // Used to rate limit .message()s. Rate limits reset at startup.
  var throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    max_events_per_hour : 3, // null if no limit
    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt : function()
    {
      var now = Date.now(), one_hour = 1000 * 60 * 60;
      var times = this._event_times, mph = this.max_events_per_hour;
      // Discard old or irrelevant events
      while (times[0] && (times[0] + one_hour < now || mph === null))
        times.shift();
      if (mph === null)
        return true; // no limit
      if (times.length >= mph)
        return false; // used our quota this hour
      times.push(now);
      return true;
    },
    _event_times : []
  };

  return {
    userIDStorageKey : userIDStorageKey,
    totalPingStorageKey : totalPingStorageKey,
    nextPingTimeStorageKey : nextPingTimeStorageKey,
    // True if AdBlock was just installed.
    firstRun : firstRun,
    userId : function()
    {
      return user_ID;
    },
    version : version,
    flavor : flavor,
    browser : ({
      O : "Opera",
      S : "Safari",
      E : "Chrome"
    })[flavor],
    browserVersion : browserVersion,
    os : os,
    osVersion : osVersion,
    pingNow : pingNow,
    statsUrl : stats_url,
    untilLoaded : function(callback)
    {
      readUserIDPromisified().then(function(userID) {
        if (typeof callback === 'function')
        {
          callback(userID);
        }
      });
    },
    // Ping the server when necessary.
    startPinging : function()
    {
      function sleepThenPing()
      {
        millisTillNextPing(function(delay)
        {
          window.setTimeout(function()
          {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      };

      readUserIDPromisified().then(function(userID)
      {
        // Do 'stuff' when we're first installed...
        // - send a message
        ext.storage.get(STATS.totalPingStorageKey, function(response)
        {
          if (!response[STATS.totalPingStorageKey])
          {
            if (chrome.management && chrome.management.getSelf)
            {
              chrome.management.getSelf(function(info)
              {
                if (info)
                {
                  recordGeneralMessage('new_install_' + info.installType);
                }
                else
                {
                  recordGeneralMessage('new_install');
                }
              });
            }
            else
            {
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
    msg : function(message)
    {
      if (!throttle.attempt())
      {
        log("Rate limited:", message);
        return;
      }
      var data = {
        cmd : "msg2",
        m : message,
        u : user_ID,
        v : version,
        fr : firstRun,
        f : flavor,
        bv : browserVersion,
        o : os,
        ov : osVersion
      };
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      $.ajax(stats_url, {
        type : "POST",
        data : data,
        complete : function(xhr)
        {
          var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"), 10);
          if (isNaN(mph) || mph < -1) // Server is sick
            mph = 1;
          if (mph === -1)
            mph = null; // no rate limit
          throttle.max_events_per_hour = mph;
        }
      });
    }
  };

})();
