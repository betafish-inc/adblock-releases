'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, channelsNotifier, License, localizePage */


(function onImageSwapLoaded() {
  const { channels } = backgroundPage;

  const updateUI = function () {
    const $selected = $('.image-box.selected');
    const $sectionCard = $('#image-swap-selection');
    if ($selected.length) {
      $sectionCard.addClass('shadow').removeClass('hover-shadow');
    } else {
      $sectionCard.removeClass('shadow').addClass('hover-shadow');
    }
  };
  const updatePicReplacementSetting = function () {
    const $selected = $('.image-box.selected');
    const picReplacementEnabled = !!$selected.length;

    backgroundPage.setSetting('picreplacement', picReplacementEnabled);
  };
  const loadCurrentSettingsIntoPage = function () {
    const guide = backgroundPage.channels.getGuide();
    const picReplacementEnabled = backgroundPage.getSettings().picreplacement;

    for (const id in guide) {
      const $channelInput = $(`#${guide[id].name}`);
      const isEnabled = guide[id].enabled && picReplacementEnabled;

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
  };
  const updateChannelSelection = function (event) {
    const $eventTarget = $(event.target);
    const channelId = $eventTarget.data('channel-id');
    const enabled = $eventTarget.is(':checked');
    const $image = $eventTarget.parent('.image-box');

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
  };

  $(document).ready(() => {
    localizePage();

    if (!License || $.isEmptyObject(License)) {
      return;
    }

    loadCurrentSettingsIntoPage();
    $('input.invisible-overlay').change(updateChannelSelection);

    const onChannelsChanged = function (id, currentValue, previousValue) {
      const guide = backgroundPage.channels.getGuide();
      const $channelInput = $(`#${guide[id].name}`);
      if ($channelInput.is(':checked') === previousValue) {
        $channelInput.click();
      }
    };

    window.addEventListener('unload', () => {
      channelsNotifier.off('channels.changed', onChannelsChanged);
    });

    channelsNotifier.on('channels.changed', onChannelsChanged);
  });
}());
