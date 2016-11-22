// OPTIONAL SETTINGS
function Settings()
{
  this._settingsKey = 'settings';
  this._defaults = {
    debug_logging : false,
    youtube_channel_whitelist : false,
    show_advanced_options : false,
    show_block_counts_help_link : true,
    show_survey : true,
  };
  var _this = this;
  this._init = new Promise(function(resolve)
  {
    ext.storage.get(_this._settingsKey, function(response)
    {
      var settings = response.settings || {};
      _this._data = $.extend(_this._defaults, settings);
      if (settings.debug_logging)
      {
        logging(true);
      }

      resolve();
    });
  });
}

Settings.prototype = {
  set : function(name, isEnabled, callback)
  {
    this._data[name] = isEnabled;
    var _this = this;

    // Don't store defaults that the user hasn't modified
    ext.storage.get(this._settingsKey, function(response)
    {
      var storedData = response.settings || {};
      storedData[name] = isEnabled;
      ext.storage.set(_this._settingsKey, storedData);
      if (callback !== undefined && typeof callback === 'function')
      {
        callback();
      }
    });
  },

  get_all : function()
  {
    return this._data;
  },

  onload : function()
  {
    return this._init;
  },

};

var _settings = new Settings();
_settings.onload();

var getSettings = function()
{
  return _settings.get_all();
};

var setSetting = function(name, isEnabled, callback)
{
  _settings.set(name, isEnabled, callback);

  if (name === 'debug_logging')
  {
    logging(isEnabled);
  }
};

var disableSetting = function(name)
{
  _settings.set(name, false);
};
