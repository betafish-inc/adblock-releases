

/* For ESLint: List any global identifiers used in this file below */
/* global browser, BG, optionalSettings, createFilterMetaData,
syncErrorCode, translate, checkForSyncError, isSelectorFilter, activateTab, License,
MABPayment, DOMPurify */

let originalCustomFilters = [];

function cleanCustomFilter(filtersArg) {
  let filters = filtersArg;
  // Remove the global pause white-list item if adblock is paused
  if (BG.adblockIsPaused()) {
    filters = filters.filter(element => !(element.text === BG.pausedFilterText1
               || element.text === BG.pausedFilterText2));
  }
  // Remove the domain pause white-list items
  const domainPauses = BG.adblockIsDomainPaused();
  for (const aDomain in domainPauses) {
    filters = filters.filter(element => (element.text !== `@@${aDomain}$document`));
  }
  return filters;
}

async function showCustomRules() {
  const userFilters = await BG.getUserFilters();
  if (userFilters && userFilters.length) {
    originalCustomFilters = cleanCustomFilter(userFilters);
    originalCustomFilters = originalCustomFilters.map(filter => filter.text);
    $('#txtFiltersAdvanced').val(originalCustomFilters.join('\n'));
  }
}

async function onFilterChange() {
  if (syncErrorCode >= 400) {
    // disable all the buttons on the page
    // refreshing the page will re-enable the buttons, etc.
    $('.accordion-icon .material-icons').css('color', 'grey');
    $('button').removeClass('red').css('background-color', 'grey');
    const newStyle = document.createElement('style');
    newStyle.type = 'text/css';
    newStyle.appendChild(document.createTextNode(''));
    document.head.appendChild(newStyle);
    newStyle.sheet.insertRule('.btn:hover { font-weight: normal !important; cursor: unset !important; box-shadow: none !important; }', 0);
    return;
  }
  const userFilters = await BG.getUserFilters();
  if (userFilters && userFilters.length) {
    originalCustomFilters = cleanCustomFilter(userFilters);
    originalCustomFilters = originalCustomFilters.map(filter => filter.text);
    $('#txtFiltersAdvanced').val(originalCustomFilters.join('\n'));
  } else {
    $('#txtFiltersAdvanced').val('');
  }
  MABPayment.displaySyncCTAs(true);
}

const excludeFiltersKey = 'exclude_filters';

$(async () => {
  $('#tutorlink').attr('href', BG.Prefs.getDocLink('filterdoc'));

  const getExcludeFilters = function () {
    browser.storage.local.get(excludeFiltersKey).then((response) => {
      if (response[excludeFiltersKey]) {
        $('#txtExcludeFiltersAdvanced').val(response[excludeFiltersKey]);
        $('#divExcludeFilters').show();
      }
    });
  };
  getExcludeFilters();
  function storageChangeHandler(changes, area) {
    const changedItems = Object.keys(changes);
    if (area === 'local' && changedItems.includes(excludeFiltersKey)) {
      getExcludeFilters();
    }
  }
  browser.storage.onChanged.removeListener(storageChangeHandler);
  browser.storage.onChanged.addListener(storageChangeHandler);

  // Display any migration error messages to the user
  browser.storage.local.get('custom_filters_errors').then((response) => {
    if (response.custom_filters_errors) {
      $('#txtMigrationErrorMessage').val(response.custom_filters_errors);
      $('#migrationErrorMessageDiv').show();
      $('#btnDeleteMigrationErrorMessage').on('click', () => {
        browser.storage.local.remove('custom_filters_errors');
        $('#migrationErrorMessageDiv').hide();
      });
    }
  });

  // Update custom filter count in the background.
  // Inputs: customFiltersText:string - string representation of the custom filters
  // delimited by new line.
  function updateCustomFiltersCount(customFiltersText) {
    const customFiltersArray = customFiltersText.split('\n');
    const newCount = {};
    const tempFilterTracker = [];
    for (let i = 0; i < customFiltersArray.length; i++) {
      const filter = customFiltersArray[i];

      // Check if filter is a duplicate and that it is a hiding filter.
      if (tempFilterTracker.indexOf(filter) < 0 && filter.indexOf('##') > -1) {
        tempFilterTracker.push(filter);
        const host = filter.split('##')[0];
        newCount[host] = (newCount[host] || 0) + 1;
      }
    }

    BG.updateCustomFilterCountMap(newCount);
  }

  /**
   * Checks if the given selector filter has a valid query string.
   *
   * @param {string} selectorFilter The selector filter to validate
   * @returns {boolean} True if the given filters query is valid
   */
  function hasValidQueryString(selectorFilter) {
    // Taken from ABP's Filter.contentRegExp property.
    // Match groups are domains, separator, body
    const contentRegExp = /^([^/|@"!]*?)#([@?$])?#(.+)$/;
    const [,,, query] = contentRegExp.exec(selectorFilter);

    // Validate query. QS will throw if query is invalid.
    try {
      document.querySelector(query);
    } catch (_) {
      return false;
    }
    return true;
  }

  async function saveFilters() {
    const customFiltersText = $('#txtFiltersAdvanced').val();
    const customFiltersArray = customFiltersText.split('\n');
    let filterErrorMessage = '';
    $('#messagecustom').html(DOMPurify.sanitize(filterErrorMessage, { SAFE_FOR_JQUERY: true }));

    /* eslint-disable no-await-in-loop */
    for (let i = 0; (!filterErrorMessage && i < customFiltersArray.length); i++) {
      const filter = customFiltersArray[i].trim();

      if (filter.length === 0) {
        // empty line, move on to next item
        // eslint-disable-next-line no-continue
        continue;
      }

      const errors = await browser.runtime.sendMessage({
        type: 'filters.validate',
        text: filter,
      });

      if (errors && errors.length) {
        filterErrorMessage = translate(
          'customfilterserrormessage',
          [filter, translate(errors[0].reason || errors[0].type) || translate('filter_invalid')],
        );
      } else if (isSelectorFilter(filter) && !hasValidQueryString(filter)) {
        filterErrorMessage = translate(
          'customfilterserrormessage',
          [filter, translate('filter_invalid_css')],
        );
      }
    }

    if (filterErrorMessage) {
      $('#messagecustom').html(DOMPurify.sanitize(filterErrorMessage, { SAFE_FOR_JQUERY: true }));
      $('#messagecustom').removeClass('do-not-display');
    } else {
      // Since we might be processing a large number of changes at once,
      // remove the filter change handler, so we don't cause a race condition
      BG.ewe.filters.onAdded.removeListener(onFilterChange);
      BG.ewe.filters.onChanged.removeListener(onFilterChange);
      BG.ewe.filters.onRemoved.removeListener(onFilterChange);
      if (BG.adblockIsPaused()) {
        customFiltersArray.push('@@');
        customFiltersArray.push('@@^$document');
      }
      // remove duplicates
      /* eslint-disable-next-line max-len  */
      const uniqCustomFilters = customFiltersArray.filter((item, inx) => customFiltersArray.indexOf(item) === inx);
      /* eslint-disable no-await-in-loop */
      for (let i = 0; (i < uniqCustomFilters.length); i++) {
        let filter = uniqCustomFilters[i];
        filter = filter.trim();
        if (!originalCustomFilters.includes(filter) && filter) {
          await BG.ewe.filters.add([filter], createFilterMetaData('customize'));
        }
      }

      // Delete / remove filters the user removed...
      if (originalCustomFilters) {
        /* eslint-disable no-await-in-loop */
        for (let i = 0; (i < originalCustomFilters.length); i++) {
          const filter = originalCustomFilters[i];
          if (!customFiltersArray.includes(filter) && filter) {
            const filterText = filter.trim();
            if (filterText.length > 0) {
              await BG.ewe.filters.remove([filterText]);
            }
          }
        }
      }

      originalCustomFilters = customFiltersArray || [];
      updateCustomFiltersCount(customFiltersText);
      await showCustomRules();
      $('#divAddNewFilter').slideDown();
      $('#txtFiltersAdvanced').prop('disabled', true);
      $('#spanSaveButton').hide();
      $('#btnEditAdvancedFilters').show();
      BG.ewe.filters.onAdded.addListener(onFilterChange);
      BG.ewe.filters.onChanged.addListener(onFilterChange);
      BG.ewe.filters.onRemoved.addListener(onFilterChange);
    }
  }

  // Add a custom filter to the list
  function appendCustomFilter(filter) {
    const $customFilter = $('#txtFiltersAdvanced');
    $customFilter.val(`${filter}\n${$('#txtFiltersAdvanced').val()}`);
    saveFilters();
    $('.addControls').slideUp();
  }

  // Convert a messy list of domains to ~domain1.com|~domain2.com format
  function toTildePipeFormat(inputDomainList) {
    let domainList = inputDomainList.trim().replace(/[ ,;|]+~?/g, '|~');
    if (domainList && domainList[0] !== '~') {
      domainList = `~${domainList}`;
    }
    return domainList;
  }

  $('#txtBlacklist').on('focus', function BlacklistTextFocused() {
    // Find the blacklist entry in the user's filters, and put it
    // into the blacklist input.
    const customFilterText = $('#txtFiltersAdvanced').val();
    const match = customFilterText.match(/^@@\*\$document,domain=(~.*)$/m);
    if (match && $(this).val() === '') {
      $(this).val(match[1]);
    }
  });

  // The add_filter functions
  $('#btnAddUserFilter').on('click', checkForSyncError((event) => {
    const blockCss = $('#txtUserFilterCss').val().trim();
    const blockDomain = $('#txtUserFilterDomain').val().trim();

    if (blockDomain === '.*' || blockDomain === '*' || blockDomain === '') {
      appendCustomFilter(`##${blockCss}`);
    } else {
      appendCustomFilter(`${blockDomain}##${blockCss}`);
    }

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  $('#btnAddExcludeFilter').on('click', checkForSyncError((event) => {
    let excludeUrl = $('#txtUnblock').val().trim();

    // prevent regexes
    if (/^\/.*\/$/.test(excludeUrl)) {
      excludeUrl += '*';
    }

    appendCustomFilter(`@@${excludeUrl}$document`);

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  $('#btnAddBlacklist').on('click', checkForSyncError(() => {
    const blacklist = toTildePipeFormat($('#txtBlacklist').val());

    let filters = `${$('#txtFiltersAdvanced').val().trim()}\n`;

    // Delete the first likely line
    filters = filters.replace(/^@@\*\$document,domain=~.*\n/m, '').trim();
    $('#txtFiltersAdvanced').val(filters);

    // Add our line in its place, or if it was empty, remove the filter
    if (blacklist) {
      appendCustomFilter(`@@*$document,domain=${blacklist}`);
    } else {
      saveFilters();
    } // just record the deletion

    $('#btnAddBlacklist').prop('disabled', true);
  }));

  $('#btnAddUrlBlock').on('click', checkForSyncError((event) => {
    let blockUrl = $('#txtBlockUrl').val().trim();
    let blockDomain = $('#txtBlockUrlDomain').val().trim();
    if (blockDomain === '*') {
      blockDomain = '';
    }

    // prevent regexes
    if (/^\/.*\/$/.test(blockUrl)) {
      blockUrl += '*';
    }

    if (blockDomain === '') {
      appendCustomFilter(blockUrl);
    } else {
      appendCustomFilter(`${blockUrl}$domain=${blockDomain}`);
    }

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  // The validation functions
  $('#txtBlacklist').on('input', checkForSyncError(() => {
    let blacklist = toTildePipeFormat($('#txtBlacklist').val());

    if (blacklist) {
      blacklist = `@@*$document,domain=${blacklist}`;
    }

    let filterErrorMessage = '';
    $('#messageBlacklist').text(filterErrorMessage);
    $('#messageBlacklist').hide();
    const result = BG.ewe.filters.validate(blacklist);

    if (result) {
      $('#btnAddBlacklist').prop('disabled', true);
      filterErrorMessage = translate('customfilterserrormessage', [$('#txtBlacklist').val(), translate(result.type || result.reason)]);
      $('#messageBlacklist').text(filterErrorMessage);
      $('#messageBlacklist').show();
      return;
    }

    $('#btnAddBlacklist').prop('disabled', false);
  }));

  $('#divUrlBlock input[type=\'text\']').on('input', checkForSyncError(() => {
    const blockUrl = $('#txtBlockUrl').val().trim();
    let blockDomain = $('#txtBlockUrlDomain').val().trim();
    if (blockDomain === '*') {
      blockDomain = '';
    }

    if (blockDomain) {
      blockDomain = `$domain=${blockDomain}`;
    }
    const result = BG.ewe.filters.validate(blockUrl + blockDomain);
    $('#btnAddUrlBlock').prop('disabled', (result) ? true : null);
  }));

  $('#divCssBlock input[type=\'text\']').on('input', checkForSyncError(() => {
    const blockCss = $('#txtUserFilterCss').val().trim();
    let blockDomain = $('#txtUserFilterDomain').val().trim();
    if (blockDomain === '*') {
      blockDomain = '';
    }

    const result = BG.ewe.filters.validate(`${blockDomain}##${blockCss}`);
    $('#btnAddUserFilter').prop('disabled', (result) ? true : null);
  }));

  $('#divExcludeBlock input[type=\'text\']').on('input', checkForSyncError(() => {
    const unblockUrl = $('#txtUnblock').val().trim();
    let result = BG.ewe.filters.validate(`@@${unblockUrl}$document`);
    if (!unblockUrl || isSelectorFilter(unblockUrl)) {
      result = true;
    }

    $('#btnAddExcludeFilter').prop('disabled', (result) ? true : null);
  }));

  // When one presses 'Enter', pretend it was a click on the 'add' button
  $('.customize-entry-table input[type=\'text\']').on('keypress', checkForSyncError((event) => {
    const submitButton = $(event.target).closest('.customize-entry-table').find('input[type=\'button\']');
    if (event.keyCode === 13 && !submitButton.prop('disabled')) {
      event.preventDefault();
      submitButton.trigger('click');
    }
  }));

  $('a.controlsLink').on('click', checkForSyncError((event) => {
    event.preventDefault();
    const $myControls = $(event.target).parent('div').find('.addControls');
    $('.addControls').not($myControls).slideUp({
      complete() {
        $(event.target).parent('div').find('.accordion-icon').removeClass('upward');
      },
    });
    $myControls.slideToggle({
      complete() {
        const $icon = $(event.target).parent('div').find('.accordion-icon');
        const isExpanded = $(event.target).css('display') !== 'none';

        if (isExpanded) {
          $icon.addClass('upward');
        } else {
          $icon.removeClass('upward');
        }
      },
    });
  }));

  $('#btnEditAdvancedFilters').on('click', checkForSyncError((event) => {
    const headerOffset = $('#header').height() ? $('#header').height() + 10 : 0;
    $('body, html').animate({
      scrollTop: $(event.target).offset().top - headerOffset,
    }, 1000);
    $('#txtFiltersAdvanced').prop('disabled', false);
    $('#spanSaveButton').show();
    $('#btnEditAdvancedFilters').hide();
    $('#txtFiltersAdvanced').trigger('focus');
  }));


  $('#btnEditExcludeAdvancedFilters').on('click', checkForSyncError((event) => {
    const headerOffset = $('#header').height() ? $('#header').height() + 10 : 0;
    $('body, html').animate({
      scrollTop: $(event.target).offset().top - headerOffset,
    }, 1000);
    $('#txtExcludeFiltersAdvanced').prop('disabled', false);
    $('#spanSaveExcludeButton').show();
    $('#btnEditExcludeAdvancedFilters').hide();
    $('#txtExcludeFiltersAdvanced').trigger('focus');
  }));

  $('#btnSaveAdvancedFilters').on('click', saveFilters);

  $('#btnSaveExcludeAdvancedFilters').on('click', checkForSyncError(() => {
    const excludeFiltersText = $('#txtExcludeFiltersAdvanced').val();
    BG.ExcludeFilter.setExcludeFilters(excludeFiltersText);
    $('#divAddNewFilter').slideDown();
    $('#txtExcludeFiltersAdvanced').attr('disabled', 'disabled');
    $('#spanSaveExcludeButton').hide();
    $('#btnEditExcludeAdvancedFilters').show();
    MABPayment.displaySyncCTAs(true);
  }));

  showCustomRules();

  if (optionalSettings && optionalSettings.show_advanced_options) {
    $('#divExcludeFilters').show();
  }

  BG.ewe.filters.onAdded.addListener(onFilterChange);
  BG.ewe.filters.onChanged.addListener(onFilterChange);
  BG.ewe.filters.onRemoved.addListener(onFilterChange);
  window.addEventListener('unload', () => {
    BG.ewe.filters.onAdded.removeListener(onFilterChange);
    BG.ewe.filters.onChanged.removeListener(onFilterChange);
    BG.ewe.filters.onRemoved.removeListener(onFilterChange);
  });

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }
  const payInfo = MABPayment.initialize('customize');
  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
  }

  MABPayment.displaySyncCTAs();
  $('.sync-cta #get-it-now-customize').on('click', MABPayment.userClickedSyncCTA);
  $('.sync-cta #close-sync-cta-customize').on('click', MABPayment.userClosedSyncCTA);
  $('a.link-to-tab').on('click', (event) => {
    activateTab($(event.target).attr('href'));
  });
});
