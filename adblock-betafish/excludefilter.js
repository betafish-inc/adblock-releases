'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, exports, parseFilter, chromeStorageSetHelper */

// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"

const { filterNotifier } = require('filterNotifier');
const { filterStorage } = require('filterStorage');

const ExcludeFilter = (function excludeFilter() {
  const ABRemoveFilter = function (filter) {
    for (const currentSubscription of filterStorage.subscriptions()) {
      const positions = [];
      let index = -1;
      do {
        index = currentSubscription.findFilterIndex(filter, index + 1);
        if (index >= 0) {
          positions.push(index);
        }
      } while (index >= 0);

      for (let j = positions.length - 1; j >= 0; j--) {
        const currentPosition = positions[j];
        const currentFilter = currentSubscription.filterTextAt(currentPosition);
        if (currentFilter === filter.text) {
          currentSubscription.deleteFilterAt(currentPosition);
          filterNotifier.emit('filter.removed', filter, currentSubscription,
            currentPosition);
        }
      }
    }


    for (const subscription of filterStorage.subscriptions()) {
      const positions = [];
      let index = -1;
      do {
        index = subscription._filterText.indexOf(filter, index + 1);
        if (index >= 0) {
          positions.push(index);
        }
      }
      while (index >= 0);

      for (let j = positions.length - 1; j >= 0; j--) {
        const position = positions[j];
        if (subscription._filterText[position] === filter) {
          subscription._filterText.splice(position, 1);
          if (subscription._filterText.indexOf(filter) < 0) {
            index = filter._subscriptions.indexOf(subscription);
            if (index >= 0) {
              filter._subscriptions.splice(index, 1);
            }
          }
          filterNotifier.emit('filter.removed', filter, subscription, position);
        }
      }
    }
  };

  // Removes the valid filters from any / all filter lists and
  // saves the valid entries
  // Note:  any invalid filters are ignored
  // Inputs: filters:string the new filters.
  const setExcludeFilters = function (filtersToExclude) {
    const excludeFilters = filtersToExclude.trim();
    const excludeFiltersArray = excludeFilters.split('\n');
    const validExcludeFiltersArray = [];
    for (let i = 0; i < excludeFiltersArray.length; i++) {
      let filter = excludeFiltersArray[i];
      filter = filter.trim();
      if (filter.length > 0) {
        const result = parseFilter(filter);
        if (result.filter) {
          validExcludeFiltersArray.push(result.filter);
          ABRemoveFilter(result.filter);
        }
      }
    }

    if (validExcludeFiltersArray.length > 0) {
      chromeStorageSetHelper('exclude_filters', validExcludeFiltersArray.join('\n'));
    } else {
      browser.storage.local.remove('exclude_filters');
    }
  };

  function excludeFilterChangeListener() {
    const excludeFiltersKey = 'exclude_filters';
    browser.storage.local.get(excludeFiltersKey).then((response) => {
      if (response[excludeFiltersKey]) {
        const excludeFiltersArray = response[excludeFiltersKey].split('\n');
        for (let i = 0; i < excludeFiltersArray.length; i++) {
          const filter = excludeFiltersArray[i];
          if (filter.length > 0) {
            const result = parseFilter(filter);
            if (result.filter) {
              ABRemoveFilter(result.filter);
            }
          }
        }
      } else {
        filterNotifier.off('save', excludeFilterChangeListener);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  filterNotifier.on('save', excludeFilterChangeListener);

  return {
    setExcludeFilters,
  };
}());

exports.ExcludeFilter = ExcludeFilter;
