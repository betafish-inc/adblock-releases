
MigrateLegacyData = (function()
{
  var FilterNotifier = require('filterNotifier').FilterNotifier;
  var Prefs = require('prefs').Prefs;
  var migrateLogMessageKey = 'migrateLogMessageKey';
  var migrateLogMessageString = 'Date migrated: ' + new Date() + " \n";
  var migrateLog = function()
  {
    console.log.apply(console, arguments);
    var args = Array.prototype.slice.call(arguments);
    migrateLogMessageString = migrateLogMessageString + args.join(" ") + '\n';
    ext.storage.set(migrateLogMessageKey, migrateLogMessageString);
  };

  // checks the first arguements type is Boolean
  // If it is, returns it's value,
  // otherwise the default value
  var checkBooleanType = function(varToCheck, defaultValue)
  {
    if (typeof varToCheck === "boolean")
    {
      return varToCheck;
    }
    else
    {
      defaultValue;
    }
  }
  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  var storage_get = function(key)
  {
    var store = (window.SAFARI ? safari.extension.settings : localStorage);
    if (store === undefined)
    {
        return undefined;
    }
    var json = store.getItem(key);
    if (json == null) {
      return undefined;
    }
    try
    {
      return JSON.parse(json);
    } catch (e)
    {
      migrateLog("Deleting item, couldn't parse json for " + key);
      store.removeItem(key);
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // If value === undefined, removes key from storage.
  // Returns undefined.
  var storage_set = function(key, value)
  {
    var store = (window.SAFARI ? safari.extension.settings : localStorage);
    if (value === undefined)
    {
      store.removeItem(key);
      return;
    }
    try
    {
      store.setItem(key, JSON.stringify(value));
    } catch (ex) {
      migrateLog(ex);
    }
  };

  // Convert legacy AdBlock Blockage Stats to ABP
  // TODO:  When this module is removed in a future release,
  //        move the code to create "blockage_stats" to another location.
  //        the |start| property continues to be used in other modules.
  //
  function migrateLegacyBlockageStats()
  {
    var key = "blockage_stats";
    var data = storage_get(key);
    if (data)
    {
      if (data.start === undefined ||
          (typeof data.start !== 'number'))
      {
        data.start = Date.now();
      }
      if (data.version === undefined ||
          (typeof data.version !== 'number'))
      {
        data.version = 1;
      }
      if (data.total === undefined ||
          (typeof data.total !== 'number'))
      {
        data.total = 0;
      }
      // Set ABP Prefs
      Prefs.blocked_total = data.total;
      // Remove data that doesn't need to saved
      delete data.total;
      // Storge the old data in the new location
      ext.storage.set(key, data);
      // Delete the old data
      storage_set(key, undefined);
      migrateLog('migrated Legacy Blockage Stats');
    }
  }
  // Convert legacy AdBlock Stats to ABP
  function migrateLegacyStats()
  {
    var pingDelay = 1;
    var keys = ["userid", "total_pings", "next_ping_time"];
    var types = ["string", "number", "number"];

    for (var i = 0; i < keys.length; i++)
    {
      var key = keys[i];
      var data = storage_get(key);
      if (data)
      {
        // Storge the old data in the new location
        if (typeof data === types[i])
        {
          ext.storage.set(key, data);
          migrateLog('migrated Legacy data, key: ' + key + ", value: " + data);
          pingDelay = 2000;
        }
        // Delete the old data
        storage_set(key, undefined);
      }
    }
    // now that the user id has been migrated we can start the ping process
    // wait a bit to allow other function to run.
    // pingDelay is set to 1 when there is no data to be migrated (new user)
    window.setTimeout(function()
    {
      malwareList = new MalwareList();
      malwareList.init();
      STATS.startPinging();
      uninstallInit();
    }, pingDelay);
  }

  // Convert legacy AdBlock Settings to ABP
  function migrateLegacySettings()
  {
    function Old_Settings()
    {
      var defaults = {
        debug_logging: false,
        youtube_channel_whitelist: false,
        show_context_menu_items: true,
        show_advanced_options: false,
        display_stats: true,
        display_menu_stats: true,
        show_block_counts_help_link: true,
        dropbox_sync: false,
        show_survey: true,
      };
      var settings = storage_get('settings');
      if (settings)
      {
        this._data = $.extend(defaults, settings);
        this.needsMigration = true;
      }
      else
      {
        this.needsMigration = false;
      }

    };
    Old_Settings.prototype =
    {
      set: function(name, is_enabled)
      {
        this._data[name] = is_enabled;
        // Don't store defaults that the user hasn't modified
        var stored_data = storage_get("settings") || {};
        stored_data[name] = is_enabled;
        storage_set('settings', stored_data);
      },
      get_all: function()
      {
        return this._data;
      }
    };
    var old_Settings = new Old_Settings();
    Prefs.hidePlaceholders = true;
    if (old_Settings &&
        old_Settings.needsMigration)
    {
      var oldSettings = old_Settings.get_all();
      // Set ABP Prefs
      Prefs.shouldShowBlockElementMenu  = checkBooleanType(oldSettings.show_context_menu_items, true);
      Prefs.show_statsinicon = checkBooleanType(oldSettings.display_stats, true);
      Prefs.show_statsinpopup = checkBooleanType(oldSettings.display_menu_stats, true);
      // wait until the setting object is initialized, then set them
      // The setSetting is chained together to avoid clobbering the settings
      _settings.onload().then(function ()
      {
          setSetting("debug_logging", checkBooleanType(oldSettings.debug_logging, false), function() {
            setSetting("youtube_channel_whitelist", checkBooleanType(oldSettings.youtube_channel_whitelist, false), function() {
              setSetting("show_advanced_options", checkBooleanType(oldSettings.show_advanced_options, false), function() {
                setSetting("show_advanced_options", checkBooleanType(oldSettings.show_advanced_options, false), function() {
                  setSetting("show_block_counts_help_link", checkBooleanType(oldSettings.show_block_counts_help_link, true), function() {
                    setSetting("show_survey", checkBooleanType(oldSettings.show_survey, true), function() {
                      setSetting("data_collection", checkBooleanType(oldSettings.data_collection, false), function() {
                        // Delete the old data
                        storage_set('settings', undefined);
                        // re-initialize the settings with the saved values
                        migrateLog('migrated Legacy Settings');
                      });
                    });
                  });
                });
              });
            });
          });
      });
    }
  }

  // Convert legacy AdBlock FilterLists to ABP Subscriptions
  function migrateLegacyFilterLists()
  {
    var mySubs = storage_get('filter_lists');
    if (!mySubs || mySubs.length < 1)
    {
      SubscriptionInit.init();
      return;
    }

    require("subscriptionInit").setSubscriptionsCallback(function(subscriptions)
    {
      // Prevent the first run page from showing up
      Prefs.suppress_first_run_page = true;
      // Migration logic...
      // Add AdBlock FilterLists
      var subscriptions = [];
      for (var id in mySubs)
      {
        var sub = mySubs[id];
        if (sub.subscribed && sub.url && (id !== "malware"))
        {
          subscriptions.push(Subscription.fromURL(sub.url));
        }
        if (id === "malware" &&
            !sub.subscribed)
        {
          ext.storage.set("malware_list", {subscribed: false});
        }
      }
      storage_set('filter_lists', undefined);
      storage_set('last_subscriptions_check', undefined);
      migrateLog('Done migrating subscriptions.  Migrated count: ', subscriptions.length);
      SubscriptionInit.init();
      return subscriptions;
    });
  }

  // Convert user enterred, legacy AdBlock Custom Filters
  function migrateLegacyCustomFilters()
  {
    var custom = storage_get('custom_filters');
    if (!custom)
    {
      return;
    }
    var originalFilterArray = custom.split('\n');
    // Remove extra carriage returns
    originalFilterArray = originalFilterArray.filter(function(item)
    {
      return (item !== '');
    });
    custom = originalFilterArray.join('\n');
    var response = parseFilters(custom);

    if (response && response.filters)
    {
      for (var i = 0; i < response.filters.length; i++)
      {
        var filter = response.filters[i];
        if (filter)
        {
          FilterStorage.addFilter(filter);
        }
      }
      migrateLog('Migrated custom filters, count: ', response.filters.length);
    }
    if (response &&
        response.errors &&
        response.errors.length > 0)
    {
      var errorMsgs = [];
      errorMsgs.push(translate('custom_filters_migration_error_message_part1') + response.errors.length);
      errorMsgs.push(' ');
      errorMsgs.push(translate('custom_filters_migration_error_message_part2'));
      errorMsgs.push(' ');
      for (var i = 0; i < response.errors.length; i++)
      {
        var error = response.errors[i];
        if (error.lineno) {
         errorMsgs.push(translate('custom_filters_migration_error_message_part3') + originalFilterArray[(error.lineno - 1)]);
        }
        errorMsgs.push(error.toString());
        errorMsgs.push(' ');
      }
      var errorMsg = errorMsgs.join('\n');
      migrateLog(errorMsg);
      ext.storage.set('custom_filters_errors', errorMsg);
    }
    storage_set('custom_filters', undefined);
  }

  // Convert exclude / disable filters
  function migrateLegacyExcludeFilters()
  {
    var key = 'exclude_filters';
    var exclude = storage_get(key) || '';
    if (!exclude)
    {
      return;
    }
    ext.storage.set(key, exclude);
    storage_set(key, undefined);
    migrateLog('Done migrating exclude / disable filters.');
  }

  // Convert custom_filter_count
  function migrateLegacyCustomFilterCount()
  {
    var key = 'custom_filter_count';
    var customCache = storage_get(key) || '';
    if (!customCache)
    {
      return;
    }
    ext.storage.set(key, customCache);
    migrateLog('Done migrating custom filters count cache.');
    storage_set(key, undefined);
  }

  function init()
  {
    var onFilterAction = function(action)
    {
      if (action == "load")
      {
        FilterNotifier.removeListener(onFilterAction);
        filtersLoaded = true;
        migrateLegacyCustomFilters();
        migrateLegacyCustomFilterCount();
        migrateLegacyExcludeFilters();
      }
    };

    var onPrefsLoaded = function()
    {
      migrateLegacyBlockageStats();
      migrateLegacySettings();
    };

    migrateLegacyFilterLists();
    FilterNotifier.addListener(onFilterAction);
    Prefs.untilLoaded.then(onPrefsLoaded);
    migrateLegacyStats();
  }
  init();

})();