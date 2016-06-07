DataCollection = (function()
{

"use strict";

  var HOUR_IN_MS = 1000 * 60 * 60;

  // Setup memory cache
  var dataCollectionCache = {};

  var filterListener = function(item, newValue, oldValue, page)
  {
    if (getSettings().data_collection)
    {
      var filter = item;
      if (filter && filter.text && (typeof filter.text === 'string'))
      {
        var text = filter.text;
        var filterIds = [];
        if (filter.subscriptions && filter.subscriptions.length > 0)
        {
          filter.subscriptions.forEach(function(sub)
          {
            if (sub.url)
            {
              var id = getIdFromURL(sub.url) || 'custom';
              filterIds.push(id);
            }
          });
        }

        if (!(text in dataCollectionCache))
        {
          dataCollectionCache[text] = {};
          dataCollectionCache[text].count = 0;
          dataCollectionCache[text].ids = {};
        }

        dataCollectionCache[text].count = dataCollectionCache[text].count + 1;
        filterIds.forEach(function(id)
        {
          dataCollectionCache[text].ids[id] = 1;
        });
      }
    }
    else
    {
      FilterNotifier.removeListener(filterListener);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  _settings.onload().then(function()
  {
    if (getSettings().data_collection)
    {
      window.setInterval(function()
      {
        idleHandler.scheduleItemOnce(function()
        {
          if (getSettings().data_collection && Object.keys(dataCollectionCache).length > 0)
          {
            var data = JSON.stringify(
            {
              locale : determineUserLanguage(),
              filterStats : dataCollectionCache,
            });
            recordAnonymousMessage(data, 'filter_stats');

            // Reset memory cache
            dataCollectionCache = {};
          }
        });
      }, HOUR_IN_MS);
      FilterNotifier.on("filter.hitCount", filterListener);
    }
  });// End of then

  var returnObj = {};
  returnObj.start = function()
  {
    FilterNotifier.on("filter.hitCount", filterListener);
  };
  returnObj.end = function()
  {
    dataCollectionCache = {};
    FilterNotifier.off("filter.hitCount", filterListener);
  };
  returnObj.getCache = function()
  {
    return dataCollectionCache;
  };

  return returnObj;
})();
