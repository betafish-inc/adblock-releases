'use strict';

var lockedFeatureLogic = function() {

  var wiggleBoxLogic = function() {
    // When the user clicks the frozen slider
    // shake the error message box
    var $errorMessageBox = $("#error-message-box");
    var isWiggling = false;

    $(".lock-switch span.slider").click(function(ev) {
      if (isWiggling === true) {
        return false;
      }
      isWiggling = true;
      $errorMessageBox.addClass("wiggle");
      setTimeout(function() {
        isWiggling = false;
        $errorMessageBox.removeClass("wiggle");
      }, 1000);
    });
  };

  var checkUrlAccesibility = function(callback) {
    // the 'rand' query string parameter is added make the Frame URL unique,
    // to prevent the browser from caching the iframe, and it's contents
    var url = 'https://getadblock.com/myadblock/enrollment/v2?rand=' + (+ new Date());

    if (License && License.isActiveLicense()) {
      return;
    }

    $.ajax({
      type: 'HEAD',
      url: url,
      success: function() {
        displayMyAdBlock('enrolled-free-user-view');
        callback(url);
      },
      error: function() {
        displayMyAdBlock('enrolled-free-user-error-view');
        wiggleBoxLogic();
      }
    });
  };

  var showEnrollmentIframe = function(iframeUrl) {
    var enrolledContent = document.getElementById('enrolled-free-user-view');
    var iframe = document.createElement('iframe');
    iframe.id = "myadblock_wizard_frame";
    iframe.width = "100%";
    iframe.height = "640px";
    iframe.style.border = "solid 0px";
    iframe.src = iframeUrl;
    /*iframe.style.minWidth = '1440px'; // shows horizontal iframe layout*/

    // Append iframe only if it doesn't already exist
    if (enrolledContent && $('#myadblock_wizard_frame').length == 0) {
      enrolledContent.appendChild(iframe);
      window.addEventListener("message", receiveMessage, false);
    }

    function receiveMessage(event)
    {
      if (event.origin !== "https://getadblock.com") {
        return;
      }
      if (event.data && event.data.command === "resize" && event.data.height && event.data.width) {
        $(enrolledContent).animate({ "width" : event.data.width + "px", "height" : event.data.height + "px" }, 400, "linear");
      }
      if (event.data && event.data.command === "openPage" && event.data.url && event.data.url.startsWith('http')) {
        chrome.tabs.create({ url:event.data.url });
      }
      if (event.data && event.data.command === "close") {
        enrolledContent.removeChild(iframe);
      }
    }
  };

  checkUrlAccesibility(showEnrollmentIframe);
}

var paidFeatureLogic = function() {
  var BG = chrome.extension.getBackgroundPage();

  var showFeatureContent = function(isEnabled) {
    $('.feature-view').hide();
    if (isEnabled) {
       $('#pic-replacement-enabled').show()
    } else {
      $('#pic-replacement-disabled').show();
    }
  }

  var loadCurrentSettingsIntoPage = function() {
    var guide = BG.channels.getGuide();
    var myAdBlockIsEnabled = BG.getSettings().picreplacement;

    $('#picReplacementSwitch').prop('checked', myAdBlockIsEnabled);
    showFeatureContent(myAdBlockIsEnabled);

    for (var id in guide) {
      var $channelInput = $(`#${guide[id].name}`);
      var isEnabled = guide[id].enabled;

      $channelInput.prop('checked', isEnabled);
      $channelInput.data('channel-id', id);

      if (isEnabled) {
        $channelInput.parent('.image-box').addClass('selected');
      }
    }
  }

  var updateFeatureSectionAndSettings = function() {
    var isEnabled = $('#picReplacementSwitch').is(':checked');
    if (isEnabled) {
      BG.getSettings().picreplacement = true;
    } else {
      BG.getSettings().picreplacement = false
    }
    showFeatureContent(isEnabled);
  }

  var updateChannelSelectionAndSettings = function(event) {
    var channels = BG.channels;
    var channelId = $(event.target).data('channel-id');
    var enabled = $(event.target).is(":checked");
    var $image = $(event.target).parent('.image-box');

    if (enabled) {
      $image.addClass('selected')
    } else {
      $image.removeClass('selected');
    }

    if (!channelId) {
      return;
    }
    channels.setEnabled(channelId, enabled);
  }

  loadCurrentSettingsIntoPage();
  $('#picReplacementSwitch').change(updateFeatureSectionAndSettings);
  $('input.invisible-overlay').change(updateChannelSelectionAndSettings);
}

$(document).ready(function () {
  localizePage();
  if (!License || $.isEmptyObject(License)) {
    return;
  } else if (License.shouldShowMyAdBlockEnrollment()) {
    lockedFeatureLogic();
  } else if (License.isActiveLicense()) {
    paidFeatureLogic();
  }
});
