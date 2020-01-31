'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, License, localizePage, SyncService, translate, FIVE_SECONDS,
   settingsNotifier, processReplacementChildren, MABPayment, storageSet, storageGet */

const onSyncDataInitialGetError = function () {
  $('#show-name-div').hide();
  $('#last-sync-now').hide();
  SyncService.disableSync();
  SyncService.syncNotifier.off('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);
};

(function onSyncLoaded() {
  let deviceNameArray = [];
  const dateFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  };
  const MAX_NAME_LENGTH = 40;
  let showSyncDetails = true;
  const storedShowSyncDetails = storageGet('showSyncDetails');
  if (storedShowSyncDetails !== undefined) {
    showSyncDetails = storedShowSyncDetails;
  }

  const getAllExtensionNames = function () {
    SyncService.getAllExtensionNames((extensionNameResponse) => {
      if (extensionNameResponse && extensionNameResponse.hasData && extensionNameResponse.data) {
        $('#sync_extension_no_extension_msg').hide();
        $('.extension-name-item').remove();
        deviceNameArray = [];
        const currentExtensionName = SyncService.getCurrentExtensionName();
        if (currentExtensionName) {
          $('#current-extension-name').text(currentExtensionName);
          $('#current-extension-name-block').show();
        }
        for (let inx = 0; inx < extensionNameResponse.data.length; inx++) {
          const deviceInfo = extensionNameResponse.data[inx];
          if (
            deviceInfo
            && deviceInfo.deviceName
            && deviceInfo.deviceName !== currentExtensionName
          ) {
            deviceNameArray.push(deviceInfo.deviceName);
            $('#sync-extension-list-div')
              .append($('<p></p>')
                .text(deviceInfo.deviceName)
                .addClass('extension-name-item'));
          }
        }
        const now = new Date();
        const timestampMsg = translate(
          'sync_device_name_list_updated_at_msg',
          now.toLocaleString(navigator.languages[0], dateFormatOptions),
        );
        $('#last-updated-on').text(timestampMsg);
        if (!deviceNameArray.length && !currentExtensionName) {
          $('#sync_extension_no_extension_msg').show();
        }
      }
    });
  };

  const onLicenseUpdating = function () {
    $('.sync-header-message-text').text(translate('sync_header_message_getting_license'));
    $('#sync-tab-message')
      .removeClass('sync-message-good')
      .addClass('sync-message-hidden');
    $('.sync-header-message')
      .removeClass('sync-message-hidden')
      .addClass('sync-message-good')
      .removeClass('sync-message-error');
  };

  const onLicenseUpdated = function () {
    // eslint-disable-next-line no-use-before-define
    removeSyncListeners();
    window.location.reload();
  };

  const onLicenseUpdatedError = function () {
    // Currently commented out:
    // get error handling beyond the above code is not defined for this version
  };

  const removeSyncListeners = function () {
    // eslint-disable-next-line no-use-before-define
    settingsNotifier.off('settings.changed', onSettingsChanged);
    License.licenseNotifier.off('license.updating', onLicenseUpdating);
    License.licenseNotifier.off('license.updated', onLicenseUpdated);
    License.licenseNotifier.off('license.updated.error', onLicenseUpdatedError);
    SyncService.syncNotifier.off(
      'sync.data.getting.error.initial.fail',
      onSyncDataInitialGetError,
    );
  };

  const showOrHideSyncDetails = function () {
    if (showSyncDetails) {
      $('#toggle-sync-details p').text(translate('hide_details'));
      $('#toggle-sync-details i').text('keyboard_arrow_up');
      $('#sync-box').show();
      $('#sync-title-block').removeClass('details-hidden');
    } else {
      $('#toggle-sync-details p').text(translate('show_details'));
      $('#toggle-sync-details i').text('keyboard_arrow_down');
      $('#sync-box').hide();
      $('#sync-title-block').addClass('details-hidden');
    }
  };

  const documentEventsHandling = () => {
    const observer = new MutationObserver(((mutations) => {
      for (const mutation of mutations) {
        if ($('#sync').is(':visible') && mutation.attributeName === 'style') {
          getAllExtensionNames();
        }
      }
    }));

    const target = document.querySelector('#sync');
    observer.observe(target, {
      attributes: true,
    });

    SyncService.syncNotifier.on('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);

    // Click handlers
    $('#btnCheckStatus').on('click', () => {
      $('#btnCheckStatus').addClass('grey');
      $('#btnCheckStatus').attr('disabled', true);
      License.licenseNotifier.on('license.updating', onLicenseUpdating);
      License.licenseNotifier.on('license.updated', onLicenseUpdated);
      License.licenseNotifier.on('license.updated.error', onLicenseUpdatedError);
      License.updatePeriodically();
    });

    $('#toggle-sync-details').on('click', () => {
      showSyncDetails = !showSyncDetails;
      storageSet('showSyncDetails', showSyncDetails);
      showOrHideSyncDetails();
    });

    $('#btnAddThisExtension').on('click', () => {
      $('#btnAddThisExtension').fadeOut('slow', () => {
        if (deviceNameArray.length === 0) {
          $('#enter-name-div').show();
          $('#btnCancelSyncName').show();
        } else {
          $('#show-verify-message').show();
          $('#verify-overwrite-div').show();
          $('#sync_extension_section_list_title').hide();
        }
      });
    });

    $('#btnVerifyCancel').on('click', () => {
      $('#verify-overwrite-div').fadeOut('slow', () => {
        $('#show-verify-message').hide();
        $('#btnAddThisExtension').show();
        $('#sync_extension_section_list_title').show();
      });
    });

    $('#btnVerifyOK').on('click', () => {
      $('#verify-overwrite-div').fadeOut('slow', () => {
        $('#show-verify-message').hide();
        $('#sync_extension_section_list_title').show();
        $('#enter-name-div').show();
        $('#btnCancelSyncName').show();
      });
    });

    $('#extension-delete-icon').on('click', () => {
      $('#extension-delete-icon').fadeOut('slow', () => {
        $('#extension-delete-block').show();
      });
    });

    $('#extension-delete-cancel').on('click', () => {
      $('#extension-delete-block').fadeOut('slow', () => {
        $('#extension-delete-icon').show();
      });
    });

    $('#extension-delete-button').on('click', () => {
      $('#last-sync-now').hide();
      backgroundPage.setSetting('sync_settings', false);
      SyncService.removeCurrentExtensionName();
      SyncService.disableSync();
      removeSyncListeners();
      $('#current-extension-name-block').fadeOut('slow', () => {
        $('#extension-delete-block').hide();
        $('#extension-delete-icon').show();
        $('#btnAddThisExtension').fadeIn('slow');
      });
      setTimeout(() => {
        getAllExtensionNames();
      }, FIVE_SECONDS); // wait 5 seconds to allow the above remove to complete
    });

    $('#btnSaveSyncName').on('click', () => {
      $('#error-message').text('');
      let extensionName = $('#extension-name').val().trim();
      if (!extensionName) {
        $('#error-message').text(translate('sync_turn_on_invalid_name_text'));
        $('#extension-name').addClass('input-error').removeClass('accent-text');
        return;
      }
      if (extensionName.length > MAX_NAME_LENGTH) {
        extensionName = extensionName.substring(0, MAX_NAME_LENGTH);
      }
      if (deviceNameArray.includes(extensionName)) {
        $('#error-message').text(translate('sync_turn_on_duplicate_name_text'));
        $('#extension-name').addClass('input-error').removeClass('accent-text');
        return;
      }
      $('#extension-name').addClass('accent-text').removeClass('input-error');
      SyncService.setCurrentExtensionName(extensionName);
      SyncService.enableSync(true);
      $('#enter-name-div').fadeOut('slow', () => {
        $('#current-extension-name').text(extensionName);
        $('#current-extension-name-block').show();
        $('#last-sync-now').show();
        $('#sync_extension_no_extension_msg').hide();
        $('#btnCancelSyncName').hide();
      });
      setTimeout(() => {
        getAllExtensionNames();
      }, FIVE_SECONDS); // wait 5 seconds to allow the above 'set' to complete
    });

    $('#btnCancelSyncName').on('click', () => {
      $('#enter-name-div').fadeOut('slow', () => {
        $('#btnCancelSyncName').hide();
        $('#btnAddThisExtension').fadeIn('slow');
      });
    });

    $('#btnSyncNow').on('click', () => {
      setTimeout(() => {
        SyncService.processUserSyncRequest();
      }, 0);
    });
  };

  $(() => {
    if (!License || $.isEmptyObject(License) || !MABPayment) {
      return;
    }

    const payInfo = MABPayment.initialize('sync');
    if (License.shouldShowMyAdBlockEnrollment()) {
      MABPayment.freeUserLogic(payInfo);
    } else if (License.isActiveLicense()) {
      MABPayment.paidUserLogic(payInfo);
    }

    if (License.isActiveLicense() && License.get()) {
      $('#toggle-sync-details').show();
      if (!License.get().licenseId) {
        $('#sync-tab-no-license-message').text(translate('sync_header_message_no_license'));
        $('#sync-tab-message')
          .removeClass('sync-message-hidden')
          .addClass('sync-message-good');
        $('#btnCheckStatus').show();
      } else {
        getAllExtensionNames();
        const currentExtensionName = SyncService.getCurrentExtensionName();
        $('#sync-info-block').show();
        if (currentExtensionName && backgroundPage.getSettings().sync_settings) {
          $('#last-sync-now').show();
          $('#btnAddThisExtension').hide();
        } else {
          $('#btnAddThisExtension').show();
          $('#last-sync-now').hide();
        }
      }
    } else {
      $('#get-sync').attr('href', License.MAB_CONFIG.payURL).show();
    }

    showOrHideSyncDetails();
    documentEventsHandling();
  });

  const onSettingsChanged = function (name, currentValue) {
    if (!$('#sync').is(':visible')) {
      return;
    }
    // if another options page is opened, and a change is made to the sync setting,
    // reload this page
    if (name === 'sync_settings' && currentValue && !$('#current-extension-name-block').is(':visible')) {
      // eslint-disable-next-line no-use-before-define
      removeSyncListeners();
      window.location.reload();
    }
    if (name === 'sync_settings' && !currentValue && $('#current-extension-name-block').is(':visible')) {
      // eslint-disable-next-line no-use-before-define
      removeSyncListeners();
      window.location.reload();
    }
  };

  settingsNotifier.on('settings.changed', onSettingsChanged);

  window.addEventListener('unload', () => {
    removeSyncListeners();
  });
}());
