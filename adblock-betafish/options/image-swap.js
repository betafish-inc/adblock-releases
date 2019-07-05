'use strict';

(function(){
  const updateUI = function() {
    let $selected = $('.image-box.selected');
    let $sectionCard = $('#image-swap-selection');
    if ($selected.length) {
      $sectionCard.addClass('shadow').removeClass('hover-shadow');
    } else {
      $sectionCard.removeClass('shadow').addClass('hover-shadow');
    }
  }
  const updatePicReplacementSetting = function() {
    const $selected = $('.image-box.selected');
    let picReplacementEnabled = !!$selected.length;

    backgroundPage.setSetting('picreplacement', picReplacementEnabled);
  }
  const loadCurrentSettingsIntoPage = function() {
    let guide = backgroundPage.channels.getGuide();
    const picReplacementEnabled = backgroundPage.getSettings().picreplacement;

    for (let id in guide) {
      let $channelInput = $(`#${guide[id].name}`);
      let isEnabled = guide[id].enabled && picReplacementEnabled;

      $channelInput.prop('checked', isEnabled);
      $channelInput.data('channel-id', id);

      if (isEnabled) {
        $channelInput.parent('.image-box').addClass('selected');
      }

      if (!picReplacementEnabled && guide[id].enabled) {
        channels.setEnabled(id, false);
      }
    }
    updateUI();
  }
  const updateChannelSelection = function(event) {
    let channels = backgroundPage.channels;
    const $eventTarget = $(event.target);
    let channelId = $eventTarget.data('channel-id');
    let enabled = $eventTarget.is(":checked");
    let $image = $eventTarget.parent('.image-box');

    if (enabled) {
      $image.addClass('selected');
    } else {
      $image.removeClass('selected');
      updatePicReplacementSetting();
    }

    if (!channelId) {
      return;
    }
    channels.setEnabled(channelId, enabled);
    updatePicReplacementSetting();
    updateUI();
  }

  $(document).ready(function () {
    localizePage();

    if (!License || $.isEmptyObject(License)) {
      return;
    }

    loadCurrentSettingsIntoPage();
    $('input.invisible-overlay').change(updateChannelSelection);
  });
})();
