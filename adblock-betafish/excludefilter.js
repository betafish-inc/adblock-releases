// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"
ExcludeFilter = (function ()
{
  var ABRemoveFilter = function (filter)
  {
    for (let currentSubscription of filter.subscriptions())
    {
      let positions = [];
      let index = -1;
      do
      {
        index = currentSubscription.searchFilter(filter, index + 1);
        if (index >= 0) {
          positions.push(index);
        }
      } while (index >= 0);

      for (let j = positions.length - 1; j >= 0; j--)
      {
        let currentPosition = positions[j];
        let currentFilter = currentSubscription.filterAt(currentPosition);
        if (currentFilter && currentFilter.text == filter.text)
        {
          currentSubscription.deleteFilterAt(currentPosition);
          if (currentSubscription.searchFilter(filter) < 0)
            filter.removeSubscription(currentSubscription);
          filterNotifier.emit("filter.removed", filter, currentSubscription,
                              currentPosition);
        }
      }
    }



    for (let subscription of filter.subscriptions())
    {
      var positions = [];
      var index = -1;
      do
      {
        index = subscription._filterText.indexOf(filter, index + 1);
        if (index >= 0)
        {
          positions.push(index);
        }
      }
      while (index >= 0);

      for (var j = positions.length - 1; j >= 0; j--)
      {
        var position = positions[j];
        if (subscription._filterText[position] === filter)
        {
          subscription._filterText.splice(position, 1);
          if (subscription._filterText.indexOf(filter) < 0)
          {
            var index = filter._subscriptions.indexOf(subscription);
            if (index >= 0)
            {
              filter._subscriptions.splice(index, 1);
            }
          }
          filterNotifier.emit("filter.removed", filter, currentSubscription, currentPosition);
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
      chromeStorageSetHelper('exclude_filters', validExcludeFiltersArray.join('\n'));
    } else
    {
      chrome.storage.local.remove('exclude_filters');
    }
  };

  function excludeFilterChangeListener(action, item, param1, param2)
  {
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey).then((response) =>
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
        filterNotifier.off("save", excludeFilterChangeListener);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  filterNotifier.on("save", excludeFilterChangeListener);

  return {
    setExcludeFilters: setExcludeFilters,
  };
})();
