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
/* global parseUri, settings:true, abpPrefPropertyNames, settingsNotifier, SubscriptionAdapter,
   DownloadableSubscription, Subscription, Prefs, synchronizer, filterStorage, filterNotifier,
   updateAcceptableAdsUI, activateTab, MABPayment, License, autoReloadingPage:true,
   updateAcceptableAdsUIFN, initializeProxies, prefsNotifier,
   SubscriptionsProxy, DataCollectionV2, browser, LocalCDN, send */

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
const initialize = async function init() {
  let isLocalCDNAvailable = await send('LocalCDN.isAvailable');
  if (isLocalCDNAvailable) {
    $('#local_cdn_option').css('display', 'flex');
  }
  const subs = await SubscriptionAdapter.getSubscriptionsMinusText();

  // if the user is currently subscribed to AA
  // then 'check' the acceptable ads button.
  if ('acceptable_ads' in subs && subs.acceptable_ads.subscribed) {
    updateAcceptableAdsUIFN(true, false);
  }

  if ('acceptable_ads_privacy' in subs && subs.acceptable_ads_privacy.subscribed) {
    updateAcceptableAdsUIFN(true, true);
  }

  for (const name in settings) {
    $(`#enable_${name}`).prop('checked', settings[name]);
  }
  if (!settings.show_advanced_options) {
    $('.advanced').hide();
  }
  if (!settings.youtube_manage_subscribed) {
    $('#youtube_manage_subscribed_link').removeClass('link-text-color');
    $('#youtube_manage_subscribed_link').removeClass('pointer');
    $('#youtube_manage_subscribed_link').addClass('disabled-link-text-color');
  }

  for (const inx in abpPrefPropertyNames) {
    const name = abpPrefPropertyNames[inx];
    $(`#prefs__${name}`).prop('checked', Prefs[name]);
  }

  const acceptableAdsPrivacyClicked = async function (isEnabled) {
    if (isEnabled) {
      await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
      await SubscriptionsProxy.sync(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
      if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_URL)) {
        SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      }
      updateAcceptableAdsUI(true, true);
    } else {
      await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      await SubscriptionsProxy.sync(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL)) {
        SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
      }
      updateAcceptableAdsUI(true, false);
    }
  };

  const acceptableAdsClicked = async function (isEnabled) {
    if (isEnabled) {
      await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      await SubscriptionsProxy.sync(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      updateAcceptableAdsUI(true, false);
    } else {
      if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_URL)) {
        SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
      }
      if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL)) {
        SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
      }
      updateAcceptableAdsUI(false, false);
    }
  };

  $('input.feature[type=\'checkbox\']').on('change', async function onOptionSelectionChange() {
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
      send('updateButtonUIAndContextMenus');
    }
    if (abpPrefPropertyNames.indexOf(name) >= 0) {
      Prefs[name] = isEnabled;
      return;
    }
    settings[name] = isEnabled;

    // if the user enables/disable data collection
    // start or end the data collection process
    if (name === 'data_collection_v2') {
      if (isEnabled) {
        DataCollectionV2.start();
      } else {
        DataCollectionV2.end();
      }
    }
    // if the user enables/disable Local CDN
    // start or end the Local CDN
    isLocalCDNAvailable = await send('LocalCDN.isAvailable');
    if (isLocalCDNAvailable && name === 'local_cdn') {
      if (isEnabled) {
        LocalCDN.start();
      } else {
        LocalCDN.end();
      }
    }
    // if the user enables/disable YouTube Channel allowlisting
    // add or remove history state listners
    if (name === 'youtube_channel_whitelist') {
      if (isEnabled) {
        send('addYTChannelListeners');
      } else {
        window.setTimeout(() => {
          settings.youtube_manage_subscribed = isEnabled;
          $('#youtube_manage_subscribed_link').removeClass('link-text-color');
          $('#youtube_manage_subscribed_link').removeClass('pointer');
          $('#youtube_manage_subscribed_link').addClass('disabled-link-text-color');
        }, 250);
        send('removeYTChannelListeners');
      }
    }

    // if the user enables/disable the Manage AdBlock settings from YouTube™ subscriptions page
    // also, wait a moment to allow the current 'set' to save,
    // then enable YouTube Channel allowlisting
    if (name === 'youtube_manage_subscribed') {
      if (isEnabled && !settings.youtube_channel_whitelist) {
        window.setTimeout(() => {
          settings.youtube_manage_subscribed = isEnabled;
          send('addYTChannelListeners');
        }, 250);
      }
      if (!isEnabled) {
        $('#youtube_manage_subscribed_link').removeClass('link-text-color');
        $('#youtube_manage_subscribed_link').removeClass('pointer');
        $('#youtube_manage_subscribed_link').addClass('disabled-link-text-color');
      } else {
        $('#youtube_manage_subscribed_link').addClass('link-text-color');
        $('#youtube_manage_subscribed_link').addClass('pointer');
        $('#youtube_manage_subscribed_link').removeClass('disabled-link-text-color');
      }
    }

    // if the user enables/disable Twitch Channel allow listing
    // add or remove listners
    if (name === 'twitch_channel_allowlist') {
      if (isEnabled) {
        send('addTwitchAllowlistListeners');
      } else {
        send('removeTwitchAllowlistListeners');
      }
    }
  });

  $('#youtube_manage_subscribed_link').on('click', () => {
    if (settings.youtube_manage_subscribed) {
      send('openYTManagedSubPage');
    }
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
      settings[this.id.substr(7)] = false;
    });
  }

  window.setTimeout(() => {
    autoReloadingPage = true;
    window.location.reload();
  }, 50);
});

$(async () => {
  await initializeProxies();
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

const onPrefsChannged = function (name, currentValue) {
  $(`#prefs__${name}`).prop('checked', currentValue);
};

prefsNotifier.on('prefs.changed', onPrefsChannged);

const onSubAdded = function (items) {
  let item = items;
  if (Array.isArray(items)) {
    [item] = items;
  }
  const acceptableAds = SubscriptionsProxy.ACCEPTABLE_ADS_URL;
  const acceptableAdsPrivacy = SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL;

  if (item && item.url === acceptableAds) {
    updateAcceptableAdsUI(true, false);
  } else if (item && item.url === acceptableAdsPrivacy) {
    updateAcceptableAdsUI(true, true);
  }
};
SubscriptionsProxy.onAdded.addListener(onSubAdded);

const onSubRemoved = async function (items) {
  let item = items;
  if (Array.isArray(items)) {
    [item] = items;
  }
  const aa = SubscriptionsProxy.ACCEPTABLE_ADS_URL;
  const aaPrivacy = SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL;
  const aaSubscribed = await SubscriptionsProxy.has(aa);
  const aaPrivacySubscribed = await SubscriptionsProxy.has(aaPrivacy);

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
SubscriptionsProxy.onRemoved.addListener(onSubRemoved);
