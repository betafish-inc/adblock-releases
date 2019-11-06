'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, log, chromeStorageSetHelper, logging */

const { EventEmitter } = require('events');
const { LocalCDN } = require('./localcdn');
const minjQuery = require('./jquery/jquery.min');

const settingsNotifier = new EventEmitter();
const abpPrefPropertyNames = ['show_statsinicon', 'shouldShowBlockElementMenu', 'show_statsinpopup', 'show_devtools_panel'];
const validThemes = ['default_theme', 'dark_theme', 'watermelon_theme', 'solarized_theme', 'solarized_light_theme', 'rebecca_purple_theme', 'ocean_theme', 'sunshine_theme'];

window.jQuery = minjQuery;
window.$ = minjQuery;

// OPTIONAL SETTINGS
function Settings() {
  this.settingsKey = 'settings';
  this.defaults = {
    debug_logging: false,
    youtube_channel_whitelist: false,
    show_advanced_options: false,
    show_block_counts_help_link: true,
    show_survey: true,
    local_cdn: false,
    picreplacement: false,
    twitch_hiding: false,
    color_themes: {
      popup_menu: 'default_theme',
      options_page: 'default_theme',
    },
  };
  const that = this;
  this.init = new Promise(((resolve) => {
    chrome.storage.local.get(that.settingsKey).then((response) => {
      const settings = response.settings || {};
      that.data = $.extend(that.defaults, settings);
      if (settings.debug_logging) {
        logging(true);
      }
      if (settings.local_cdn) {
        LocalCDN.start();
      }

      resolve();
    });
  })).then(() => {
    log('\n===SETTINGS FINISHED LOADING===\n\n');
  });
}

Settings.prototype = {
  set(name, isEnabled, callback) {
    const originalValue = this.data[name];
    this.data[name] = isEnabled;
    const that = this;

    // Don't store defaults that the user hasn't modified
    chrome.storage.local.get(this.settingsKey).then((response) => {
      const storedData = response.settings || {};

      storedData[name] = isEnabled;
      chromeStorageSetHelper(that.settingsKey, storedData);
      if (originalValue !== isEnabled) {
        settingsNotifier.emit('settings.changed', name, isEnabled, originalValue);
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

const settings = new Settings();
settings.onload();

const getSettings = function () {
  return settings.getAll();
};

const setSetting = function (name, isEnabled, callback) {
  settings.set(name, isEnabled, callback);

  if (name === 'debug_logging') {
    logging(isEnabled);
  }
};

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
});
