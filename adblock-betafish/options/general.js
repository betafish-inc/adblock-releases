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
$(function ()
{

  var subs = backgroundPage.getSubscriptionsMinusText();

  //if the user is currently subscribed to AA
  //then 'check' the acceptable ads button.
  if ('acceptable_ads' in subs &&
    subs.acceptable_ads.subscribed)
  {
    $('#acceptable_ads').prop('checked', true);
  }

  for (var name in optionalSettings)
  {
    $('#enable_' + name).prop('checked', optionalSettings[name]);
  }

  var abpPrefs = ['show_statsinicon', 'shouldShowBlockElementMenu', 'show_statsinpopup'];
  for (var inx in abpPrefs) {
    var name = abpPrefs[inx];
    $('#prefs__' + name).prop('checked', backgroundPage.Prefs[name]);
  }

  //uncheck any incompatible options with the new safari content blocking, and then hide them
  if (optionalSettings &&
      optionalSettings.safari_content_blocking)
  {
    $('.exclude_safari_content_blocking > input').each(function (index)
    {
      $(this).prop('checked', false);
    });

    $('.exclude_safari_content_blocking').hide();
  }

  $('input.feature[type=\'checkbox\']').change(function ()
  {
    var isEnabled = $(this).is(':checked');
    if (this.id === 'acceptable_ads')
    {
      acceptableAdsClicked(isEnabled);
      return;
    }

    var name = this.id.substring(7); // TODO: hack
    if (abpPrefs.indexOf(name) >= 0) {
      backgroundPage.Prefs[name] = isEnabled;
      return;
    }

    backgroundPage.setSetting(name, isEnabled, true);

    // Rebuild filters, so matched filter text is returned
    // when using resource viewer page
    if (name === 'show_advanced_options')
    {
      backgroundPage.updateFilterLists();
    }
    // if the user enables/disable data collection
    // start or end the data collection process
    if (name === 'data_collection')
    {
      if (isEnabled)
      {
        backgroundPage.DataCollection.start();
      }
      else
      {
        backgroundPage.DataCollection.end();
      }
    }
    // if the user enables/disable YouTube Channel hiding
    // add or remove history state listners
    if (name === 'youtube_channel_whitelist')
    {
      if (isEnabled)
      {
        backgroundPage.addYouTubeHistoryStateUpdateHanlder();
      }
      else
      {
        backgroundPage.removeYouTubeHistoryStateUpdateHanlder();
      }
    }

    optionalSettings = backgroundPage.getSettings();
  });

  //if safari content blocking is available...
  //  - display option to user
  //  - check if any messages need to be displayed
  //  - add a listener to process any messages
  var response = backgroundPage.isSafariContentBlockingAvailable();
  if (response)
  {
    $('#safari_content_blocking').show();
    getSafariContentBlockingMessage();

    //once the filters have been updated see if there's an update to the message.
    chrome.extension.onRequest.addListener(function (request, sender, sendResponse)
    {
      if (request.command !== 'contentblockingmessageupdated')
      {
        return;
      }

      getSafariContentBlockingMessage();
      sendResponse({});
    });
  }
});

var acceptableAdsClicked = function (isEnabled)
{
  var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);

  // simulate a click on the AA Checkbox on the Filters tab
  var $checkbox = $('#adblock_filter_list_0');
  $checkbox.prop('checked', isEnabled);
  $checkbox.trigger('change');
  if (isEnabled)
  {
    $('#acceptable_ads_info').slideUp();
  } else
  {
    $('#acceptable_ads_info').slideDown();
  }

  // If the user has Safari content blocking enabled, then update the filter lists when
  // a user subscribes to AA
  optionalSettings = backgroundPage.getSettings();
  if (optionalSettings &&
      optionalSettings.safari_content_blocking)
  {
    backgroundPage.updateFilterLists();
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

$('#enable_safari_content_blocking').change(function ()
{
  var isEnabled = $(this).is(':checked');
  if (isEnabled)
  {
    $('.exclude_safari_content_blocking').hide();
    $('#safari_content_blocking_bmessage').text('');

    // message to users on the Custom tab
    $('#safariwarning').text(translate('contentblockingwarning')).show();

    // uncheck any incompatable options, and then hide them
    $('.exclude_safari_content_blocking > input').each(function (index)
    {
      $(this).prop('checked', false);
    });
  } else
  {
    $('.exclude_safari_content_blocking').show();
    $('#safari_content_blocking_bmessage').text(translate('browserestartrequired')).show();

    // message to users on the Custom tab
    $('#safariwarning').text('').hide();
  }

  backgroundPage.setContentScripts();
  backgroundPage.updateFilterLists();
});

function getSafariContentBlockingMessage()
{
  backgroundPage.sessionstorage_get('contentblockingerror', function (messagecode)
  {
    //if the message exists, it should already be translated.
    if (messagecode)
    {
      $('#safari_content_blocking_bmessage').text(messagecode).show();
    } else
    {
      $('#safari_content_blocking_bmessage').text('').hide();
    }
  });
}
