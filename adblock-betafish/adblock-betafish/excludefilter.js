// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"
ExcludeFilter = (function () 
{
  var FilterNotifier = require('filterNotifier').FilterNotifier;
  var ABRemoveFilter = function (filter)
  {
    var subscriptions = filter.subscriptions.slice();
    for (var i = 0; i < subscriptions.length; i++)
    {
      var subscription = subscriptions[i];
      var positions = [];
      var index = -1;
      do
      {
        index = subscription.filters.indexOf(filter, index + 1);
        if (index >= 0)
        {
          positions.push(index);
        }
      }
      while (index >= 0);

      for (var j = positions.length - 1; j >= 0; j--)
      {
        var position = positions[j];
        if (subscription.filters[position] === filter)
        {
          subscription.filters.splice(position, 1);
          if (subscription.filters.indexOf(filter) < 0)
          {
            var index = filter.subscriptions.indexOf(subscription);
            if (index >= 0)
            {
              filter.subscriptions.splice(index, 1);
            }
          }

          FilterNotifier.triggerListeners('filter.removed', filter, subscription, position);
        }
      }
    }
  };

  // Removes the valid filters from any / all filter lists and
  // saves the valid entries
  // Note:  any invalid filters are ignored
  // Inputs: filters:string the new filters.
  var setExcludeFilters = function (excludeFilters) {
    excludeFilters = excludeFilters.trim();
    var excludeFiltersArray = excludeFilters.split('\n');
    var validExcludeFiltersArray = [];
    for (var i = 0; i < excludeFiltersArray.length; i++)
    {
      var filter = excludeFiltersArray[i];
      filter     = filter.trim();
      if (filter.length > 0)
      {
        var result = parseFilter(filter);
        if (result.filter) {
          validExcludeFiltersArray.push(result.filter);
          ABRemoveFilter(result.filter);
        }
      }
    }

    if (validExcludeFiltersArray.length > 0)
    {
      ext.storage.set('exclude_filters', validExcludeFiltersArray.join('\n'));
    } else
    {
      ext.storage.remove('exclude_filters');
    }
  };

  function excludeFilterChangeListener(action, item, param1, param2)
  {
    if (action !== 'save')
    {
      return;
    }

    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (response)
    {
      if (response[excludeFiltersKey])
      {
        var excludeFiltersArray = response[excludeFiltersKey].split('\n');
        for (var i = 0; i < excludeFiltersArray.length; i++)
        {
          var filter = excludeFiltersArray[i];
          if (filter.length > 0)
          {
            var result = parseFilter(filter);
            if (result.filter)
            {
              ABRemoveFilter(result.filter);
            }
          }
        }
      } else
      {
        FilterNotifier.removeListener(excludeFilterChangeListener);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  FilterNotifier.addListener(excludeFilterChangeListener);

  return {
    setExcludeFilters: setExcludeFilters,
  };
})();
