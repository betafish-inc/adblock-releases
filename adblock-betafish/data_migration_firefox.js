/* eslint-disable no-console */
/* eslint-disable camelcase */

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, isEmptyObject, storageSet, getSubscriptionsMinusText, Subscription,
   filterStorage, getUrlFromId, synchronizer, DownloadableSubscription, Prefs, parseFilter,
   recordAnonymousMessage, info, storageGet, storageSet, License */

const { statsInIconKey } = require('./alias/icon.js');

(() => {
  const migrateLogMessageKey = 'migrateFirefoxLogMessageKey';
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

  const reloadExtension = () => {
    setTimeout(() => {
      browser.runtime.reload();
    }, 60000); // a one minute delay to allow downloading & saving
  };

  const migrateLegacyFilterList = (id, firefoxFilterList) => {
    if (!firefoxFilterList || typeof firefoxFilterList.subscribed !== 'boolean') {
      return;
    }
    const oldToNewIDs = {
      brazilian_portuguse: 'easylist_plus_portuguese',
      swedish: 'norwegian',
      easylist_lite: 'easylist',
      easylist_plus_estonian: 'url:https://gurud.ee/ab.txt',
    };
    const filterListId = oldToNewIDs[id] ? oldToNewIDs[id] : id;
    let url = getUrlFromId(filterListId);
    let subscription = Subscription.fromURL(url);

    if (!firefoxFilterList.subscribed) {
      filterStorage.removeSubscription(subscription);
      return;
    }

    if (!url && filterListId.startsWith('url:')) {
      url = filterListId.slice(4);
      subscription = Subscription.fromURL(url);
    }
    let timeout = 1000;
    timeout *= (filterStorage.getSubscriptionCount() || 1);
    setTimeout(() => {
      filterStorage.addSubscription(subscription);
      if (subscription instanceof DownloadableSubscription && !subscription.lastDownload) {
        synchronizer.execute(subscription);
      }
    }, timeout);
  };

  const migrateLegacyCustomFilters = (firefoxCustomFilters) => {
    if (firefoxCustomFilters && typeof firefoxCustomFilters === 'string') {
      const customFiltersArray = firefoxCustomFilters.trim().split('\n');
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

  const migrateLegacyBlockageStats = (firefoxBlockageStats) => {
    let blockStats = firefoxBlockageStats;
    // Preventive approach in case at this point is not an object
    if (blockStats.constructor !== Object) {
      blockStats = {};
    }
    // If invalid start value set it to now
    if (typeof blockStats.start !== 'number') {
      blockStats.start = Date.now();
    }
    // If invalid version value set it to 1
    if (typeof blockStats.version !== 'number') {
      blockStats.version = 1;
    }
    // Copy Firefox total blocked count before deleting only if valid type
    if (typeof blockStats.total === 'number') {
      Prefs.blocked_total = blockStats.total;
    }
    delete blockStats.total; // Moved and no longer needed
    delete blockStats.malware_total; // Obsolete
    return blockStats;
  };

  // settings are stored only in browser.storage.local. Firefox doesn't have
  // any settings key that doesn't exist in Chrome. We just need to migrate a
  // few to the ABP Prefs.
  const migrateLegacySettings = (firefoxSettings) => {
    const settings = firefoxSettings;
    if (settings && !isEmptyObject(settings)) {
      const keysToPrefs = {
        display_stats: 'show_statsinicon',
        display_menu_stats: 'show_statsinpopup',
        show_context_menu_items: 'shouldShowBlockElementMenu',
      };

      for (const key in settings) {
        if (key === 'color_themes') {
          settings.color_themes = {
            popup_menu: `${settings[key].popup_menu}_theme`,
            options_page: `${settings[key].options_page}_theme`,
          };
        } else if (Object.keys(keysToPrefs).includes(key)) {
          // Move value from settings to Prefs
          Prefs[keysToPrefs[key]] = settings[key];
          delete settings[key];

          // We might have just changed the value of Pref.show_statsinicon. Therefore, if it exists,
          // we must update the stored copy in localStorage as part of the 'showIconBadgeCTA' logic
          if (key === 'display_stats' && typeof storageGet(statsInIconKey) === 'boolean') {
            storageSet(statsInIconKey, Prefs.show_statsinicon);
          }
        }
      }
      return settings;
    }
    return {};
  };

  const initMigration = (chromeStorage) => {
    const migratedData = {};
    // Firefox specific chrome.storage keys to remove. Each filter list key will be
    // added dynamically later
    const removeFromChromeStorage = [
      'custom_filters',
      'last_subscriptions_check',
      'malware-notification',
      'totalPings',
      'backup_blockcount',
    ];

    // localStorage blockage_stats
    migratedData.blockage_stats = migrateLegacyBlockageStats(storageGet('blockage_stats'));

    for (const key in chromeStorage) {
      // Migrate all filter list subscriptions
      if (key.startsWith('filter_list_')) {
        migrateLegacyFilterList(key.slice(12), chromeStorage[key]);
        storeMigrationLogs(`Migration for '${key}' done.`);
        removeFromChromeStorage.push(key);
      }

      // Migrate all the other chrome storage keys
      switch (key) {
        case 'backup_blockcount':
          // If didn't migrate from localStorage already, copy the backup
          if (!migratedData.blockage_stats) {
            migratedData.blockage_stats = migrateLegacyBlockageStats(chromeStorage[key]);
          }
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'settings':
          migratedData[key] = migrateLegacySettings(chromeStorage[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'userid':
          storageSet(`${key}_alt`, chromeStorage[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'next_ping_time':
          storageSet(`${key}_alt`, chromeStorage[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'totalPings':
          migratedData.total_pings = chromeStorage[key];
          storageSet('total_pings_alt', chromeStorage[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'custom_filters':
          migrateLegacyCustomFilters(chromeStorage[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        default:
        // Do nothing since all other keys don't need to be migrated. Some are automatically
        // migrated, some don't need to be migrated and will be removed.
      }
    }

    // Firefox specific localStorage keys to remove
    const keysToRemoveFromLocalStorage = [
      'userid',
      'totalPings',
      'next_ping_time',
      'adblock_optiontab_index',
      'blockage_stats',
    ];
    keysToRemoveFromLocalStorage.forEach(key => localStorage.removeItem(key));

    browser.storage.local.set(migratedData).then(() => {
      browser.storage.local.remove(removeFromChromeStorage).then(() => {
        storeMigrationLogs('Firefox migration finished.');
        recordAnonymousMessage('firefox_migration_finished', 'general', reloadExtension);
      });
    });
  };

  browser.storage.local.get(null).then((chromeStorage) => {
    const onFirefox = info.application === 'firefox';
    const oldFirefoxData = chromeStorage.filter_list_acceptable_ads;
    const firefoxMigrationNeeded = onFirefox && oldFirefoxData;

    if (firefoxMigrationNeeded) {
      try {
        storeMigrationLogs('Firefox migration started.');
        Prefs.untilLoaded.then(() => {
          Prefs.suppress_first_run_page = true;
          Prefs.subscriptions_addedanticv = true;
          initMigration(chromeStorage);
        });
      } catch (error) {
        storeMigrationLogs(`Firefox migration logic error: ${error}`);
        const params = JSON.stringify(error);
        recordAnonymousMessage('firefox_migration_error', 'error', undefined, params);
      }
    }
  });
})();
