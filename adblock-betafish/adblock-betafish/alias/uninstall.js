/** @module uninstall */
/** similar to adblockpluschrome\lib\uninstall.js */

import { Prefs } from 'prefs';
import SubscriptionAdapter from '../subscriptionadapter';
import { TELEMETRY } from '../telemetry';

export function setUninstallURL() {
  if (browser.runtime.setUninstallURL) {
    TELEMETRY.untilLoaded(function (userID) {
      let uninstallURL = "https://getadblock.com/uninstall/?u=" + userID;
      // if the start property of blockCount exists (which is the AdBlock
      // installation timestamp)
      // use it to calculate the approximate length of time that user has
      // AdBlock installed
      if (Prefs && Prefs.blocked_total !== undefined) {
        let twoMinutes = 2 * 60 * 1000;
        let getABCLastUpdateTime = function () {
          const userSubs = SubscriptionAdapter.getAllSubscriptionsMinusText();
          if (userSubs["adblock_custom"] && userSubs["adblock_custom"].lastDownload) {
            return userSubs["adblock_custom"].lastDownload;
          }
          return null;
        };
        let updateUninstallURL = function () {
          browser.storage.local.get("blockage_stats").then(data => {
            let url = uninstallURL;
            if (data && data.blockage_stats && data.blockage_stats.start) {
              let installedDuration = Date.now() - data.blockage_stats.start;
              url = url + "&t=" + installedDuration;
            }
            let bc = Prefs.blocked_total;
            url = url + "&bc=" + bc;
            let lastUpdateTime = getABCLastUpdateTime();
            if (lastUpdateTime !== null) {
              url = url + "&abc-lt=" + lastUpdateTime;
            } else {
              url = url + "&abc-lt=-1";
            }
            browser.runtime.setUninstallURL(url);
          });
        };
        // start an interval timer that will update the Uninstall URL every 2
        // minutes
        setInterval(updateUninstallURL, twoMinutes);
        updateUninstallURL();
      } else {
        browser.runtime.setUninstallURL(uninstallURL + "&t=-1");
      }
    }); // end of TELEMETRY.untilLoaded
  }
};

