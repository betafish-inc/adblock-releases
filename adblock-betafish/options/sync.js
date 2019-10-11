'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, License, localizePage, SyncService, translate, FIVE_SECONDS,
   settingsNotifier, processReplacementChildren */

const onSyncDataInitialGetError = function () {
  $('#show-name-div').hide();
  $('#sync-now-div').hide();
  $('#turn-on-div').show();
  SyncService.disableSync();
  SyncService.syncNotifier.off('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);
};

(function onSyncLoaded() {
  let deviceNameArray = [];
  const dateFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  };
  const MAX_NAME_LENGTH = 40;

  $(document).ready(() => {
    localizePage();

    const getAllExtensionNames = function () {
      SyncService.getAllExtensionNames((extensionNameResponse) => {
        if (extensionNameResponse && extensionNameResponse.hasData && extensionNameResponse.data) {
          $('#sync_extension_no_extension_msg').hide();
          $('.extension-name-item').remove();
          deviceNameArray = [];
          for (let inx = 0; inx < extensionNameResponse.data.length; inx++) {
            const deviceInfo = extensionNameResponse.data[inx];
            if (deviceInfo && deviceInfo.deviceName) {
              deviceNameArray.push(deviceInfo.deviceName);
              $('#sync-extension-list-div')
                .append($('<p></p>')
                  .text(deviceInfo.deviceName)
                  .addClass('extension-name-item')
                  .addClass('bottom-line'));
            }
          }
          const now = new Date();
          const timestampMsg = translate(
            'sync_device_name_list_updated_at_msg',
            now.toLocaleString(navigator.languages[0], dateFormatOptions),
          );
          $('#last-updated-on').text(timestampMsg);
          if (!deviceNameArray.length) {
            $('#sync_extension_no_extension_msg').show();
          }
        }
      });
    };

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

    const onLicenseUpdating = function () {
      $('.sync-header-message-text').text(translate('sync_header_message_getting_license'));
      $('.sync-header-error-icon').hide();
      $('.sync-header-message')
        .removeClass('sync-header-message-hidden')
        .addClass('sync-header-message-normal')
        .removeClass('sync-message-error');
    };

    const onSettingsChanged = function (name, currentValue) {
      if (!$('#sync').is(':visible')) {
        return;
      }
      // if another options page is opened, and a change is made to the sync setting,
      // reload this page
      if (name === 'sync_settings' && currentValue && !$('#btnTurnSyncOff').is(':visible')) {
        // eslint-disable-next-line no-use-before-define
        removeSyncListeners();
        window.location.reload();
      }
      if (name === 'sync_settings' && !currentValue && $('#btnTurnSyncOff').is(':visible')) {
        // eslint-disable-next-line no-use-before-define
        removeSyncListeners();
        window.location.reload();
      }
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
      settingsNotifier.off('settings.changed', onSettingsChanged);
      License.licenseNotifier.off('license.updating', onLicenseUpdating);
      License.licenseNotifier.off('license.updated', onLicenseUpdated);
      License.licenseNotifier.off('license.updated.error', onLicenseUpdatedError);
      SyncService.syncNotifier.off(
        'sync.data.getting.error.initial.fail',
        onSyncDataInitialGetError,
      );
    };

    settingsNotifier.on('settings.changed', onSettingsChanged);
    SyncService.syncNotifier.on('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);

    window.addEventListener('unload', () => {
      removeSyncListeners();
    });

    $('#btnCheckStatus').click(() => {
      $('#btnCheckStatus').removeClass('red').addClass('grey');
      $('#btnCheckStatus').attr('disabled', true);
      License.licenseNotifier.on('license.updating', onLicenseUpdating);
      License.licenseNotifier.on('license.updated', onLicenseUpdated);
      License.licenseNotifier.on('license.updated.error', onLicenseUpdatedError);
      License.updatePeriodically();
    });

    $('#btnTurnSyncOn').click(() => {
      $('#turn-on-div').fadeOut('slow', () => {
        if (deviceNameArray.length === 0) {
          $('#error-message').text('');
          $('#enter-name-div').show();
          $('#enter-name-sub-div').css('display', 'flex');
        } else {
          $('#verify-overwrite-div').css('display', 'flex');
        }
      });
    });

    $('#btnVerifyCancel').click(() => {
      $('#verify-overwrite-div').fadeOut('slow', () => {
        $('#btnTurnSyncOn').addClass('red');
        $('#turn-on-div').fadeIn('slow');
      });
    });

    $('#btnVerifyOK').click(() => {
      $('#verify-overwrite-div').fadeOut('slow', () => {
        $('#error-message').text('');
        $('#enter-name-div').show();
        $('#enter-name-sub-div').css('display', 'flex');
      });
    });

    $('#btnTurnSyncOff').click(() => {
      const currentExtensionName = SyncService.getCurrentExtensionName();
      $(`p:contains("${currentExtensionName}")`).remove();
      $('#sync-now-div').hide();
      backgroundPage.setSetting('sync_settings', false);
      SyncService.removeCurrentExtensionName();
      SyncService.disableSync();
      removeSyncListeners();
      setTimeout(() => {
        getAllExtensionNames();
      }, FIVE_SECONDS); // wait 5 seconds to allow the above remove to complete
      $('#show-name-div').fadeOut('slow', () => {
        $('#error-message').text('');
        $('#btnTurnSyncOn').addClass('red');
        $('#turn-on-div').fadeIn('slow');
        $('#extension-name').val('');
      });
    });

    $('#btnSaveSyncName').click(() => {
      $('#error-message').text('');
      let extensionName = $('#extension-name').val().trim();
      if (!extensionName) {
        $('#error-message').text(translate('sync_turn_on_invalid_name_text'));
        return;
      }
      if (extensionName.length > MAX_NAME_LENGTH) {
        extensionName = extensionName.substring(0, MAX_NAME_LENGTH);
      }
      if (deviceNameArray.includes(extensionName)) {
        $('#error-message').text(translate('sync_turn_on_duplicate_name_text'));
        return;
      }
      SyncService.setCurrentExtensionName(extensionName);
      SyncService.enableSync(true);
      $('#enter-name-div').fadeOut('slow', () => {
        processReplacementChildren($('#show-name-message'), extensionName, 'sync_show_name_text');
        $('#show-name-div').show();
        $('#sync-now-div').show();
      });
      setTimeout(() => {
        getAllExtensionNames();
      }, FIVE_SECONDS); // wait 5 seconds to allow the above 'set' to complete
    });

    $('#btnCancelSyncName').click(() => {
      $('#enter-name-div').fadeOut('slow', () => {
        $('#turn-on-div').fadeIn('slow');
        $('#btnTurnSyncOn').addClass('red');
      });
    });

    $('#btnSyncNow').click(() => {
      setTimeout(() => {
        SyncService.processUserSyncRequest();
      }, 0);
    });

    if (License.isActiveLicense() && License.get() && !License.get().licenseId) {
      $('#sync-tab-no-license-message').text(translate('sync_header_message_no_license'));
      $('.sync-tab-message')
        .removeClass('sync-tab-message-hidden')
        .addClass('sync-tab-message-normal');
      $('#no-license-div').show();
    } else if (License.isActiveLicense() && License.get() && License.get().licenseId) {
      getAllExtensionNames();
      const currentExtensionName = SyncService.getCurrentExtensionName();
      if (currentExtensionName && backgroundPage.getSettings().sync_settings) {
        const $nameMessageEl = $('#show-name-message');
        processReplacementChildren($nameMessageEl, currentExtensionName, 'sync_show_name_text');
        $('#show-name-div').show();
        $('#sync-now-div').show();
        return;
      }
      $('#turn-on-div').show();
    }
  });
}());
