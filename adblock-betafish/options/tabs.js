'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, License, localizePage, getUILanguage */

function tabIsLocked(tabID) {
  const $tabToActivate = $(`.tablink[href=${tabID}]`);
  const $locked = $tabToActivate.parent('li.locked');
  return !!$locked.length;
}

const syncMessageContainer = '<div class="sync-message-container"></div>';

const syncMessageDiv = `
  <div class="sync-header-message sync-message-hidden">
    <div class="sync-message-box">
      <i class="material-icons md-24 sync-icon" role="img" aria-hidden="true"></i>
      <span class="sync-header-message-text"></span>
    </div>
  </div>`;

function getSyncOutOfDateMessageDiv(id) {
  return `
  <div class="sync-out-of-date-header-message sync-message-hidden sync-message-error">
    <div class="sync-message-box">
      <i class="material-icons md-24" role="img" aria-hidden="true">error_outline</i>
      <span i18n="sync_message_old_version_part_1"></span>&nbsp;
      <a i18n="sync_message_old_version_part_2" i18n_replacement_el="oldversionlink_${id}"
      href="https://help.getadblock.com/support/solutions/articles/6000087857-how-do-i-make-sure-adblock-is-up-to-date-" target="_blank"> <span id="oldversionlink_${id}" class="sync-message-link"></span> </a>
    </div>
  </div>`;
}

// Output an array of all tab ids in HTML
function allTabIDs() {
  return $('.tablink').map(function getTabId() {
    return $(this).attr('href');
  }).get();
}

// Inputs:
//    - tabID -- string (tab ID to activate)
// Output:
//    - tabID -- string (valid tab ID to activate)
function validateTabID(tabID) {
  if (!tabID || !allTabIDs().includes(tabID)) {
    return '#general';
  }
  return tabID;
}

// Show or hide Premium subtabs based on
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

function activateTab(tabHref) {
  const tabID = validateTabID(tabHref);
  const $activeTab = $(`.tablink[href=${tabID}]`);
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

// displayMABFeedbackCTA checks if the user has set their language to english and
// displays the feedback call to action on Premium related options pages:
//
// Premium
// Premium - Themes
// Premium - Image Swap
// Premium - Sync
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
      if ($panel.find('.sync-message-container').length === 0) {
        $panel.prepend(syncMessageContainer);
      }
      const $messageContainer = $panel.find('.sync-message-container');
      $messageContainer.prepend(getSyncOutOfDateMessageDiv(i));
      if ($panel.attr('syncMessageDiv')) {
        $messageContainer.prepend(syncMessageDiv);
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
function activateTabOnPageLoad() {
  // Set active tab from cookie
  let activeTabID = $.cookie('active_tab');

  // Set active tab from hash (has priority over cookie)
  if (window.location && window.location.hash) {
    [activeTabID] = window.location.hash.split('_');
  }
  activateTab(activeTabID);
}

$(document).ready(() => {
  // 1. load all the tab panels templates in respective panel DIVs
  loadTabPanelsHTML();

  // 2. Activate tab on page load with cookie, URL hash or default tabID
  activateTabOnPageLoad();

  // 3. Activate tab when clicked
  $('.tablink').click(function tabLinkClicked() {
    const tabID = $(this).attr('href');
    activateTab(tabID);
  });

  // 4. Display CTA - a future library update will support
  // automatically injecting the CTA HTML as well.
  displayMABFeedbackCTA();
});
