const backgroundPage  = chrome.extension.getBackgroundPage();
const Filter          = backgroundPage.Filter;
const WhitelistFilter = backgroundPage.WhitelistFilter;
const Subscription             = backgroundPage.Subscription;
const SpecialSubscription      = backgroundPage.SpecialSubscription;
const DownloadableSubscription = backgroundPage.DownloadableSubscription;
const parseFilter         = backgroundPage.parseFilter;
const filterStorage       = backgroundPage.filterStorage;
const filterNotifier      = backgroundPage.filterNotifier;
const settingsNotifier    = backgroundPage.settingsNotifier;
const channelsNotifier    = backgroundPage.channelsNotifier;
const Prefs               = backgroundPage.Prefs;
const synchronizer        = backgroundPage.synchronizer;
const Utils               = backgroundPage.Utils;
const NotificationStorage = backgroundPage.Notification;
const License             = backgroundPage.License;
const SyncService         = backgroundPage.SyncService;
const isValidTheme       = backgroundPage.isValidTheme;
const abpPrefPropertyNames  = backgroundPage.abpPrefPropertyNames;
const FIVE_SECONDS = 5000;
const TWENTY_SECONDS = FIVE_SECONDS * 4;

let language = navigator.language.match(/^[a-z]+/i)[0];
let optionalSettings = {};
let delayedSubscriptionSelection = null;
let port = chrome.runtime.connect({name: "ui"});
let syncErrorCode = 0;

// Function to check the last known Sync Error Code,
// only allows an event handler to run if there is
// no error to prevent data loss
function checkForSyncError(handler) {
  return function(event) {
    if (syncErrorCode >= 400) {
      return;
    }
    handler(event);
  }
}

function displayVersionNumber() {
  let currentVersion = chrome.runtime.getManifest().version;
  $('#version_number').text(translate('optionsversion', [currentVersion]));
}

function displayTranslationCredit() {
  if (navigator.language.substring(0, 2) === 'en') {
    return;
  }
  let translators = [];

  $.getJSON(chrome.extension.getURL('translators.json'), function(response) {
    var lang = navigator.language;
    var matchFound = false;
    for (var id in response) {
      // if matching id hasn't been found and id matches lang
      if (!matchFound &&
          (id === lang || id === lang.toLowerCase() ||
            id === lang.substring(0, 2) || id === lang.substring(0, 2).toLowerCase())) {
        matchFound = true;
        // Check if this language is professionally translated
        var professionalLang = response[id].professional;
        for (var translator in response[id].translators) {
          // If the language is not professionally translated, or if this translator
          // is a professional, then add the name to the list of credits
          if (!professionalLang || response[id].translators[translator].professional) {
            var name = response[id].translators[translator].credit;
            translators.push(' ' + name);
          }
        }
      }
    }

    if (translators.length > 0) {
      var $translatorsCreditBubble = $('.translation_credits');
      var $translatorCreditDiv = $('<div></div');
      var $translatorNamesDiv = $('<div></div>');

      $translatorCreditDiv.addClass('speech-bubble-content').text(translate('translator_credit2'));
      $translatorNamesDiv.addClass('speech-bubble-content').text(translators.toString());
      $translatorsCreditBubble.empty()
          .addClass('speech-bubble')
          .removeClass('do-not-display')
          .append($translatorCreditDiv)
          .append($translatorNamesDiv);
    } else {
      $translatorsCreditBubble.addClass('do-not-display').empty();
    }
  });
}

// Test if pattern#@#pattern or pattern##pattern
var isSelectorFilter = function (text) {
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /\#\@?\#./.test(text);
};

var isSelectorExcludeFilter = function (text) {
  return /\#\@\#./.test(text);
};

var isWhitelistFilter = function (text) {
  return /^\@\@/.test(text);
};

function startSubscriptionSelection(title, url)
{
  var list = document.getElementById("language_select");
  if (!list ||
      ((typeof FilterListUtil === 'undefined') || (FilterListUtil === null )) ||
      ((typeof CustomFilterListUploadUtil === 'undefined') || (CustomFilterListUploadUtil === null))) {
    activateTab('#filters');
    delayedSubscriptionSelection = [title, url];
    return;
  }
  var translatedMsg = translate("subscribeconfirm",title);
  if (window.confirm(translatedMsg)) {
    var existingFilterList = FilterListUtil.checkUrlForExistingFilterList(url);

    if (existingFilterList) {
      CustomFilterListUploadUtil._updateExistingFilterList(existingFilterList);
    } else {
      if (/^https?\:\/\/[^\<]+$/.test(url)) {
        CustomFilterListUploadUtil._performUpload(url, 'url:' + url, title);
      } else {
        alert(translate('failedtofetchfilter'));
      }
    }
    // show the link icon for the new filter list, if the advance setting is set and the show links button has been clicked (not visible)
    if (optionalSettings &&
      optionalSettings.show_advanced_options && $('#btnShowLinks').is(":visible") == false) {
      $('.filter-list-link').fadeIn('slow');
    }
  }
}

port.onMessage.addListener((message) => {
  switch (message.type) {
    case "app.respond":
      switch (message.action) {
        case "addSubscription":
          let subscription = message.args[0];
          startSubscriptionSelection(subscription.title, subscription.url);
          break;
      }
      break;
  }
});

port.postMessage({
  type: "app.listen",
  filter: ["addSubscription"]
});

window.addEventListener("unload", () => port.disconnect());

function setSelectedThemeColor() {
  var optionsTheme = 'default_theme';
  if (backgroundPage && backgroundPage.getSettings()) {
    let settings = backgroundPage.getSettings();
    optionsTheme = settings.color_themes.options_page;
  }
  $('body').attr('id', optionsTheme).data('theme', optionsTheme);
}

function loadOptionalSettings()
{
  if (backgroundPage &&
      typeof backgroundPage.getSettings !== "function") {
    // if the backgroudPage isn't available, wait 50 ms, and reload page
    window.setTimeout(function ()
    {
      window.location.reload();
    }, 50);
  }
  if (backgroundPage &&
      typeof backgroundPage.getSettings === "function") {
    // Check or uncheck each option.
    optionalSettings     = backgroundPage.getSettings();
  }
  if (optionalSettings.sync_settings) {
    addSyncListeners();
    window.addEventListener("unload", function() {
      removeSyncListeners();
    });
  }
}

const removeSyncListeners = function() {
  SyncService.syncNotifier.off("post.data.sending", onPostDataSending);
  SyncService.syncNotifier.off("post.data.sent", onPostDataSent);
  SyncService.syncNotifier.off("post.data.sent.error", onPostDataSentError);
  SyncService.syncNotifier.off("sync.data.getting", onSyncDataGetting);
  SyncService.syncNotifier.off("sync.data.receieved", onSyncDataReceieved);
  SyncService.syncNotifier.off("sync.data.getting.error", onSyncDataGettingError);
  SyncService.syncNotifier.off("sync.data.getting.error.initial.fail", onSyncDataInitialGettingError);
  SyncService.syncNotifier.off("extension.name.updated.error", onExtensionNameError);
};

const addSyncListeners = function() {
  SyncService.syncNotifier.on("post.data.sending", onPostDataSending);
  SyncService.syncNotifier.on("post.data.sent", onPostDataSent);
  SyncService.syncNotifier.on("post.data.sent.error", onPostDataSentError);
  SyncService.syncNotifier.on("sync.data.getting", onSyncDataGetting);
  SyncService.syncNotifier.on("sync.data.receieved", onSyncDataReceieved);
  SyncService.syncNotifier.on("sync.data.getting.error", onSyncDataGettingError);
  SyncService.syncNotifier.on("sync.data.getting.error.initial.fail", onSyncDataInitialGettingError);
  SyncService.syncNotifier.on("extension.name.updated.error", onExtensionNameError);
};

const requestSyncMessageRemoval = function(delayTime) {
  if (!delayTime) {
    return;
  }
  setTimeout(function() {
    $(".sync-header-message-text").text("");
    $(".sync-header-done-icon").hide();
    $(".sync-header-error-icon").hide();
    $(".sync-header-sync-icon").hide();
    $(".sync-out-of-date-header-error-icon").hide();
    $(".sync-header-message").removeClass("sync-message-good").removeClass("sync-message-error").addClass("sync-header-message-hidden");
    $(".sync-out-of-date-header-message").addClass("sync-out-of-date-header-message-hidden");
  }, delayTime);
};

const showSyncMessage = function(msgText, doneIndicator, errorIndicator) {
  if (!msgText) {
    return;
  }
  $(".sync-header-message-text").text(msgText);
  $(".sync-icon").hide();
  if (!doneIndicator && errorIndicator) {
    $(".sync-header-error-icon").show();
    $(".sync-header-message").removeClass("sync-header-message-hidden").removeClass("sync-message-good").addClass("sync-message-error");
    requestSyncMessageRemoval(TWENTY_SECONDS);
  } else if (doneIndicator && !errorIndicator) {
    $(".sync-header-done-icon").show();
    $(".sync-header-message").removeClass("sync-header-message-hidden").removeClass("sync-message-error").addClass("sync-message-good");
    requestSyncMessageRemoval(FIVE_SECONDS);
  } else {
    $(".sync-header-sync-icon").show();
    $(".sync-header-message").removeClass("sync-header-message-hidden").removeClass("sync-message-error").addClass("sync-message-good");
  }
}

const showOutOfDateExtensionError = function() {
  $(".sync-out-of-date-header-error-icon").show();
  $(".sync-out-of-date-header-message").removeClass("sync-out-of-date-header-message-hidden");
  requestSyncMessageRemoval(TWENTY_SECONDS);
}

const onExtensionNameError = function(errorCode) {
  showSyncMessage(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_message_setup_fail_part_2"), false, true);
};

const onPostDataSending = function() {
  showSyncMessage(translate("sync_header_message_in_progress"));
};

const onPostDataSent = function() {
  syncErrorCode = 0;
  showSyncMessage(translate("sync_header_message_sync_complete"), true);
};

const onPostDataSentError = function(errorCode, initialGet) {
  if (errorCode === 409) {
    showSyncMessage(translate("sync_header_message_error_prefix") + " " + translate("sync_header_message_old_commit_version_part_2") + " " + translate("sync_header_message_old_commit_version_part_3"), false, true);
    if ($('#customize').is(":visible")) {
      $("#customize-sync-header-message").text(translate("sync_header_message_error_prefix") + " " + translate("sync_header_message_old_commit_version_customize_tab_part_2") + " " + translate("sync_header_message_old_commit_version_customize_tab_part_3"));
      syncErrorCode = errorCode;
    }
  } else if (initialGet && (errorCode === 0 || errorCode === 401 || errorCode === 404 || errorCode === 500)) {
    showSyncMessage(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_message_setup_fail_part_2"), false, true);
    if ($('#customize').is(":visible")) {
      $("#customize-sync-header-message").text(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_message_setup_fail_part_2"));
      syncErrorCode = errorCode;
    }
  } else if (!initialGet && (errorCode === 0 || errorCode === 401 || errorCode === 404 || errorCode === 500)) {
    showSyncMessage(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_error_revert_message_part_2") + " " + translate("sync_header_message_error_suffix"), false, true);
    if ($('#customize').is(":visible")) {
      $("#customize-sync-header-message").text(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_error_revert_message_part_2") + " " + translate("sync_header_message_error_suffix"));
      syncErrorCode = errorCode;
    }
  }
};

const onSyncDataGetting = function() {
  showSyncMessage(translate("sync_header_message_in_progress"));
};

const onSyncDataReceieved = function(data) {
  showSyncMessage(translate("sync_header_message_sync_complete"), true);
};

const onSyncDataGettingError = function(errorCode, responseJSON) {
  // NOTE - currently, there are no error messages for  404, 500
  if (errorCode ===  400 && responseJSON && responseJSON.code === "invalid_sync_version") {
    showOutOfDateExtensionError();
    return;
  }
  showSyncMessage(translate("sync_header_message_no_license"), false, true);
};

const onSyncDataInitialGettingError = function(errorCode) {
  showSyncMessage(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_message_setup_fail_part_2"), false, true);
};

// Update Acceptable Ads UI in the General tab. To be called
// when there is a change in the AA and AA Privacy subscriptions
// Inputs: - checkAA: Bool, true if we must check AA
//         - checkAAprivacy: Bool, true if we must check AA privacy
const updateAcceptableAdsUI = function(checkAA, checkAAprivacy) {
  let $aaInput = $('input#acceptable_ads');
  let $aaPrivacyInput = $('input#acceptable_ads_privacy');
  let $aaPrivacyHelper = $('#aa-privacy-helper');
  let $aaYellowBanner = $('#acceptable_ads_info');

  if (!checkAA && !checkAAprivacy) {
    $aaInput.prop('checked', false);
    $aaPrivacyInput.prop('checked', false);
    $aaYellowBanner.slideDown();
    $aaPrivacyHelper.slideUp();
  } else if (checkAA && checkAAprivacy) {
    $aaInput.removeClass('feature').prop('checked', true).addClass('feature');
    $aaPrivacyInput.prop('checked', true);
    $aaYellowBanner.slideUp();
    navigator.doNotTrack ? $aaPrivacyHelper.slideUp() : $aaPrivacyHelper.slideDown();
  } else if (checkAA && !checkAAprivacy) {
    $aaInput.prop('checked', true);
    $aaPrivacyInput.prop('checked', false);
    $aaYellowBanner.slideUp();
    $aaPrivacyHelper.slideUp();
  }
};

$(document).ready(function () {
  var onSettingsChanged = function(name, currentValue, previousValue) {
    if (name === 'color_themes') {
      $('body').attr('id', currentValue.options_page).data('theme', currentValue.options_page);
    }
  };
  settingsNotifier.on("settings.changed", onSettingsChanged);
  window.addEventListener("unload", function() {
    settingsNotifier.off("settings.changed", onSettingsChanged);
  });

  setSelectedThemeColor();
  loadOptionalSettings();
  displayVersionNumber();
  localizePage();
  displayTranslationCredit();
});
