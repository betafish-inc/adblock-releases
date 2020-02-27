/* eslint-disable no-console */
/* eslint-disable camelcase */

'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, isEmptyObject, storageSet, getSubscriptionsMinusText, Subscription,
   filterStorage, getUrlFromId, synchronizer, DownloadableSubscription, Prefs, parseFilter,
   recordAnonymousMessage */

(() => {
  const migrateLogMessageKey = 'migrateLogMessageKey';
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
    browser.runtime.reload();
  };

  // Works for all |input| that are not 'stringified' or stringified' once or twice
  const parse = (input) => {
    try {
      // |input| is double 'stringified'
      return JSON.parse(JSON.parse(input));
    } catch (e) {
      // |input| is not double 'stringified'
      try {
        // |input| is 'stringified' once
        return JSON.parse(input);
      } catch (err) {
        // |input| is not 'stringified' so return it unparsed
        return input;
      }
    }
  };

  const migrateLegacyFilterLists = (edgeFilterLists) => {
    const myEdgeSubsParsed = parse(edgeFilterLists);
    // If we got an Array of Edge filter lists IDs
    if (myEdgeSubsParsed && myEdgeSubsParsed.constructor === Array) {
      const currentSubs = getSubscriptionsMinusText();
      // Unsubscribe default subscriptions if not in the Edge filter lists Array
      for (const id in currentSubs) {
        if (!myEdgeSubsParsed.includes(id)) {
          const currentSub = Subscription.fromURL(currentSubs[id].url);
          filterStorage.removeSubscription(currentSub);
        }
      }
      // Subscribe each Edge filter lists in Chrome if not alreayd subscribed
      for (const id of myEdgeSubsParsed) {
        const changeEdgeIDs = {
          swedish: 'norwegian',
          easylist_lite: 'easylist',
          easylist_plus_estonian: 'url:https://gurud.ee/ab.txt',
        };
        if ((!currentSubs[id] || !currentSubs[id].subscribed)) {
          const filterListId = changeEdgeIDs[id] ? changeEdgeIDs[id] : id;
          let url = getUrlFromId(filterListId);
          let subscription = Subscription.fromURL(url);
          if (!url && filterListId.startsWith('url:')) {
            url = filterListId.slice(4);
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

  const migrateLegacyCustomFilters = (edgeCustomFilters) => {
    const customFiltersParsed = parse(edgeCustomFilters);
    if (customFiltersParsed && typeof customFiltersParsed === 'string') {
      const customFiltersArray = customFiltersParsed.trim().split('\n');
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

  const migrateLegacyCustomFilterCount = (edgeCustomFilterCount) => {
    const customFilterCountParsed = parse(edgeCustomFilterCount);
    if (
      customFilterCountParsed
      && customFilterCountParsed.constructor === Object
      && customFilterCountParsed !== edgeCustomFilterCount
    ) {
      return customFilterCountParsed;
    }
    return {};
  };

  const migrateLegacyExcludeFilters = (edgeExcludeFilters) => {
    const parsedExcludeFitlers = parse(edgeExcludeFilters);
    if (parsedExcludeFitlers !== edgeExcludeFilters && typeof parsedExcludeFitlers === 'string') {
      return parsedExcludeFitlers;
    }
    return '';
  };

  const migrateLegacyBlockageStats = (edgeBlockageStats) => {
    let blockStats = parse(edgeBlockageStats);
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
    // Copy Edge total blocked count before deleting only if valid type
    if (typeof blockStats.total === 'number') {
      Prefs.blocked_total = blockStats.total;
    }
    delete blockStats.total; // Moved and no longer needed
    delete blockStats.malware_total; // Obsolete
    return blockStats;
  };

  // settings are stored only in browser.storage.local in both Edge and Chrome
  // No localStorage logic necessary here
  const migrateLegacySettings = (edgeSettings) => {
    // Parse data to cover all basis from Chromium odd migration of data formatting
    const settings = parse(edgeSettings);

    if (settings && !isEmptyObject(settings)) {
      const keysToRemove = ['whitelist_hulu_ads', 'show_language_selector'];
      const keysToRename = { data_collection: 'data_collection_v2' };
      const keysToPrefs = {
        display_stats: 'show_statsinicon',
        display_menu_stats: 'show_statsinpopup',
        show_context_menu_items: 'shouldShowBlockElementMenu',
      };

      for (const key in settings) {
        if (typeof settings[key] !== 'boolean') {
          // If invalid value remove the entry to use Chrome default values
          delete settings[key];
        } else if (keysToRemove.includes(key)) {
          // Remove if value explicitly doesn't exist in Chrome
          delete settings[key];
        } else if (Object.keys(keysToRename).includes(key)) {
          // Rename if key changed in Chrome
          settings[keysToRename[key]] = settings[key];
          delete settings[key];
        } else if (Object.keys(keysToPrefs).includes(key)) {
          // Move value from settings to Prefs
          Prefs[keysToPrefs[key]] = settings[key];
          delete settings[key];
        }
      }
      return settings;
    }
    return {};
  };

  // userid, total_pings, next_ping_time
  const migrateLegacyStats = (key, value) => {
    const suffix = '_alt';
    if (key === 'userid') {
      const parsedUserId = parse(value);
      if (typeof parsedUserId === 'string') {
        storageSet(`${key}${suffix}`, parsedUserId);
        return parsedUserId;
      }
    } else {
      const parsedValue = parse(value);
      if (typeof parsedValue === 'number') {
        storageSet(`${key}${suffix}`, parsedValue);
        return parsedValue;
      }
    }
    return key === 'userid' ? '' : 0; // Default values if value type is invalid
  };

  const migrateLastKnownVersion = (key, originalLastKnownVersion) => {
    const versionParsed = parse(originalLastKnownVersion);
    if (versionParsed && typeof versionParsed === 'string') {
      storageSet(key, versionParsed);
    }
  };

  const initMigration = (currentData) => {
    const migratedData = {};

    // Modify or remove data for keys that are in Edge or in both Edge and Chrome
    for (const key in currentData) {
      switch (key) {
        case 'custom_filter_count':
          migratedData[key] = migrateLegacyCustomFilterCount(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'exclude_filters':
          migratedData[key] = migrateLegacyExcludeFilters(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'blockage_stats':
          migratedData[key] = migrateLegacyBlockageStats(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'settings':
          migratedData[key] = migrateLegacySettings(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'userid':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'total_pings':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'next_ping_time':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'custom_filters':
          migrateLegacyCustomFilters(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'subscribed_filter_lists':
          migrateLegacyFilterLists(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'last_known_version':
          migrateLastKnownVersion(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        default:
          // Do nothing since all other keys don't need to be migrated because they
          // are either only in Chrome or they are useless and should be removed
      }
    }

    // Edge specific keys deemed useless at this point
    const removeAfterMigration = [
      'filter_lists',
      'custom_filters',
      'last_known_version',
      'subscribed_filter_lists',
      'last_subscriptions_check',
      'malware-notification',
    ];

    browser.storage.local.set(migratedData).then(() => {
      browser.storage.local.remove(removeAfterMigration).then(() => {
        storeMigrationLogs('migration finished.');
        recordAnonymousMessage('cm_migration_finished', 'general', reloadExtension);
      });
    });
  };

  browser.storage.local.get(null).then((currentData) => {
    const edgeMigrationNeeded = currentData.filter_lists;
    if (edgeMigrationNeeded) {
      try {
        storeMigrationLogs('Migration started.');
        Prefs.untilLoaded.then(() => {
          Prefs.suppress_first_run_page = true;
          Prefs.subscriptions_addedanticv = true;
          initMigration(currentData);
        });
      } catch (error) {
        storeMigrationLogs(`Migration logic error: ${error}`);
      }
    }
  });
})();
