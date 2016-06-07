var uninstallInit = function()
{
  if (chrome.runtime.setUninstallURL)
  {
    var Prefs = require('prefs').Prefs;
    STATS.userIdPromise().then(function(userID)
    {
      var uninstallURL = "https://getadblock.com/uninstall/?u=" + userID;
      // if the start property of blockCount exists (which is the AdBlock
      // installation timestamp)
      // use it to calculate the approximate length of time that user has
      // AdBlock installed
      if (Prefs && Prefs.blocked_total !== undefined)
      {
        var twoMinutes = 2 * 60 * 1000;
        var getABCLastUpdateTime = function()
        {
          for ( var sub in FilterStorage.subscriptions)
          {
            var subscription = FilterStorage.subscriptions[sub];
            if (subscription.url === getUrlFromId("adblock_custom"))
            {
              return subscription._lastDownload;
            }
          }
          return null;
        };
        var updateUninstallURL = function()
        {
          ext.storage.get("blockage_stats", function(data)
          {
            var url = uninstallURL;
            if (data && data.start)
            {
              var installedDuration = (Date.now() - data.start);
              url = url + "&t=" + installedDuration;
            }
            var bc = Prefs.blocked_total;
            url = url + "&bc=" + bc;
            var lastUpdateTime = getABCLastUpdateTime();
            if (lastUpdateTime !== null)
            {
              url = url + "&abc-lt=" + lastUpdateTime;
            }
            else
            {
              url = url + "&abc-lt=-1"
            }
            chrome.runtime.setUninstallURL(url);
          });
        };
        // start an interval timer that will update the Uninstall URL every 2
        // minutes
        setInterval(updateUninstallURL, twoMinutes);
        updateUninstallURL();
      }
      else
      {
        chrome.runtime.setUninstallURL(uninstallURL + "&t=-1");
      }
    }); // end of STATS.then
  }
};
