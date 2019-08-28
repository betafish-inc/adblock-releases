var errorPayload = {
  'u': 'unknown',
  'f': 'e',
  'o': 'unknown',
  'l': 'unknown',
  't': 'error',
  'st': 'popupmenu',
};

// the translation messages are hard code in the JS to avoid any dependency
// on Chrome extension APIs during error handling
var translateErrorMsg = function(key) {
  var text = {
    "error_msg_header": {
      en: "Oops! We're sorry, the AdBlock menu had trouble loading.",
    },
    "error_msg_help_us": {
      en: "Help us resolve this problem by sending us some debug data: Click ",
    },
    "error_msg_thank_you": {
      en: "Thank you",
    },
    "error_msg_reload": {
      en: "Next, try reloading the extension: Click ",
    },
    "error_msg_help": {
      en: "If that doesn't work, check here for more help: Click ",
    },
    "error_msg_here": {
      en: "here",
    },
  };
  var locale = navigator.language.substring(0, 2);
  var msg = text[key] || {};
  return msg[locale] || msg["en"];
};

// selected attaches a click and keydown event handler to the matching selector and calls
// the handler if a click or keydown event occurs (with a CR or space is pressed). We support
// both mouse and keyboard events to increase accessibility of the popup menu.
function selected(selector, handler) {
  let $matched = $(selector);
  $matched.click(handler);
  $matched.keydown(function(event) {
    if (event.which === 13 || event.which === 32) {
      handler(event);
    }
  });
}

// selectedOnce adds event listeners to the given element for mouse click or keydown CR or space events
// which runs the handler and immediately removes the event handlers so it can not fire again.
function selectedOnce(element, handler) {
  if (!element) {
    return;
  }
  let clickHandler = function() {
    element.removeEventListener('click', clickHandler);
    handler();
  }
  element.addEventListener('click', clickHandler);

  let keydownHandler = function(event) {
    if (event.keyCode === 13 || event.keyCode === 32) {
      element.removeEventListener('keydown', keydownHandler);
      handler();
    }
  }
  element.addEventListener('keydown', keydownHandler);
}

var errorOccurred = false;
var processError = function(err, stack, message) {
  errorOccurred = true;
  errorPayload.msg = err.message || message || 'no message';
  errorPayload.src = err.source ||stack || 'no source';
  errorPayload.line = err.lineno || 'anywhere';
  errorPayload.col = err.colno || 'anywhere';
  errorPayload.err = err.error || 'no error';
  if (typeof err === "string") {
    errorPayload.msg = err;
  }
  var errorMsgDiv = document.getElementById('div_status_error');
  if (errorMsgDiv) {

    selectedOnce(document.getElementById('errorreport'), function() {
      sendErrorReport.removeEventListener('keydown', clickHandler);
      sendErrorPayload();
      var first_msg = document.getElementById('first_msg');
      first_msg.style.display = 'none';
      var second_msg = document.getElementById('second_msg');
      second_msg.style.display = 'block';
    });

    let reloadAnchor = document.getElementById('reload');
    if (chrome && chrome.runtime && chrome.runtime.reload) {
      selectedOnce(reloadAnchor, function() {
        try {
          chrome.runtime.reload();
        } catch(e) {
          let reloadMsg = document.getElementById('reload_msg');
          if (reloadMsg) {
            reloadMsg.style.display = "none";
          }
          let thirdMsg = document.getElementById('third_msg');
          if (thirdMsg) {
            thirdMsg.style.display = "block";
          }
        }
      });
    } else {
      reloadAnchor.style.display = "none";
    }

    document.querySelectorAll(".menu-entry").forEach(function(elem) {
      elem.style.display = "none";
    });

    document.querySelectorAll(".separator").forEach(function(elem) {
      elem.style.display = "none";
    });

    var headerIconsDiv = document.getElementById('header-icons');
    if (headerIconsDiv) {
      headerIconsDiv.style.display = "none";
    }

    var divSlideoutDiv = document.getElementById('div_slideout');
    if (divSlideoutDiv) {
      divSlideoutDiv.style.display = "none";
    }

    document.querySelectorAll("*[i18n_error^='error_msg']").forEach(function(elem) {
      elem.innerText = translateErrorMsg(elem.getAttribute("i18n_error"));
    });

    errorMsgDiv.style.display = 'block';
  }
};

var sendErrorPayload = function() {
  var payload = {'event':  'error', 'payload': errorPayload };
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://log.getadblock.com/v2/record_log.php', true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.send(JSON.stringify(payload));
};

try {
  var BG = chrome.extension.getBackgroundPage();
  var License = BG.License;
  const SyncService = BG.SyncService;
  const Prefs = BG.Prefs;
  const userClosedCta = storage_get(License.popupMenuCtaClosedKey);
  let shown = {};

  // the tab/page object, which contains |id| and |url| of
  // the current tab
  var page = null;
  var pageInfo = null;
  var activeTab = null;
  var popupMenuTheme = 'default_theme';
  var itemClicked = false;

  const openPage = function(url) {
    chrome.tabs.create({url});
  };

  const show = function(elementIds) {
    elementIds.forEach(function (elementId) {
      shown[elementId] = true;
    });
  };

  const hide = function(elementIds) {
    elementIds.forEach(function (elementId) {
      shown[elementId] = false;
    });
  };

  $(function () {
    try {
      localizePage();

      // Set menu entries appropriately for the selected tab.
      $('.menu-entry, .menu-status, .separator').hide();
      BG.recordGeneralMessage("popup_opened");

      BG.getCurrentTabInfo(function (info) {
        try {

          License.setIconBadgeCTA(stopShowing=true);

          if (info.settings) {
            popupMenuTheme = info.settings.color_themes.popup_menu;
          }
          $('body').attr('id', popupMenuTheme).data('theme', popupMenuTheme);

          if (info && info.errorStr) {
            processError(info.errorStr, info.stack, info.message);
            return;
          }
          $( window ).unload(function() {
            if (!itemClicked) {
              BG.recordGeneralMessage("popup_closed");
            }
          });

          // Cache tab object for later use
          page = info.page;
          pageInfo = info;
          var paused = BG.adblockIsPaused();
          var domainPaused = BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id});

          show(['svg_options']);
          if (paused) {
            show(['div_status_paused', 'separator0', 'div_paused_adblock', 'svg_options', 'help_link']);
          } else if (domainPaused) {
            show(['div_status_domain_paused', 'separator0', 'div_domain_paused_adblock', 'svg_options', 'help_link']);
          } else if (info.disabledSite) {
            show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
          } else if (info.whitelisted) {
            show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
          } else {
            show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'div_troubleshoot_an_ad', 'separator3', 'separator4', 'svg_options', 'block_counts', 'help_link']);

            chrome.runtime.sendMessage({
              type: "stats.getBlockedPerPage",
              tab: info.tab,
            }).then((blockedPage) => {
              $('#page_blocked_count').text(blockedPage.toLocaleString());
            });
            $('#total_blocked_count').text(Prefs.blocked_total.toLocaleString());
          }

          var host = page.url.hostname;
          var eligibleForUndo = !paused && !domainPaused && (info.disabledSite || !info.whitelisted);
          var urlToCheckForUndo = info.disabledSite ? undefined : host;
          if (eligibleForUndo && BG.countCache.getCustomFilterCount(urlToCheckForUndo)) {
            show(['div_undo', 'separator0']);
          }

          if (host === 'www.youtube.com' && info.youTubeChannelName && /ab_channel/.test(page.url.href) && eligibleForUndo) {
            $('#div_whitelist_channel').text(translate('whitelist_youtube_channel', info.youTubeChannelName));
            show(['div_whitelist_channel']);
          }

          if (chrome.runtime && chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
            show(['div_status_beta']);
          }

          if (License.isActiveLicense()) {
            // Show paid user menu option and hide CTAs
            show(['div_myadblock_options', 'separator-1', 'separator-2']);
            hide(['div_myadblock_enrollment_v2']);
            hide(['div_myadblock_enrollment']);
          } else if (userClosedCta) {
            // Don't show any CTA
            hide(['div_myadblock_enrollment_v2']);
            hide(['div_myadblock_enrollment']);
          } else if (License.displayPopupMenuNewCTA()) {
            // Show new CTA
            show(['div_myadblock_enrollment_v2', 'separator-1', 'separator-2']);
            hide(['div_myadblock_enrollment']);
          } else if (License.shouldShowMyAdBlockEnrollment()) {
            // Show old CTA
            show(['div_myadblock_enrollment', 'separator-1', 'separator-2']);
            hide(['div_myadblock_enrollment_v2']);
          }

          if (shown['block_counts'] && Prefs.show_statsinpopup) {
            hide(['separator-1']);
          } else if (info.disabledSite || info.whitelisted) {
            hide(['separator-2']);
          }

          if (info.settings.sync_settings &&
              SyncService.getLastGetStatusCode() === 400 &&
              SyncService.getLastGetErrorResponse() &&
              SyncService.getLastGetErrorResponse().code === "invalid_sync_version") {
            show(['div_sync_outofdate_error_msg']);
            SyncService.resetLastGetStatusCode(); // reset the code, so it doesn't show again.
            SyncService.resetLastGetErrorResponse(); // reset the code, so it doesn't show again.
          } else if (info.settings.sync_settings && SyncService.getLastPostStatusCode() >= 400) {
            show(['div_sync_error_msg']);
            SyncService.resetLastPostStatusCode(); // reset the code, so it doesn't show again.
          } else if (info.settings.sync_settings && SyncService.getLastPostStatusCode() === 0) {
            show(['div_sync_error_msg']);
            $("#div_sync_error_msg").text(translate("sync_header_message_setup_fail_prefix") + " " + translate("sync_header_error_revert_message_part_2") + " " + translate("sync_header_message_error_suffix"));
            SyncService.resetLastPostStatusCode(); // reset the code, so it doesn't show again.
          } else {
            hide(['div_sync_error_msg']);
          }
          if ((window.devicePixelRatio >= 2) && (shown['div_myadblock_options'] || shown['div_myadblock_enrollment'] )) {
            $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-cat@2x.png");
            $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-dog@2x.png");
            $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscape@2x.png");
            $('#cat_enrollment').attr("src","icons/adblock-picreplacement-images-menu-cat@2x.png");
            $('#dog_enrollment').attr("src","icons/adblock-picreplacement-images-menu-dog@2x.png");
            $('#landscape_enrollment').attr("src","icons/adblock-picreplacement-images-menu-landscape@2x.png");
          }
          if (shown['div_myadblock_options']) {
            var guide = BG.channels.getGuide();
            var anyEnabled = false;
            for (var id in guide) {
              anyEnabled = anyEnabled || guide[id].enabled;
              if ((guide[id].name === "CatsChannel" && !guide[id].enabled) || !info.settings.picreplacement) {
                if (window.devicePixelRatio >= 2) {
                  $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-catgrayscale@2x.png");
                } else {
                  $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-catgrayscale.png");
                }
              }
              if ((guide[id].name === "DogsChannel" && !guide[id].enabled) || !info.settings.picreplacement) {
                if (window.devicePixelRatio >= 2) {
                  $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-doggrayscale@2x.png");
                } else {
                  $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-doggrayscale.png");
                }
              }
              if ((guide[id].name === "LandscapesChannel" && !guide[id].enabled) || !info.settings.picreplacement) {
                if (window.devicePixelRatio >= 2) {
                  $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscapegrayscale@2x.png");
                } else {
                  $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscapegrayscale.png");
                }
              }
            }
          }

          if (info.settings.show_protect_enrollment) {
            show(['div_adblock_protect_enrollment']);
            hide(['separator0']);
            $('#block_counts').addClass('remove-bottom-margin');
          }

          if (errorOccurred) {
            return;
          }
          for (var div in shown) {
            if (shown[div]) {
              $('#' + div).show();
            }
          }

          if (!Prefs.show_statsinpopup || paused || domainPaused || info.disabledSite || info.whitelisted) {
            $('#block_counts').hide();
          }
        } catch(err) {
          processError(err);
        }
      });

      // We needed to reload popover in Safari, so that we could
      // update popover according to the status of AdBlock.
      // We don't need to reload popup in Chrome because Chrome
      // reloads every time the popup for us.
      // Leaving the behavior centralized just in case Chrome changes.
      function closeAndReloadPopup() {
        itemClicked = true;
        window.close();
      }

      // Click handlers
      selected('#bugreport', function () {
        BG.recordGeneralMessage("bugreport_clicked");
        var supportURL = 'https://help.getadblock.com/support/tickets/new';
        openPage(supportURL);
        closeAndReloadPopup();
      });

      selected('.header-logo', function () {
        BG.recordGeneralMessage("titletext_clicked");
        var chrome_url = 'https://chrome.google.com/webstore/detail/gighmmpiobklfepjocnamgkkbiglidom';
        openPage(chrome_url);

        closeAndReloadPopup();
      });

      selected('#div_enable_adblock_on_this_page', function () {
        BG.recordGeneralMessage("enable_adblock_clicked");
        if (BG.tryToUnwhitelist(page.url.href)) {
          chrome.tabs.reload();
          closeAndReloadPopup();
        } else {
          $('#div_status_whitelisted').replaceWith(translate('disabled_by_filter_lists'));
        }
      });

      selected('#div_paused_adblock', function () {
        BG.recordGeneralMessage("unpause_clicked");
        BG.adblockIsPaused(false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_domain_paused_adblock', function () {
        BG.recordGeneralMessage("domain_unpause_clicked");
        BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_undo', function () {
        BG.recordGeneralMessage("undo_clicked");
        var host = page.url.hostname;
        activeTab = page;
        BG.confirmRemovalOfCustomFiltersOnHost(host, activeTab);
        closeAndReloadPopup();
      });

      selected('#div_whitelist_channel', function () {
        BG.recordGeneralMessage("whitelist_youtube_clicked");
        BG.createWhitelistFilterForYoutubeChannel(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      selected('#div_pause_adblock', function () {
        BG.recordGeneralMessage("pause_clicked");
        try {
          if (pageInfo.settings.safari_content_blocking) {
            alert(translate('safaricontentblockingpausemessage'));
          } else {
            BG.adblockIsPaused(true);
            BG.updateButtonUIAndContextMenus();
          }

          closeAndReloadPopup();
        } catch (ex) {
          BG.log(ex);
        }
      });

      selected('#div_domain_pause_adblock', function () {
        BG.recordGeneralMessage("domain_pause_clicked");
        BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, true);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_blacklist', function () {
        BG.recordGeneralMessage("blacklist_clicked");
        BG.emitPageBroadcast({
            fn: 'top_open_blacklist_ui',
            options: {
              nothing_clicked: true,
            },
          }, {
            tab: page,
          }); // fake sender to determine target page

        closeAndReloadPopup();
      });

      selected('#div_whitelist', function () {
        BG.recordGeneralMessage("whitelist_domain_clicked");
        BG.emitPageBroadcast({
            fn: 'top_open_whitelist_ui',
            options: {},
          }, {
            tab: page,
          }); // fake sender to determine target page

        closeAndReloadPopup();
      });

      selected('#div_whitelist_page', function () {
        BG.recordGeneralMessage("whitelist_page_clicked");
        BG.createPageWhitelistFilter(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      selected('#div_troubleshoot_an_ad', function () {
        BG.recordGeneralMessage("troubleshoot_ad_clicked");
        var url = 'https://help.getadblock.com/support/solutions/articles/6000109812-report-an-unblocked-ad';
        openPage(url);
        closeAndReloadPopup();
      });

      selected('#svg_options', function () {
        BG.recordGeneralMessage("options_clicked");
        openPage(chrome.extension.getURL('options.html'));
        closeAndReloadPopup();
      });

      selected('#div_myadblock_options', function () {
        BG.recordGeneralMessage("myadblock_options_clicked");
        openPage(chrome.extension.getURL('options.html#mab'));
        closeAndReloadPopup();
      });

      selected('#div_myadblock_enrollment, #div_myadblock_enrollment_v2', function () {
        BG.recordGeneralMessage("myadblock_cta_clicked");
        openPage(chrome.extension.getURL('options.html#mab'));
        closeAndReloadPopup();
      });

      selected('#mabNewCtaClose', function(event) {
        event.stopPropagation();
        BG.recordGeneralMessage("myadblock_cta_closed");
        $('#div_myadblock_enrollment_v2').slideUp();
        $('#separator-2').hide();
        storage_set(License.popupMenuCtaClosedKey, true);
      });

      selected('#help_link', function () {
        BG.recordGeneralMessage("feedback_clicked");
        openPage("http://help.getadblock.com/");
        closeAndReloadPopup();
      });

      selected('#link_open', function () {
        BG.recordGeneralMessage("link_clicked");
        var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + BG.STATS.userId();
        openPage(linkHref);
        closeAndReloadPopup();
      });

      selected('#protect_enrollment_btn', function () {
        BG.recordGeneralMessage("protect_enrollment_btn_clicked");
        BG.setSetting("show_protect_enrollment", false);
        openPage("https://chrome.google.com/webstore/detail/adblock-protect/fpkpgcabihmjieiegmejiloplfdmpcee");
        closeAndReloadPopup();
      });

      $('#div_myadblock_enrollment_v2').hover(() => {
        $('#separator-1').addClass('hide-on-new-cta-hover');
        $('#separator-2').addClass('hide-on-new-cta-hover');
        $('#separator0').addClass(shown['separator0'] ? 'hide-on-new-cta-hover' : '');
        $('#mabNewCtaText').text(translate('new_cta_hovered_text'));
      }, () => {
        $('#separator-1').removeClass('hide-on-new-cta-hover');
        $('#separator-2').removeClass('hide-on-new-cta-hover');
        $('#separator0').removeClass('hide-on-new-cta-hover');
        $('#mabNewCtaText').text(translate('new_cta_default_text'));
      });
    } catch(err) {
      processError(err);
    }
  });
} catch(err) {
  processError(err);
}
