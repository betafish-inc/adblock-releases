/* eslint-disable no-console */
/* eslint-disable camelcase */

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, isEmptyObject, storageSet, getSubscriptionsMinusText, Subscription,
   filterStorage, getUrlFromId, synchronizer, DownloadableSubscription, Prefs, parseFilter,
   recordAnonymousMessage, getSettings, settings, exports, chromeStorageSetHelper */

const premiumMigration = (function exportStats() {
  // testing hint: update id below
  const adblockPremiumExtId = 'fndlhnanhedoklpdaacidomdnplcjcpj';

  const migrateLogMessageKey = 'premiumMigrateLogMessageKey';
  const storeMigrationLogs = (...args) => {
    console.log(...args);
    const timedLogMessage = `${new Date().toUTCString()}, ${args.join(' ')}`;
    const storedLog = JSON.parse(localStorage.getItem(migrateLogMessageKey) || '[]');
    while (storedLog.length > 500) { // only keep the last 500 log entries
      storedLog.shift();
    }
    storedLog.push(timedLogMessage);
    storageSet(migrateLogMessageKey, storedLog);
  };

  const migratePremiumFilterLists = (premiumFilterLists) => {
    if (typeof premiumFilterLists === 'object') {
      const currentSubs = getSubscriptionsMinusText();
      // Unsubscribe default subscriptions if not in the Premium filter lists Array
      for (const id in currentSubs) {
        if (!Object.prototype.hasOwnProperty.call(premiumFilterLists, id)) {
          const currentSub = Subscription.fromURL(currentSubs[id].url);
          filterStorage.removeSubscription(currentSub);
        }
      }
      const ignoreLegacyPremiumFilterList = [
        'disconnect_me_malvertising',
        'disconnect_me_malware',
        'disconnect_me_tracking',
      ];
      // Subscribe each Premium filter lists in Chrome if not subscribed
      for (const id in premiumFilterLists) {
        if (
          !ignoreLegacyPremiumFilterList.includes(id)
            && ((!currentSubs[id] || !currentSubs[id].subscribed))
        ) {
          let url = getUrlFromId(id);
          let subscription = Subscription.fromURL(url);
          if (!url && premiumFilterLists[id]) {
            url = premiumFilterLists[id];
            subscription = Subscription.fromURL(url);
          }
          if (!url && id.startsWith('url:')) {
            url = id.slice(4);
            subscription = Subscription.fromURL(url);
          }
          filterStorage.addSubscription(subscription);
          if (subscription instanceof DownloadableSubscription && !subscription.lastDownload) {
            synchronizer.execute(subscription);
          }
        }
      }
    }
  };

  const migratePremiumCustomFilters = (customFilters) => {
    if (typeof customFilters === 'string') {
      const customFiltersArray = customFilters.trim().split('\n');
      for (const customFilter of customFiltersArray) {
        if (customFilter.length > 0) {
          const result = parseFilter(customFilter);
          if (result.filter) {
            filterStorage.addFilter(result.filter);
          }
        }
      }
    }
  };

  const migratePremiumBlockageStats = (blockStats) => {
    // Copy total blocked count if valid type
    if (blockStats && typeof blockStats.total === 'number') {
      Prefs.blocked_total = blockStats.total;
    }
  };

  const migratePremiumSettings = (premiumSettingsParam) => {
    const premiumSettings = premiumSettingsParam;
    if (premiumSettings && !isEmptyObject(premiumSettings)) {
      const keysToRemove = ['whitelist_hulu_ads', 'sync_data'];
      const keysToRename = { data_collection: 'data_collection_v2' };
      const keysToPrefs = {
        display_stats: 'show_statsinicon',
        display_menu_stats: 'show_statsinpopup',
        show_context_menu_items: 'shouldShowBlockElementMenu',
      };

      for (const key in premiumSettings) {
        if (typeof premiumSettings[key] !== 'boolean') {
          // If invalid value remove the entry to use Chrome default values
          delete premiumSettings[key];
        } else if (keysToRemove.includes(key)) {
          // Remove if value explicitly doesn't exist in Chrome
          delete premiumSettings[key];
        } else if (Object.keys(keysToRename).includes(key)) {
          // Rename if key changed in Chrome
          premiumSettings[keysToRename[key]] = premiumSettings[key];
          delete premiumSettings[key];
        } else if (Object.keys(keysToPrefs).includes(key)) {
          // Move value from settings to Prefs
          Prefs[keysToPrefs[key]] = premiumSettings[key];
          delete premiumSettings[key];
        }
      }
      return premiumSettings;
    }
    return {};
  };

  return {
    migrateBlockageStats(data) {
      migratePremiumBlockageStats(data);
      storeMigrationLogs('Migration for Blockage Stats done.');
    },
    migrateSettings(data) {
      const premiumSettings = migratePremiumSettings(data);
      const currentSettings = getSettings();
      $.extend(currentSettings, premiumSettings);
      chromeStorageSetHelper(settings.settingsKey, currentSettings);
      storeMigrationLogs('Migration for Settings done.');
    },
    migrateCustomFilters(data) {
      migratePremiumCustomFilters(data);
      storeMigrationLogs('Migration for Custom Filters done.');
    },
    migratePremiumFilterLists(data) {
      migratePremiumFilterLists(data);
      storeMigrationLogs('Migration for Filter Lists done.');
    },
    migratePremiumData() {
      return new Promise(((resolve) => {
        const subPromise = browser.runtime.sendMessage(adblockPremiumExtId, { cmd: 'get_subscriptions' }).then((response) => {
          if (response && response.filter_lists) {
            premiumMigration.migratePremiumFilterLists(response.filter_lists);
          }
          return true;
        }, (error) => {
          storeMigrationLogs('Migration for Filter Lists failed');
          storeMigrationLogs(`${error}`);
          return false;
        });
        const settingsPromise = browser.runtime.sendMessage(adblockPremiumExtId, { cmd: 'get_settings' }).then((response) => {
          if (response && response.settings) {
            premiumMigration.migrateSettings(response.settings);
          }
          return true;
        }, (error) => {
          storeMigrationLogs('Migration for settings failed');
          storeMigrationLogs(`${error}`);
          return false;
        });
        const customPromise = browser.runtime.sendMessage(adblockPremiumExtId, { cmd: 'get_custom_rules' }).then((response) => {
          if (response && response.custom_filters) {
            premiumMigration.migrateCustomFilters(response.custom_filters);
          }
          return true;
        }, (error) => {
          storeMigrationLogs('Migration for custom rules failed');
          storeMigrationLogs(`${error}`);
          return false;
        });
        const blockCountsPromise = browser.runtime.sendMessage(adblockPremiumExtId, { cmd: 'get_blockCounts' }).then((response) => {
          if (response && response.blockCounts) {
            premiumMigration.migrateBlockageStats(response.blockCounts);
          }
          return true;
        }, (error) => {
          storeMigrationLogs('Migration for block counts failed');
          storeMigrationLogs(`${error}`);
          return false;
        });
        const promiseArr = [subPromise, settingsPromise, customPromise, blockCountsPromise];
        Promise.all(promiseArr).then((values) => {
          if (!values || values.length !== 4) {
            resolve(false);
            return;
          }
          if (Array.isArray(values)) {
            const allSuccess = values.every(x => x === true);
            resolve(allSuccess);
            return;
          }
          resolve(false);
        });
      }));
    },
    checkforLegacyAdBlockPremium(origin, sender) {
      if (origin === 'https://getadblockpremium.com') {
        // Check if AdBlock Premium is installed, if so, then migrate their settings
        browser.runtime.sendMessage(adblockPremiumExtId, { cmd: 'ping' }).then((response) => {
          if (response && response.ack === 'true') {
            premiumMigration.migratePremiumData().then((dataMigrationStatus) => {
              if (sender && sender.tab && sender.tab.id) {
                browser.tabs.sendMessage(sender.tab.id, { dataMigrationStatus });
              }
            });
          }
        }, () => {
          // do nothing, ABPr is not installed
        });
      }
    },
  };
}());

exports.premiumMigration = premiumMigration;

Object.assign(window, {
  premiumMigration,
});
