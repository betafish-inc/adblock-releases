// Handle incoming clicks from bandaids.js & '/installed'
try
{
  if (parseUri.parseSearch(location.search).aadisabled === 'true')
  {
    $('#acceptable_ads_info').show();
  }
}
catch (ex)
{}

// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
$(function () {
  var subs = backgroundPage.getSubscriptionsMinusText();

  //if the user is currently subscribed to AA
  //then 'check' the acceptable ads button.
  if ('acceptable_ads' in subs && subs.acceptable_ads.subscribed) {
    $('#acceptable_ads').prop('checked', true);
  }

  for (var name in optionalSettings) {
    $('#enable_' + name).prop('checked', optionalSettings[name]);
  }

  var abpPrefs = ['show_statsinicon', 'shouldShowBlockElementMenu', 'show_statsinpopup', 'show_devtools_panel'];
  for (var inx in abpPrefs) {
    var name = abpPrefs[inx];
    $('#prefs__' + name).prop('checked', backgroundPage.Prefs[name]);
  }

  $('input.feature[type=\'checkbox\']').change(function () {
    var isEnabled = $(this).is(':checked');
    if (this.id === 'acceptable_ads') {
      acceptableAdsClicked(isEnabled);
      return;
    }

    var name = this.id.substring(7); // TODO: hack
    // if the user enables/disables the context menu
    // update the pages
    if (name === 'shouldShowBlockElementMenu') {
      backgroundPage.updateButtonUIAndContextMenus();
    }
    if (abpPrefs.indexOf(name) >= 0) {
      backgroundPage.Prefs[name] = isEnabled;
      return;
    }

    backgroundPage.setSetting(name, isEnabled, true);

    // Rebuild filters, so matched filter text is returned
    // when using resource viewer page
    if (name === 'show_advanced_options') {
      backgroundPage.updateFilterLists();
    }
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
        backgroundPage.addYouTubeHistoryStateUpdateHanlder();
      } else {
        backgroundPage.removeYouTubeHistoryStateUpdateHanlder();
      }
    }

    optionalSettings = backgroundPage.getSettings();
  });
});

var acceptableAdsClicked = function (isEnabled)
{
  var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
  if (isEnabled)
  {
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription)
    {
      Synchronizer.execute(subscription);
    }
    $('#acceptable_ads_info').slideUp();
  } else
  {
    FilterStorage.removeSubscription(subscription);
    $('#acceptable_ads_info').slideDown();
  }
};

$('#enable_show_advanced_options').change(function ()
{
  // Reload the page to show or hide the advanced options on the
  // options page -- after a moment so we have time to save the option.
  // Also, disable all advanced options, so that non-advanced users will
  // not end up with debug/beta/test options enabled.
  if (!this.checked)
  {
    $('.advanced input[type=\'checkbox\']:checked').each(function ()
    {
      backgroundPage.setSetting(this.id.substr(7), false);
    });
  }

  window.setTimeout(function ()
  {
    window.location.reload();
  }, 50);
});

function showSeparators() {
  let $allGeneralOptions = $("#general-option-list li");
  let $lastVisibleOption = $("#general-option-list li:visible:last");

  $allGeneralOptions.addClass('bottom-line');
  $lastVisibleOption.removeClass('bottom-line');
};

$(document).ready(function() {
  showSeparators();
});
