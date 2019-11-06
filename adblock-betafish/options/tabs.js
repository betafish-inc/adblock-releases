'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, License, localizePage, getUILanguage */

function tabIsLocked(tabID) {
  const $tabToActivate = $(`.tablink[href=${tabID}]`);
  const $locked = $tabToActivate.parent('li.locked');
  return !!$locked.length;
}

const syncMessageDiv = `
  <div class="sync-header-message page-title sync-header-message-hidden">
    <span>
      <i class="material-icons md-24 sync-icon sync-header-error-icon" role="img" aria-hidden="true">error_outline</i>
      <i class="material-icons md-24 sync-icon sync-header-sync-icon" role="img" aria-hidden="true">sync</i>
      <i class="material-icons md-24 sync-icon sync-header-done-icon" role="img" aria-hidden="true">check_circle</i>
    </span>
    <span id="themes-sync-header-message" class="sync-header-message-text"></span>
  </div>`;

function getSyncOutOfDateMessageDiv(id) {
  return `
  <div class="sync-out-of-date-header-message sync-out-of-date-header-message-hidden sync-message-error">
    <span>
      <i class="material-icons md-24 sync-icon sync-out-of-date-header-error-icon" role="img" aria-hidden="true">error_outline</i>
    </span>
    <span i18n="sync_message_old_version_part_1"></span>&nbsp;
    <a i18n="sync_message_old_version_part_2" i18n_replacement_el="oldversionlink_${id}"
    href="https://help.getadblock.com/support/solutions/articles/6000087857-how-do-i-make-sure-adblock-is-up-to-date-" target="_blank"> <span id="oldversionlink_${id}" class="sync-error-link-text-color"></span> </a>
  </div>`;
}

// Output an array of all tab ids in HTML
function allTabIDs() {
  return $('.tablink').map(function getTabId() {
    return $(this).attr('href');
  }).get();
}

// Active tab cannot be #mab at any point
// if mab tab doesn't exist
// Inputs:
//    - tabID -- string (tab ID to activate)
//    - mabExists -- bool (true if enrolled to MAB)
// Output:
//    - tabID -- string (valid tab ID to activate)
function validateTabID(tabID, mabExists) {
  const defaultTabID = mabExists ? '#mab' : '#general';
  const currentTabID = $('.tablink.active').attr('href');

  if (!tabID) {
    return defaultTabID;
  }
  if (tabID === '#mab' && !mabExists) {
    return defaultTabID;
  }
  if (!allTabIDs().includes(tabID)) {
    return defaultTabID;
  }
  if (currentTabID && tabIsLocked(tabID)) {
    return currentTabID;
  }
  if (tabIsLocked(tabID)) {
    return defaultTabID;
  }
  return tabID;
}

// Show or hide myAdBlock subtabs based on
// which tab is currently active. All subtabs
// links must have a data-parent-tab attribute
// Inputs: $activeTab -- jQuery object
function handleSubTabs($activeTab) {
  const activeTabHref = $activeTab.attr('href');
  const $activeTabNestedUL = $(`[data-parent-tab=${activeTabHref}]`);
  const $activeTabUL = $activeTab.closest('ul');
  const subtabIsActive = $activeTabUL[0].hasAttribute('data-parent-tab');
  const parentTabIsActive = !!$activeTabNestedUL.length;

  // hide all subtabs ul elements
  $('[data-parent-tab]').hide();

  if (subtabIsActive) {
    $activeTabUL.show().fadeTo('slow', 1);
  } else if (parentTabIsActive) {
    $activeTabNestedUL.show().fadeTo('slow', 1);
  }
}


// Load tab panel script in the document when the tab is
// activated for the first time.
// Inputs: $activeTabPanel -- jQuery Object
function loadTabPanelScript($activeTabPanel) {
  const activePanelID = $activeTabPanel.attr('id');
  const scriptToLoad = `adblock-options-${activePanelID}.js`;
  const scriptTag = document.createElement('script');
  const alreadyLoaded = $(`script[src="${scriptToLoad}"]`).length > 0;

  if (alreadyLoaded) {
    return;
  } // dont' load twice the same script

  // Don't use $().append(scriptTag) because CSP blocks eval
  scriptTag.src = scriptToLoad;
  document.body.appendChild(scriptTag);
}

// Display tabs and panel based on the current active tab
// Inputs: $activeTab - active tab jQuery object
function displayActiveTab($activeTab) {
  const $activeTabPanel = $($activeTab.attr('href'));
  handleSubTabs($activeTab);
  loadTabPanelScript($activeTabPanel);
  $activeTabPanel.show();
}

function activateTab(tabHref, mabExists) {
  const tabID = validateTabID(tabHref, mabExists);
  const $activeTab = $(`[href=${tabID}]`);
  const $allTabs = $('.tablink');
  const $allTabPanels = $('.tab');

  $allTabs.removeClass('active');
  $allTabPanels.hide();

  $activeTab.addClass('active');

  $.cookie('active_tab', $activeTab.attr('href'), {
    expires: 10,
  });

  displayActiveTab($activeTab);
}

// Add myAdBlock tab HTML and respective subtabs if user is enrolled
function addMyAdBlockTab() {
  if (!License) {
    return false;
  }
  const showMyAdBlockTab = License.shouldShowMyAdBlockEnrollment() || License.isActiveLicense();
  if (!showMyAdBlockTab) {
    return false;
  }

  // Hint: To add an extra subtab, add another <li> element below.
  // Add class="locked" to li only if the subtab is not clickable for a free user
  const myAdBlockTab = `
  <li id="myadblock-tab">
    <a href="#mab" class="tablink">
      <i class="material-icons md-18" role="img" aria-hidden="true">account_circle</i>
      <span i18n="myadblockoptions"></span>
    </a>
    <ul data-parent-tab="#mab">
      <li>
        <a href="#mab-themes" class="tablink">
          <i class="material-icons md-18 unlocked" role="img" aria-hidden="true">featured_video</i>
          <span i18n="themes"></span>
        </a>
      </li>
      <li>
        <a href="#mab-image-swap" class="tablink">
          <i class="material-icons md-18 unlocked" role="img" aria-hidden="true">image</i>
          <i class="material-icons md-18 locked" role="img" i18n-aria-label="locked">lock</i>
          <span i18n="image_swap"></span>
        </a>
      </li>
      <li class="locked">
        <a href="#sync" class="tablink">
          <i class="material-icons md-18 unlocked" role="img" aria-hidden="true">sync</i>
          <i class="material-icons md-18 locked" role="img" i18n-aria-label="locked">lock</i>
          <span i18n="sync_tab_item"></span>
        </a>
      </li>
    </ul>
  </li>`;

  const $tabsUL = $('#sidebar-tabs > ul:not(.has-myadblock)');

  $tabsUL.prepend(myAdBlockTab);
  $tabsUL.addClass('has-myadblock');

  if (License.shouldShowMyAdBlockEnrollment()) {
    $('#myadblock-tab').show();
    $('#themes-tab').hide();
    return true;
  }
  if (License.isActiveLicense()) {
    $('#myadblock-tab li.locked').removeClass('locked');
    $('#myadblock-tab').show();
    $('#themes-tab').hide();
    return true;
  }
  $('#myadblock-tab').hide();
  $('#themes-tab').show();
  return false;
}

// displayMABFeedbackCTA checks if the user has set their language to english and
// displays the feedback call to action on MyAdBlock related options pages:
//
// MyAdBlock
// MAB - Themes
// MAB - Image Swap
// MAB - Sync
const displayMABFeedbackCTA = function () {
  const lang = getUILanguage();
  if (lang === 'en' || lang.startsWith('en-')) {
    $('div.mab-page-box > .option-page-content > footer').removeAttr('style');
    const $feedbackButton = $('.mab-feedback-button');
    $feedbackButton.click((e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      let url = 'https://getadblock.typeform.com/to/zKDlkc';
      if (License.isActiveLicense()) {
        url = 'https://getadblock.typeform.com/to/VUFngU';
      }
      chrome.tabs.create({ url });
      $feedbackButton.blur();
    });
  }
};

// Load all HTML templates in respective tab panels
// and translate strings on load completion
function loadTabPanelsHTML() {
  const $tabPanels = $('#tab-content .tab');
  let tabsLoaded = 1; // track the tabs that are loaded
  $.each($tabPanels, (i, panel) => {
    const $panel = $(panel);
    const panelID = $(panel).attr('id');

    const panelHTML = `adblock-options-${panelID}.html`;
    $panel.load(panelHTML, () => {
      $panel.prepend(getSyncOutOfDateMessageDiv(i));
      if ($panel.attr('syncMessageDiv')) {
        $panel.prepend(syncMessageDiv);
      }
      localizePage();
      tabsLoaded += 1;
      if (tabsLoaded >= $tabPanels.length) {
        // all tabs have been loaded and localized - call
        // any post processing handlers here.
        displayMABFeedbackCTA();
      }
    });
  });
}

// Get active tab ID from cookie or URL hash and activate tab
// and display the tabs and tabel accordingly
function activateTabOnPageLoad(mabExists) {
  // Set active tab from cookie
  let activeTabID = $.cookie('active_tab');

  // Set active tab from hash (has priority over cookie)
  if (window.location && window.location.hash) {
    [activeTabID] = window.location.hash.split('_');
  }
  activateTab(activeTabID, mabExists);
}

$(document).ready(() => {
  // 1. add the myadblock tab if user is enrolled
  const myAdBlockTabAdded = addMyAdBlockTab();

  // 2. load all the tab panels templates in respective panel DIVs
  loadTabPanelsHTML();

  // 3. Activate tab on page load with cookie, URL hash or default tabID
  activateTabOnPageLoad(myAdBlockTabAdded);

  // 4. Activate tab when clicked
  $('.tablink').click(function tabLinkClicked() {
    const tabID = $(this).attr('href');
    activateTab(tabID, myAdBlockTabAdded);
  });

  // 5. Display CTA - a future library update will support
  // automatically injecting the CTA HTML as well.
  displayMABFeedbackCTA();
});
