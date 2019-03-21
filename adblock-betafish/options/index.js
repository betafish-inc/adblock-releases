const backgroundPage  = chrome.extension.getBackgroundPage();
const Filter          = backgroundPage.Filter;
const WhitelistFilter = backgroundPage.WhitelistFilter;
const Subscription             = backgroundPage.Subscription;
const SpecialSubscription      = backgroundPage.SpecialSubscription;
const DownloadableSubscription = backgroundPage.DownloadableSubscription;
const parseFilter         = backgroundPage.parseFilter;
const parseFilters        = backgroundPage.parseFilters;
const FilterStorage       = backgroundPage.FilterStorage;
const filterNotifier      = backgroundPage.filterNotifier;
const Prefs               = backgroundPage.Prefs;
const Synchronizer        = backgroundPage.Synchronizer;
const Utils               = backgroundPage.Utils;
const NotificationStorage = backgroundPage.Notification;
const License             = backgroundPage.License;

var myAdBlockTabDisplay = () => {
  if (License.shouldShowMyAdBlockEnrollment()) {
    $('#myadblock-tab').show();
    $('#myadblock-tab-lock').show();
  } else if (License.isActiveLicense()) {
    $('#myadblock-tab').show();
    $('#myadblock-tab-lock').hide();
  } else {
    $('#myadblock-tab').hide();
    return $('#myadblock-tab');
  }
}

var showMyAdBlockTabContent = () => {
  if (!License) {
    return;
  }
  if (License.shouldShowMyAdBlockEnrollment()) {
    displayMyAdBlock('enrolled-free-user-view');
  } else if (License.isActiveLicense()) {
    displayMyAdBlock('paid-user-view');
  }
}

// Make sure to always display only 1 of the
// available myAdBlock tab content views
var displayMyAdBlock = function(viewId) {
  $('.myadblock-tab-content').hide();
  $(`#${ viewId }`).css('display', 'flex');
}

var addMyAdBlockTab = function() {
  if (!License) {
    return;
  }
  let showMyAdBlockTab = License.shouldShowMyAdBlockEnrollment() || License.isActiveLicense();
  if (!showMyAdBlockTab) {
    return;
  }

  let myAdBlockTabHTMLString = '<li data-scripts="adblock-option-myadblock.js" id="myadblock-tab">\
    <a href="adblock-options-myadblock.html">\
      <span id="myadblock-tab-lock"></span>&nbsp;\
      <span i18n="myadblockoptions"></span>\
    </a>\
  </li>';
  let $tabsUL = $('#tabpages > ul:not(.has-myadblock)');
  let $tabs = $('#tabpages');

  $tabsUL.prepend(myAdBlockTabHTMLString);
  $tabsUL.addClass('has-myadblock');
  $tabs.tabs().tabs('refresh');

  myAdBlockTabDisplay();
}

function loadOptions()
{
  addMyAdBlockTab();

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
  var activeTab    = $.cookie('activetab');
  if (window.location &&
    window.location.search)
  {
    var searchQuery = parseUri.parseSearch(window.location.search);
    if (searchQuery &&
      searchQuery.tab)
    {
      activeTab = searchQuery.tab;
    }
  }

  chrome.storage.local.get(License.myAdBlockEnrollmentFeatureKey, (myAdBlockInfo) => {
    if (!myAdBlockInfo || !myAdBlockInfo.myAdBlockFeature) {
      loadTabs(activeTab);
      return;
    }

    if (myAdBlockInfo.myAdBlockFeature.takeUserToMyAdBlockTab) {
      activeTab = 0;
      myAdBlockInfo.myAdBlockFeature.takeUserToMyAdBlockTab = false;
      chrome.storage.local.set(myAdBlockInfo);
    }

    loadTabs(activeTab);
  });

  backgroundPage.recordGeneralMessage("options_opened", undefined, { tab: activeTab });
}

var loadTabs = function(activeTab) {
  $('#tabpages').tabs({
    // Go to the last opened tab
    active: activeTab,
    activate: function (event, ui)
    {
      $.cookie('activetab', ui.newTab.index(), {
        expires: 10,
      });
    },

    // Cache tabs
    beforeLoad: function (event, ui)
    {
      var tabId = ui.tab.index();
      if (ui.tab.data('loaded') && tabId !== 3)
      {
        event.preventDefault();
        return;
      }

      ui.jqXHR.success(function ()
      {
        ui.tab.data('loaded', true);
      });
    },

    load: function (event, ui)
    {
      //translation
      localizePage();

      showMyAdBlockTabContent();

      if (optionalSettings &&
          !optionalSettings.show_advanced_options)
      {
        $('.advanced').hide();
      }

      // Must load tab .js here: CSP won't let injected html inject <script>
      // see index.html:data-scripts
      ui.tab['0'].dataset.scripts.split(' ').forEach(function (scriptToLoad)
      {
        // CSP blocks eval, which $().append(scriptTag) uses
        var s = document.createElement('script');
        s.src = scriptToLoad;
        document.body.appendChild(s);
      });
      displayTranslationCredit();
    },
  }).show();
}

var language = navigator.language.match(/^[a-z]+/i)[0];
function rightToLeft()
{
  if (language === 'ar' || language === 'he')
  {
    $(window).resize(function ()
    {
      if ($('.social').is(':hidden'))
      {
        $('.translation_credits').css({ margin: '0px 50%', width: '350px' });
        $('#paymentlink').css({ margin: '0px 50%', width: '350px' });
        $('#version_number').css({ margin: '20px 50%', width: '350px' });
      } else
      {
        $('.translation_credits').css('right', '0px');
        $('#paymentlink').css('right', '0px');
        $('#version_number').css({ right: '0px', padding: '0px' });
      }
    });

    $('li').css('float', 'right');
    $('#small_nav').css({ right: 'initial', left: '45px' });
    $('.ui-tabs .ui-tabs-nav li').css('float', 'right');
  } else
  {
    $('.ui-tabs .ui-tabs-nav li').css('float', 'left');
  }
}

function showMiniMenu()
{
  $('#small_nav').click(function ()
  {
    if ($('.ui-tabs-nav').is(':hidden'))
    {
      $('.ui-tabs .ui-tabs-nav li').css('float', 'none');
      $('.ui-tabs-nav').fadeIn('fast');
      if (language === 'ar' || language === 'he')
      {
        $('.ui-tabs-nav').css({ right: 'auto', left: '40px' });
      }
    } else
    {
      $('.ui-tabs-nav').fadeOut('fast');
    }
  });

  $(window).resize(function ()
  {
    if ($('.ui-tabs-nav').is(':hidden') && $('#small_nav').is(':hidden'))
    {
      if (language === 'ar' || language === 'he')
      {
        $('.ui-tabs .ui-tabs-nav li').css('float', 'right');
        $('.ui-tabs-nav').css({ right: 'auto', left: 'auto' });
      } else
      {
        $('.ui-tabs .ui-tabs-nav li').css('float', 'left');
      }

      $('.ui-tabs-nav').css('display', 'flex');
    } else if ($('#small_nav').is(':visible'))
    {
      $('.ui-tabs-nav').hide();
    }
  });
}

function displayVersionNumber()
{
  let currentVersion = chrome.runtime.getManifest().version;
  $('#version_number').text(translate('optionsversion', [currentVersion]));
}

function createAndAssignPaymentURL() {
  chrome.storage.local.get('userid', function (response)
  {
    var paymentURL = 'https://getadblock.com/pay/';
    if (response.userid)
    {
      var paymentURL = paymentURL + '?source=O&u=' + response.userid;
    }
    $('#paymentlink').attr('href', paymentURL);
  });
}

function displayTranslationCredit()
{
  if (navigator.language.substring(0, 2) != 'en')
  {
    var translators = [];

    $.getJSON(chrome.extension.getURL('translators.json'), function(response) {
      var lang = navigator.language;
      var matchFound = false;
      for (var id in response)
      {
        // if matching id hasn't been found and id matches lang
        if (!matchFound &&
            (id === lang || id === lang.toLowerCase() ||
             id === lang.substring(0, 2) || id === lang.substring(0, 2).toLowerCase()))
        {
          matchFound = true;
          // Check if this language is professionally translated
          var professionalLang = response[id].professional;
          for (var translator in response[id].translators)
          {
            // If the language is not professionally translated, or if this translator
            // is a professional, then add the name to the list of credits
            if (!professionalLang || response[id].translators[translator].professional)
            {
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
}

// Test if pattern#@#pattern or pattern##pattern
var isSelectorFilter = function (text)
{
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /\#\@?\#./.test(text);
};

var isSelectorExcludeFilter = function (text)
{
  return /\#\@\#./.test(text);
};

var isWhitelistFilter = function (text)
{
  return /^\@\@/.test(text);
};

var optionalSettings = {};
$(document).ready(function ()
{
  createAndAssignPaymentURL();
  loadOptions();
  rightToLeft();
  showMiniMenu();
  displayVersionNumber();
  localizePage();
});

var delayedSubscriptionSelection = null;

function startSubscriptionSelection(title, url)
{
  var list = document.getElementById("language_select");
  if (!list ||
      ((typeof FilterListUtil === 'undefined') || (FilterListUtil === null )) ||
      ((typeof CustomFilterListUploadUtil === 'undefined') || (CustomFilterListUploadUtil === null)))
  {
    $('#tabpages').tabs( "option", "active", 1 );
    delayedSubscriptionSelection = [title, url];
    return;
  }
  var translatedMsg = translate("subscribeconfirm",title);
  if (window.confirm(translatedMsg)) {
    var existingFilterList = FilterListUtil.checkUrlForExistingFilterList(url);

    if (existingFilterList)
    {
      CustomFilterListUploadUtil._updateExistingFilterList(existingFilterList);
    }
    else
    {
      if (/^https?\:\/\/[^\<]+$/.test(url))
      {
        CustomFilterListUploadUtil._performUpload(url, 'url:' + url, title);
      } else
      {
        alert(translate('failedtofetchfilter'));
      }
    }
  }
}

let port = chrome.runtime.connect({name: "ui"});

port.onMessage.addListener((message) =>
{
  switch (message.type)
  {
    case "app.respond":
      switch (message.action)
      {
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
