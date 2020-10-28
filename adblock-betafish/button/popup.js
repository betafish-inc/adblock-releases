'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, translate, storageGet, localizePage, storageSet,
  selected, selectedOnce, showHelpSetupPage, i18nJoin */

let errorOccurred = false;

const processError = function (err, stack, message) {
  const errorPayload = {
    u: 'unknown',
    f: 'e',
    o: 'unknown',
    l: 'unknown',
    t: 'error',
    st: 'popupmenu',
  };

  const sendErrorPayload = function () {
    const payload = { event: 'error', payload: errorPayload };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://log.getadblock.com/v2/record_log.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify(payload));
  };

  // the translation messages are hard code in the JS to avoid any dependency
  // on Chrome extension APIs during error handling
  const translateErrorMsg = function (key) {
    const text = {
      error_msg_header: {
        en: "Oops! We're sorry, the AdBlock menu had trouble loading.",
      },
      error_msg_help_us: {
        en: 'Help us resolve this problem by sending us some debug data: Click ',
      },
      error_msg_thank_you: {
        en: 'Thank you',
      },
      error_msg_reload: {
        en: 'Next, try reloading the extension: Click ',
      },
      error_msg_help: {
        en: "If that doesn't work, check here for more help: Click ",
      },
      error_msg_here: {
        en: 'here',
      },
    };
    const locale = navigator.language.substring(0, 2);
    const msg = text[key] || {};
    return msg[locale] || msg.en;
  };

  errorOccurred = true;
  errorPayload.msg = err.message || message || 'no message';
  errorPayload.src = err.source || stack || 'no source';
  errorPayload.line = err.lineno || 'anywhere';
  errorPayload.col = err.colno || 'anywhere';
  errorPayload.err = err.error || 'no error';
  if (typeof err === 'string') {
    errorPayload.msg = err;
  }
  const errorMsgDiv = document.getElementById('div_status_error');
  if (errorMsgDiv) {
    selectedOnce(document.getElementById('errorreport'), () => {
      sendErrorPayload();
      const firstMsg = document.getElementById('first_msg');
      firstMsg.style.display = 'none';
      const secondMsg = document.getElementById('second_msg');
      secondMsg.style.display = 'block';
    });

    const reloadAnchor = document.getElementById('reload');
    if (browser && browser.runtime && browser.runtime.reload) {
      selectedOnce(reloadAnchor, () => {
        try {
          browser.runtime.reload();
        } catch (e) {
          const reloadMsg = document.getElementById('reload_msg');
          if (reloadMsg) {
            reloadMsg.style.display = 'none';
          }
          const thirdMsg = document.getElementById('third_msg');
          if (thirdMsg) {
            thirdMsg.style.display = 'block';
          }
        }
      });
    } else {
      reloadAnchor.style.display = 'none';
    }

    document.querySelectorAll('.menu-entry').forEach((el) => {
      const elem = el;
      elem.style.display = 'none';
    });

    document.querySelectorAll('.separator').forEach((el) => {
      const elem = el;
      elem.style.display = 'none';
    });

    const headerIconsDiv = document.getElementById('header-icons');
    if (headerIconsDiv) {
      headerIconsDiv.style.display = 'none';
    }

    const divSlideoutDiv = document.getElementById('div_slideout');
    if (divSlideoutDiv) {
      divSlideoutDiv.style.display = 'none';
    }

    document.querySelectorAll("*[i18n_error^='error_msg']").forEach((el) => {
      const elem = el;
      elem.innerText = translateErrorMsg(elem.getAttribute('i18n_error'));
    });

    errorMsgDiv.style.display = 'block';
  }
};

// the tab/page object, which contains |id| and |url| of
// the current tab
let pageInfo = null;

try {
  const popupMenuCtaClosedKey = 'popup_menu_cta_closed';
  const showPopupMenuThemesCtaKey = 'popup_menu_themes_cta';
  const userClosedCta = storageGet(popupMenuCtaClosedKey);
  const showThemesCTA = storageGet(showPopupMenuThemesCtaKey);
  const shown = {};

  browser.runtime.sendMessage({ command: 'cleanUpSevenDayAlarm' });
  browser.runtime.sendMessage({ command: 'showIconBadgeCTA', value: false });

  let popupMenuTheme = 'default_theme';
  const themeCTA = '';
  let itemClicked = false;

  const show = function (elementIds) {
    elementIds.forEach((elementId) => {
      shown[elementId] = true;
    });
  };

  const hide = function (elementIds) {
    elementIds.forEach((elementId) => {
      shown[elementId] = false;
    });
  };

  $(() => {
    // We needed to reload popover in Safari, so that we could
    // update popover according to the status of AdBlock.
    // We don't need to reload popup in Chrome because Chrome
    // reloads every time the popup for us.
    // Leaving the behavior centralized just in case Chrome changes.
    function closeAndReloadPopup() {
      itemClicked = true;
      window.close();
    }

    try {
      // For better accessibility on pause/resume actions
      let ariaLabel = i18nJoin('pause_on_this_site', 'adblock_will_pause_on_this_site');
      $('#div_domain_pause_adblock').attr('aria-label', ariaLabel);
      ariaLabel = i18nJoin('pause_on_all_sites', 'adblock_will_pause_on_all_sites');
      $('#div_pause_adblock').attr('aria-label', ariaLabel);
      ariaLabel = i18nJoin('resume_blocking_ads_period', 'adblock_will_block_ads_again');
      $('#div_domain_paused_adblock').attr('aria-label', ariaLabel);
      $('#div_paused_adblock').attr('aria-label', ariaLabel);

      localizePage();

      // Set menu entries appropriately for the selected tab.
      $('.menu-entry, .menu-status, .separator').hide();
      browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'popup_opened' });
      let tabId;
      if (document.location.search && document.location.search.indexOf('tabId') > 0) {
        const params = new URLSearchParams(document.location.search);
        tabId = params.get('tabId');
      }
      browser.runtime.sendMessage({ command: 'getCurrentTabInfo', tabId }).then((info) => {
        if (info) {
          try {
            if (info.settings) {
              popupMenuTheme = info.settings.color_themes.popup_menu;
            }
            $('body').attr('id', popupMenuTheme).data('theme', popupMenuTheme);
            $('.header-logo').attr('src', `icons/${popupMenuTheme}/logo.svg`);

            if (info && info.errorStr) {
              processError(info.errorStr, info.stack, info.message);
              return;
            }
            $(window).on('unload', () => {
              if (!itemClicked) {
                browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'popup_closed' });
              }
            });

            // Cache response object for later use
            pageInfo = info;
            try {
              pageInfo.url = new URL(info.url);
            } catch (err) {
              pageInfo.url = null;
            }

            show(['svg_options']);
            if (info.paused) {
              show(['div_status_paused', 'separator0', 'div_paused_adblock', 'svg_options', 'help_link']);
            } else if (info.domainPaused) {
              show(['div_status_domain_paused', 'separator0', 'div_domain_paused_adblock', 'svg_options', 'help_link']);
            } else if (info.disabledSite) {
              show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
            } else if (info.whitelisted) {
              show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
            } else {
              show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'separator3', 'separator4', 'svg_options', 'block_counts', 'help_link']);

              $('#page_blocked_count').text(info.blockCountPage.toLocaleString());
              $('#total_blocked_count').text(info.blockCountTotal.toLocaleString());
            }

            const disabledOrWhitelisted = info.disabledSite || !info.whitelisted;
            const eligibleForUndo = !info.paused && !info.domainPaused && disabledOrWhitelisted;
            if (eligibleForUndo && info.customFilterCount) {
              show(['div_undo', 'separator0']);
            }

            if (
              pageInfo.url
              && /ab_channel/.test(pageInfo.url.href)
              && (
                (pageInfo.url.hostname === 'www.twitch.tv' && info.twitchChannelName)
             || (pageInfo.url.hostname === 'www.youtube.com' && info.youTubeChannelName)
              )
            ) {
              if (eligibleForUndo) {
                show(['div_whitelist_channel']);
              } else if (info.whitelisted) {
                $('#div_enable_adblock_on_this_page').text(translate('enable_adblock_on_this_channel'));
              }
            }
            if (
              pageInfo.url
              && pageInfo.url.hostname === 'www.youtube.com'
              && pageInfo.url.pathname !== '/feed/channels'
              && info.settings.youtube_manage_subscribed
            ) {
              show(['div_manage_subscribed_channel']);
            }

            if (browser.runtime && browser.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
              show(['div_status_beta']);
            }

            // Premium CTAs
            if (info.showMABEnrollment && userClosedCta && showThemesCTA) {
              show(['div_premium_themes_cta']);
              $('#div_premium_themes_cta').attr('data-theme-cta', info.popupMenuThemeCTA);
              browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'premium_themes_cta_seen', additionalParams: { theme: info.popupMenuThemeCTA.replace('_theme', '') } });
            } else if (info.showMABEnrollment && !userClosedCta) {
              show(['div_myadblock_enrollment_v2', 'separator-1', 'separator-2']);
            }

            if (info.activeLicense === true) {
              $('#premium_status_msg').css('display', 'inline-flex');
            }

            if (shown.block_counts && info.showStatsInPopup) {
              hide(['separator-1']);
            } else if (info.disabledSite || info.whitelisted) {
              hide(['separator-2']);
            }

            if (
              info.settings.sync_settings
              && info.lastGetStatusCode === 400
              && info.lastGetErrorResponse
              && info.lastGetErrorResponse.code === 'invalid_sync_version'
            ) {
              show(['div_sync_outofdate_error_msg']);
              browser.runtime.sendMessage({ command: 'resetLastGetStatusCode' }); // reset the code, so it doesn't show again.
              browser.runtime.sendMessage({ command: 'resetLastGetErrorResponse' }); // reset the code, so it doesn't show again.
            } else if (
              (info.lastPostStatusCode >= 400 || info.lastPostStatusCode === 0)
              && info.settings.sync_settings
            ) {
              show(['div_sync_error_msg']);
              browser.runtime.sendMessage({ command: 'resetLastPostStatusCode' }); // reset the code, so it doesn't show again.
            } else {
              hide(['div_sync_error_msg']);
            }

            if (errorOccurred) {
              return;
            }
            for (const div in shown) {
              if (shown[div]) {
                $(`#${div}`).show();
              }
            }

            if (
              !info.showStatsInPopup
              || info.paused
              || info.domainPaused
              || info.disabledSite
              || info.whitelisted
            ) {
              $('#block_counts').hide();
            }

            // Add padding at the end of the Pop-up menu
            $('.menu-entry:not(.premium-cta):visible').last().addClass('last-item');
          } catch (err) {
            processError(err);
          }
        }
      });

      // Click handlers
      selected('#bugreport', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'bugreport_clicked' });
        const supportURL = 'https://help.getadblock.com/support/tickets/new';
        browser.runtime.sendMessage({ command: 'openTab', urlToOpen: supportURL }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('.header-logo', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'titletext_clicked' });
        const homepageURL = 'https://getadblock.com/';
        browser.runtime.sendMessage({ command: 'openTab', urlToOpen: homepageURL }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#div_enable_adblock_on_this_page', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'enable_adblock_clicked' });
        if (pageInfo.url) {
          browser.runtime.sendMessage({ command: 'tryToUnwhitelist', url: pageInfo.url.href }).then((response) => {
            if (response.unwhitelisted) {
              browser.tabs.reload();
              closeAndReloadPopup();
            } else {
              $('#div_status_whitelisted').replaceWith(translate('disabled_by_filter_lists'));
            }
          });
        }
      });

      selected('#div_paused_adblock', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'unpause_clicked' });
        browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: false }).then(() => {
          browser.runtime.sendMessage({ command: 'updateButtonUIAndContextMenus' }).then(() => {
            closeAndReloadPopup();
          });
        });
      });

      selected('#div_domain_paused_adblock', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'domain_unpause_clicked' });
        if (pageInfo.url) {
          browser.runtime.sendMessage({ command: 'adblockIsDomainPaused', activeTab: { url: pageInfo.url.href, id: pageInfo.id }, newValue: false }).then(() => {
            browser.runtime.sendMessage({ command: 'updateButtonUIAndContextMenus' }).then(() => {
              closeAndReloadPopup();
            });
          });
        }
      });

      selected('#div_undo', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'undo_clicked' });
        if (pageInfo.url) {
          const host = pageInfo.url.hostname;
          browser.runtime.sendMessage({ command: 'confirmRemovalOfCustomFiltersOnHost', host, activeTabId: pageInfo.id }).then(() => {
            closeAndReloadPopup();
          });
        }
      });

      selected('#div_whitelist_channel', () => {
        if (pageInfo.url && pageInfo.url.hostname === 'www.youtube.com') {
          browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'whitelist_youtube_clicked' });
          browser.runtime.sendMessage({ command: 'createWhitelistFilterForYoutubeChannel', url: pageInfo.url.href }).then(() => {
            closeAndReloadPopup();
            browser.tabs.reload();
          });
        } else if (pageInfo.url && pageInfo.url.hostname === 'www.twitch.tv') {
          browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'whitelist_twitch_clicked' });
          browser.runtime.sendMessage({ command: 'createWhitelistFilterForTwitchChannel', url: pageInfo.url.href }).then(() => {
            closeAndReloadPopup();
            browser.tabs.reload();
          });
        }
      });

      selected('#div_manage_subscribed_channel', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'manage_subscribed_clicked' });
        browser.runtime.sendMessage({ command: 'openYTManagedSubPage' }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#div_pause_adblock', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'pause_clicked' });
        browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: true }).then(() => {
          browser.runtime.sendMessage({ command: 'updateButtonUIAndContextMenus' }).then(() => {
            closeAndReloadPopup();
          });
        });
      });

      selected('#div_domain_pause_adblock', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'domain_pause_clicked' });
        if (pageInfo.url) {
          browser.runtime.sendMessage({ command: 'adblockIsDomainPaused', activeTab: { url: pageInfo.url.href, id: pageInfo.id }, newValue: true }).then(() => {
            browser.runtime.sendMessage({ command: 'updateButtonUIAndContextMenus' }).then(() => {
              closeAndReloadPopup();
            });
          });
        }
      });

      selected('#div_blacklist', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'blacklist_clicked' });
        browser.runtime.sendMessage({ command: 'showBlacklist', nothingClicked: true, tabId: pageInfo.id }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#div_whitelist', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'whitelist_domain_clicked' });
        browser.runtime.sendMessage({ command: 'showWhitelist', tabId: pageInfo.id }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#div_whitelist_page', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'whitelist_page_clicked' });
        if (pageInfo.url) {
          browser.runtime.sendMessage({ command: 'createPageWhitelistFilter', url: pageInfo.url.href }).then(() => {
            closeAndReloadPopup();
            browser.tabs.reload();
          });
        }
      });

      selected('#svg_options', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'options_clicked' });
        browser.runtime.sendMessage({ command: 'openTab', urlToOpen: browser.runtime.getURL('options.html') }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#div_myadblock_enrollment_v2', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'myadblock_cta_clicked' });
        browser.runtime.sendMessage({ command: 'License.MAB_CONFIG', url: 'payURL' }).then((response) => {
          browser.runtime.sendMessage({ command: 'openTab', urlToOpen: response.url }).then(() => {
            closeAndReloadPopup();
          });
        });
      });

      selected('#mabNewCtaClose', (event) => {
        event.stopPropagation();
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'myadblock_cta_closed' });
        $('#div_myadblock_enrollment_v2').slideUp();
        $('#separator-2').hide();
        storageSet(popupMenuCtaClosedKey, true);
        storageSet(showPopupMenuThemesCtaKey, true);
      });

      selected('#div_premium_themes_cta', (event) => {
        event.stopPropagation();
        const theme = themeCTA ? themeCTA.replace('_theme', '') : '';
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'premium_themes_cta_clicked', additionalParams: { theme } });
        browser.runtime.sendMessage({ command: 'openTab', urlToOpen: browser.runtime.getURL('options.html#mab-themes') }).then(() => {
          closeAndReloadPopup();
        });
      });

      selected('#close-themes-cta', (event) => {
        event.stopPropagation();
        const theme = themeCTA ? themeCTA.replace('_theme', '') : '';
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'premium_themes_cta_closed', additionalParams: { theme } });
        $('#div_premium_themes_cta').slideUp();
        storageSet(showPopupMenuThemesCtaKey, false);
      });

      selected('#help_link', () => {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'feedback_clicked' });
        if (!pageInfo.disabledSite) {
          showHelpSetupPage();
        } else {
          browser.runtime.sendMessage({ command: 'openTab', urlToOpen: 'http://help.getadblock.com/' });
        }
      });

      $('#div_myadblock_enrollment_v2').on('mouseenter', () => {
        $('#separator-1').addClass('hide-on-new-cta-hover');
        $('#separator-2').addClass('hide-on-new-cta-hover');
        $('#separator0').addClass(shown.separator0 ? 'hide-on-new-cta-hover' : '');
        $('#mabNewCtaText').text(translate('new_cta_hovered_text'));
      }).on('mouseleave', () => {
        $('#separator-1').removeClass('hide-on-new-cta-hover');
        $('#separator-2').removeClass('hide-on-new-cta-hover');
        $('#separator0').removeClass('hide-on-new-cta-hover');
        $('#mabNewCtaText').text(translate('new_cta_default_text'));
      });

      $('#div_premium_themes_cta').on('mouseenter', function handleIn() {
        $('#themes-cta-text').text(translate('check_out_themes'));
        const currentThemeCTA = $(this).attr('data-theme-cta');
        $('body').attr('id', currentThemeCTA).data('theme', currentThemeCTA);
        // eslint-disable-next-line prefer-arrow-callback
      }).on('mouseleave', function handleOut() {
        $('#themes-cta-text').text(translate('adblock_looked_like_this'));
        $('body').attr('id', popupMenuTheme).data('theme', popupMenuTheme);
      });
    } catch (err) {
      processError(err);
    }
  });
} catch (err) {
  processError(err);
}
