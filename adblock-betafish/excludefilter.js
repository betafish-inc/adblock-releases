/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

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
