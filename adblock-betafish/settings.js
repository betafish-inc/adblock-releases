

/* For ESLint: List any global identifiers used in this file below */
/* global browser, chromeStorageSetHelper, log, logging, extend,
  isTrustedSender */

import { EventEmitter } from '../vendor/adblockplusui/adblockpluschrome/lib/events';

import * as $ from './jquery/jquery-3.5.1.min';
// export for others scripts to use
const jQuery = $;

export const settingsNotifier = new EventEmitter();
const abpPrefPropertyNames = ['show_statsinicon', 'shouldShowBlockElementMenu', 'show_devtools_panel'];
const validThemes = ['default_theme', 'dark_theme', 'watermelon_theme', 'solarized_theme', 'solarized_light_theme', 'rebecca_purple_theme', 'ocean_theme', 'sunshine_theme'];


// OPTIONAL SETTINGS
function Settings() {
  this.settingsKey = 'settings';
  this.defaults = {
    debug_logging: false,
    youtube_channel_whitelist: true,
    youtube_manage_subscribed: true,
    show_advanced_options: false,
    show_block_counts_help_link: true,
    display_menu_stats: true,
    show_survey: true,
    local_cdn: false,
    picreplacement: false,
    twitch_hiding: false,
    onpageMessages: true,
    color_themes: {
      popup_menu: 'default_theme',
      options_page: 'default_theme',
    },
  };
  const that = this;
  this.init = new Promise(((resolve) => {
    browser.storage.local.get(that.settingsKey).then((response) => {
      const settings = response.settings || {};
      that.data = extend(that.defaults, settings);
      if (settings.debug_logging) {
        logging(true);
      }
      if ('managed' in browser.storage) {
        browser.storage.managed.get(null).then((items) => {
          for (const key in items) {
            if (key === 'suppress_update_page' || key === 'suppress_surveys' || key === 'suppress_first_run_page') {
              that.data[key] = items[key];
            }
          }
          resolve();
        },
        // Opera and FF doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  })).then(() => {
    log('\n===SETTINGS FINISHED LOADING===\n\n');
  });
}

Settings.prototype = {
  set(name, isEnabled, callback) {
    const originalValue = this.data[name];
    // Firefox passes weak references to objects, so in case isEnabled is an object,
    // we need to store a local copy of the object
    const localIsEnabled = JSON.parse(JSON.stringify(isEnabled));
    this.data[name] = localIsEnabled;
    const that = this;

    // Don't store defaults that the user hasn't modified
    browser.storage.local.get(this.settingsKey).then((response) => {
      const storedData = response.settings || {};

      storedData[name] = localIsEnabled;
      chromeStorageSetHelper(that.settingsKey, storedData);
      if (originalValue !== localIsEnabled) {
        settingsNotifier.emit('settings.changed', name, localIsEnabled, originalValue);
      }
      if (callback !== undefined && typeof callback === 'function') {
        callback();
      }
    });
  },

  getAll() {
    return this.data;
  },

  onload() {
    return this.init;
  },

};

export const settings = new Settings();
settings.onload();

export const getSettings = function () {
  return settings.getAll();
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'getSettings') {
    return;
  } // not for us
  sendResponse(getSettings());
});

export const setSetting = function (name, isEnabled, callback) {
  settings.set(name, isEnabled, callback);

  if (name === 'debug_logging') {
    logging(isEnabled);
  }
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'setSetting' && message.name && message.isEnabled && isTrustedSender(sender)) {
    setSetting(message.name, message.isEnabled);
    sendResponse({});
  }
});

const disableSetting = function (name) {
  settings.set(name, false);
};

const isValidTheme = themeName => validThemes.includes(themeName);

// Attach methods to window
Object.assign(window, {
  disableSetting,
  getSettings,
  setSetting,
  settings,
  settingsNotifier,
  isValidTheme,
  abpPrefPropertyNames,
  $,
  jQuery,
});
