

/* For ESLint: List any global identifiers used in this file below */
/* global browser, parseFilter, chromeStorageSetHelper */

// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"

import * as ewe from '../vendor/webext-sdk/dist/ewe-api';

const ExcludeFilter = (function excludeFilter() {
  const excludeFiltersKey = 'exclude_filters';
  // Removes the valid filters from any / all filter lists and
  // saves the valid entries
  // Note:  any invalid filters are ignored
  // Inputs: filters:string the new filters.
  const setExcludeFilters = async function (filtersToExclude) {
    const response = await browser.storage.local.get(excludeFiltersKey);
    const currentExcludeFilters = response[excludeFiltersKey];
    let promises = [];
    if (currentExcludeFilters) {
      const currentExcludeArr = currentExcludeFilters.split('\n');
      for (let i = 0; i < currentExcludeArr.length; i++) {
        const filter = currentExcludeArr[i];
        if (filter.length > 0) {
          const result = ewe.filters.validate(filter);
          if (!result) {
            promises.push(ewe.filters.enable([filter]));
          }
        }
      }
    }
    await Promise.all(promises);
    promises = [];
    const excludeFilters = filtersToExclude.trim();
    const excludeFiltersArray = excludeFilters.split('\n');
    const validExcludeFiltersArray = [];
    for (let i = 0; i < excludeFiltersArray.length; i++) {
      let filter = excludeFiltersArray[i];
      filter = filter.trim();
      if (filter.length > 0) {
        const result = ewe.filters.validate(filter);
        if (!result) {
          validExcludeFiltersArray.push(filter);
          promises.push(ewe.filters.disable([filter]));
        }
      }
    }
    await Promise.all(promises);
    if (validExcludeFiltersArray.length) {
      chromeStorageSetHelper(excludeFiltersKey, validExcludeFiltersArray.join('\n'));
    } else {
      browser.storage.local.remove(excludeFiltersKey);
    }
  };

  function excludeFilterChangeListener() {
    browser.storage.local.get(excludeFiltersKey).then((response) => {
      if (response[excludeFiltersKey]) {
        setExcludeFilters(response[excludeFiltersKey]);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  ewe.subscriptions.onAdded.addListener(excludeFilterChangeListener);
  ewe.subscriptions.onChanged.addListener(excludeFilterChangeListener);
  ewe.subscriptions.onRemoved.addListener(excludeFilterChangeListener);

  return {
    setExcludeFilters,
  };
}());
export default ExcludeFilter;
