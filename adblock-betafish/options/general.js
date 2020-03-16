'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, parseUri, optionalSettings:true, abpPrefPropertyNames, settingsNotifier,
   DownloadableSubscription, Subscription, Prefs, synchronizer, filterStorage, filterNotifier,
   port, updateAcceptableAdsUI, activateTab, MABPayment, License, autoReloadingPage:true */

// Handle incoming clicks from bandaids.js & '/installed'
try {
  if (parseUri.parseSearch(window.location.search).aadisabled === 'true') {
    $('#acceptable_ads_info').show();
  }
} catch (ex) {
  // do nothing
}

// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
const initialize = function init() {
  const subs = backgroundPage.getSubscriptionsMinusText();

  // if the user is currently subscribed to AA
  // then 'check' the acceptable ads button.
  if ('acceptable_ads' in subs && subs.acceptable_ads.subscribed) {
    updateAcceptableAdsUI(true, false);
  }

  if ('acceptable_ads_privacy' in subs && subs.acceptable_ads_privacy.subscribed) {
    updateAcceptableAdsUI(true, true);
  }

  for (const name in optionalSettings) {
    $(`#enable_${name}`).prop('checked', optionalSettings[name]);
  }
  if (optionalSettings && !optionalSettings.show_advanced_options) {
    $('.advanced').hide();
  }

  for (const inx in abpPrefPropertyNames) {
    const name = abpPrefPropertyNames[inx];
    $(`#prefs__${name}`).prop('checked', backgroundPage.Prefs[name]);
  }

  const acceptableAdsPrivacyClicked = function (isEnabled) {
    const acceptableAds = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
    const acceptableAdsPrivacy = Subscription.fromURL(Prefs.subscriptions_exceptionsurl_privacy);

    if (isEnabled) {
      if (acceptableAdsPrivacy instanceof DownloadableSubscription) {
        synchronizer.execute(acceptableAdsPrivacy);
      }
      filterStorage.addSubscription(acceptableAdsPrivacy);
      filterStorage.removeSubscription(acceptableAds);
      updateAcceptableAdsUI(true, true);
    } else {
      filterStorage.addSubscription(acceptableAds);
      filterStorage.removeSubscription(acceptableAdsPrivacy);
      updateAcceptableAdsUI(true, false);
    }
  };

  const acceptableAdsClicked = function (isEnabled) {
    const subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
    const acceptableAdsPrivacy = Subscription.fromURL(Prefs.subscriptions_exceptionsurl_privacy);

    if (isEnabled) {
      filterStorage.addSubscription(subscription);
      if (subscription instanceof DownloadableSubscription) {
        synchronizer.execute(subscription);
      }
      updateAcceptableAdsUI(true, false);
    } else {
      filterStorage.removeSubscription(subscription);
      filterStorage.removeSubscription(acceptableAdsPrivacy);
      updateAcceptableAdsUI(false, false);
    }
  };

  $('input.feature[type=\'checkbox\']').on('change', function onOptionSelectionChange() {
    const isEnabled = $(this).is(':checked');

    // This change of settings causes the Options page to be automatically reloaded
    // so the CTA display logic is handled on the Options page unload/load time
    if (this.id !== 'enable_show_advanced_options') {
      MABPayment.displaySyncCTAs(true);
    }

    if (this.id === 'acceptable_ads') {
      acceptableAdsClicked(isEnabled);
      return;
    }

    if (this.id === 'acceptable_ads_privacy') {
      acceptableAdsPrivacyClicked(isEnabled);
      return;
    }

    const name = this.id.substring(7); // TODO: hack
    // if the user enables/disables the context menu
    // update the pages
    if (name === 'shouldShowBlockElementMenu') {
      backgroundPage.updateButtonUIAndContextMenus();
    }
    if (abpPrefPropertyNames.indexOf(name) >= 0) {
      backgroundPage.Prefs[name] = isEnabled;
      return;
    }

    backgroundPage.setSetting(name, isEnabled, true);

    // if the user enables/disable data collection
    // start or end the data collection process
    if (name === 'data_collection_v2') {
      if (isEnabled) {
        backgroundPage.DataCollectionV2.start();
      } else {
        backgroundPage.DataCollectionV2.end();
      }
    }
    // if the user enables/disable Local CDN
    // start or end the Local CDN
    if (name === 'local_cdn') {
      if (isEnabled) {
        backgroundPage.LocalCDN.start();
      } else {
        backgroundPage.LocalCDN.end();
      }
    }
    // if the user enables/disable YouTube Channel hiding
    // add or remove history state listners
    if (name === 'youtube_channel_whitelist') {
      if (isEnabled) {
        backgroundPage.addYTChannelListeners();
      } else {
        backgroundPage.removeYTChannelListeners();
      }
    }

    // if the user enables Twitch hiding, update the Twitch
    // settings file
    if (name === 'twitch_hiding') {
      if (isEnabled) {
        backgroundPage.getTwitchSettingsFile();
      }
    }

    optionalSettings = backgroundPage.getSettings();
  });
};

const showSeparators = function () {
  const $allGeneralOptions = $('#general-option-list li');
  const $lastVisibleOption = $('#general-option-list li:visible:last');
  $allGeneralOptions.addClass('bottom-line');
  $lastVisibleOption.removeClass('bottom-line');
};

$('#enable_show_advanced_options').on('change', function onAdvancedOptionsChange() {
  // Reload the page to show or hide the advanced options on the
  // options page -- after a moment so we have time to save the option.
  // Also, disable all advanced options, so that non-advanced users will
  // not end up with debug/beta/test options enabled.
  if (!this.checked) {
    $('.advanced input[type=\'checkbox\']:checked').each(function forEachAdvancedOption() {
      backgroundPage.setSetting(this.id.substr(7), false);
    });
  }

  window.setTimeout(() => {
    autoReloadingPage = true;
    window.location.reload();
  }, 50);
});

$(() => {
  initialize();
  showSeparators();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }
  const payInfo = MABPayment.initialize('general');
  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
  }

  MABPayment.displaySyncCTAs();
  $('.sync-cta #get-it-now-general').on('click', MABPayment.userClickedSyncCTA);
  $('.sync-cta #close-sync-cta-general').on('click', MABPayment.userClosedSyncCTA);
  $('a.link-to-tab').on('click', (event) => {
    activateTab($(event.target).attr('href'));
  });
});

const onSettingsChanged = function (name, currentValue, previousValue) {
  const checkBoxElement = $(`#enable_${name}`);
  if (checkBoxElement.length === 1 && checkBoxElement.is(':checked') === previousValue) {
    $(`#enable_${name}`).prop('checked', currentValue);
    if (name === 'show_advanced_options') {
      $('.advanced').toggle(currentValue);
    }
  }
};

settingsNotifier.on('settings.changed', onSettingsChanged);

window.addEventListener('unload', () => {
  settingsNotifier.off('settings.changed', onSettingsChanged);
});

port.postMessage({
  type: 'prefs.listen',
  filter: abpPrefPropertyNames,
});

port.onMessage.addListener((message) => {
  if (message.type === 'prefs.respond') {
    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      $(`#prefs__${name}`).prop('checked', backgroundPage.Prefs[name]);
    }
  }
});

const onSubAdded = function (item) {
  const acceptableAds = backgroundPage.Prefs.subscriptions_exceptionsurl;
  const acceptableAdsPrivacy = backgroundPage.Prefs.subscriptions_exceptionsurl_privacy;

  if (item && item.url === acceptableAds) {
    updateAcceptableAdsUI(true, false);
  } else if (item && item.url === acceptableAdsPrivacy) {
    updateAcceptableAdsUI(true, true);
  }
};
filterNotifier.on('subscription.added', onSubAdded);

const onSubRemoved = function (item) {
  const aa = backgroundPage.Prefs.subscriptions_exceptionsurl;
  const aaPrivacy = backgroundPage.Prefs.subscriptions_exceptionsurl_privacy;
  const aaSubscribed = filterStorage.hasSubscription(aa);
  const aaPrivacySubscribed = filterStorage.hasSubscription(aaPrivacy);

  if (item && item.url === aa && !aaPrivacySubscribed) {
    updateAcceptableAdsUI(false, false);
  } else if (item && item.url === aa && aaPrivacySubscribed) {
    updateAcceptableAdsUI(true, true);
  } else if (item && item.url === aaPrivacy && !aaSubscribed) {
    updateAcceptableAdsUI(false, false);
  } else if (item && item.url === aaPrivacy && aaSubscribed) {
    updateAcceptableAdsUI(true, false);
  }
};
filterNotifier.on('subscription.removed', onSubRemoved);

window.addEventListener('unload', () => {
  filterNotifier.off('subscription.removed', onSubRemoved);
  filterNotifier.off('subscription.added', onSubAdded);
});
