const backgroundPage  = chrome.extension.getBackgroundPage();
const Filter          = backgroundPage.Filter;
const WhitelistFilter = backgroundPage.WhitelistFilter;
const Subscription             = backgroundPage.Subscription;
const SpecialSubscription      = backgroundPage.SpecialSubscription;
const DownloadableSubscription = backgroundPage.DownloadableSubscription;
const parseFilter         = backgroundPage.parseFilter;
const parseFilters        = backgroundPage.parseFilters;
const filterStorage       = backgroundPage.filterStorage;
const filterNotifier      = backgroundPage.filterNotifier;
const Prefs               = backgroundPage.Prefs;
const Synchronizer        = backgroundPage.Synchronizer;
const Utils               = backgroundPage.Utils;
const NotificationStorage = backgroundPage.Notification;
const License             = backgroundPage.License;
const validThemes = [
  'default_theme', 'dark_theme', 'watermelon_theme',
  'solarized_theme', 'ocean_theme', 'sunshine_theme'
];
let language = navigator.language.match(/^[a-z]+/i)[0];
let optionalSettings = {};
let delayedSubscriptionSelection = null;
let port = chrome.runtime.connect({name: "ui"});

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

function startSubscriptionSelection(title, url) {
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
}

$(document).ready(function () {
  setSelectedThemeColor();
  loadOptionalSettings();
  displayVersionNumber();
  localizePage();
});
