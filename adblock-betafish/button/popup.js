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

    var sendErrorReport = document.getElementById('errorreport');
    var clickHandler = function() {
      sendErrorReport.removeEventListener('click', clickHandler);
      sendErrorPayload();
      var first_msg = document.getElementById('first_msg');
      first_msg.style.display = 'none';
      var second_msg = document.getElementById('second_msg');
      second_msg.style.display = 'block';
    };
    sendErrorReport.addEventListener('click', clickHandler);

    var reloadAnchor = document.getElementById('reload');
    if (chrome && chrome.runtime && chrome.runtime.reload) {
      var reloadClickHandler = function() {
        reloadAnchor.removeEventListener('click', reloadClickHandler);
        try {
          chrome.runtime.reload();
        } catch(e) {
          var reloadMsg = document.getElementById('reload_msg');
          if (reloadMsg) {
            reloadMsg.style.display = "none";
          }
          var thirdMsg = document.getElementById('third_msg');
          if (thirdMsg) {
            thirdMsg.style.display = "block";
          }
        }
      };
      reloadAnchor.addEventListener('click', reloadClickHandler);
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

  const Prefs = BG.Prefs;
  const getBlockedPerPage = BG.getBlockedPerPage;
  const getDecodedHostname = BG.getDecodedHostname;

  // the tab/page object, which contains |id| and |url| of
  // the current tab
  var page = null;
  var pageInfo = null;
  var activeTab = null;

  const openPage = function(url) {
    chrome.tabs.create({url});
  };

  const myAdBlockBannerDisplay = () => {
    chrome.storage.local.get(License.myAdBlockEnrollmentFeatureKey, (myAdBlockInfo) =>
    {
      if (!myAdBlockInfo || !myAdBlockInfo.myAdBlockFeature)
      {
        return;
      }

      if (myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner)
      {
        myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner = false;
        myAdBlockInfo.myAdBlockFeature.takeUserToMyAdBlockTab = true;
        chrome.storage.local.set(myAdBlockInfo);
      }
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
          if (info && info.errorStr) {
            processError(info.errorStr, info.stack, info.message);
            return;
          }
          $( window ).unload(function() {
            BG.recordGeneralMessage("popup_closed");
          });
          // Cache tab object for later use
          page = info.page;
          pageInfo = info;
          var shown = {};
          function show(L) {
            L.forEach(function (x) {
              shown[x] = true;
            });
          }

          function hide(L) {
            L.forEach(function (x) {
              shown[x] = false;
            });
          }

          show(['div_options']);
          var paused = BG.adblockIsPaused();
          var domainPaused = BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id});
          if (paused) {
            show(['div_status_paused', 'separator0', 'div_paused_adblock', 'div_options', 'help_link']);
          } else if (domainPaused) {
            show(['div_status_domain_paused', 'separator0', 'div_domain_paused_adblock', 'div_options', 'help_link']);
          } else if (info.disabledSite) {
            show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'div_options', 'help_link']);
          } else if (info.whitelisted) {
            show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'div_options', 'help_link']);
          } else {
            show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'div_troubleshoot_an_ad', 'separator3', 'separator4', 'div_options', 'block_counts', 'help_link']);

            chrome.runtime.sendMessage({
              type: "stats.getBlockedPerPage",
              tab: info.tab,
            },
            blockedPage => {
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

          if ((info.settings.show_protect_enrollment && !info.myAdBlockInfo.myAdBlockFeature) ||
              (info.settings.show_protect_enrollment && info.myAdBlockInfo.myAdBlockFeature && !info.myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner)) {
            show(['div_adblock_protect_enrollment']);
            hide(['separator0']);
            $('#block_counts').addClass('remove-bottom-margin');
          }

          if (License.shouldShowMyAdBlockEnrollment() && info.myAdBlockInfo && info.myAdBlockInfo.myAdBlockFeature && info.myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner) {
            var $myAdBlockBanner = $('#div_myadblock_enrollment');
            $myAdBlockBanner.show();

            var nextVisibleDivs = $myAdBlockBanner.nextAll('div:visible');
            if (nextVisibleDivs.length) {
              // dynamically remove separator if it's
              // the next visible div element
              var $nextDiv = $(nextVisibleDivs[0]);
              if ($nextDiv.hasClass('separator')) {
                $nextDiv.hide();
                $myAdBlockBanner.addClass('bottom-space');
              }
            }
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
        window.close();
      }

      // Click handlers
      $('#bugreport').click(function () {
        BG.recordGeneralMessage("bugreport_clicked");
        var supportURL = 'https://help.getadblock.com/support/tickets/new';
        openPage(supportURL);
        closeAndReloadPopup();
      });

      $('.header-logo').click(function () {
        BG.recordGeneralMessage("titletext_clicked");
        var chrome_url = 'https://chrome.google.com/webstore/detail/gighmmpiobklfepjocnamgkkbiglidom';
        openPage(chrome_url);

        closeAndReloadPopup();
      });

      $('#div_enable_adblock_on_this_page').click(function () {
        BG.recordGeneralMessage("enable_adblock_clicked");
        if (BG.tryToUnwhitelist(page.url.href)) {
          chrome.tabs.reload();
          closeAndReloadPopup();
        } else {
          $('#div_status_whitelisted').replaceWith(translate('disabled_by_filter_lists'));
        }
      });

      $('#div_paused_adblock').click(function () {
        BG.recordGeneralMessage("unpause_clicked");
        BG.adblockIsPaused(false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      $('#div_domain_paused_adblock').click(function () {
        BG.recordGeneralMessage("domain_unpause_clicked");
        BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      $('#div_undo').click(function () {
        BG.recordGeneralMessage("undo_clicked");
        var host = page.url.hostname;
        activeTab = page;
        BG.confirmRemovalOfCustomFiltersOnHost(host, activeTab);
        closeAndReloadPopup();
      });

      $('#div_whitelist_channel').click(function () {
        BG.recordGeneralMessage("whitelist_youtube_clicked");
        BG.createWhitelistFilterForYoutubeChannel(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      $('#div_pause_adblock').click(function () {
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

      $('#div_domain_pause_adblock').click(function () {
        BG.recordGeneralMessage("domain_pause_clicked");
        BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, true);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      $('#div_blacklist').click(function () {
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

      $('#div_whitelist').click(function () {
        BG.recordGeneralMessage("whitelist_domain_clicked");
        BG.emitPageBroadcast({
            fn: 'top_open_whitelist_ui',
            options: {},
          }, {
            tab: page,
          }); // fake sender to determine target page

        closeAndReloadPopup();
      });

      $('#div_whitelist_page').click(function () {
        BG.recordGeneralMessage("whitelist_page_clicked");
        BG.createPageWhitelistFilter(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      $('#div_troubleshoot_an_ad').click(function () {
        BG.recordGeneralMessage("troubleshoot_ad_clicked");
        var url = 'https://help.getadblock.com/support/solutions/articles/6000109812-report-an-unblocked-ad';
        openPage(url);
        closeAndReloadPopup();
      });

      $('#div_options').click(function () {
        if (License.shouldShowMyAdBlockEnrollment()) {
          myAdBlockBannerDisplay();
        }

        BG.recordGeneralMessage("options_clicked");
        openPage(chrome.extension.getURL('options.html'));
        closeAndReloadPopup();
      });

      $('#div_myadblock_enrollment').click(function () {
        if (License.shouldShowMyAdBlockEnrollment()) {
          myAdBlockBannerDisplay();
        }
        BG.recordGeneralMessage('myadblock_enrollment_clicked');
        openPage(chrome.extension.getURL('options.html'));
        closeAndReloadPopup();
      });

      $('#help_link').click(function () {
        BG.recordGeneralMessage("feedback_clicked");
        openPage("http://help.getadblock.com/");
        closeAndReloadPopup();
      });

      $('#link_open').click(function () {
        BG.recordGeneralMessage("link_clicked");
        var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + BG.STATS.userId();
        openPage(linkHref);
        closeAndReloadPopup();
      });

      $('#protect_enrollment_btn').click(function () {
        BG.recordGeneralMessage("protect_enrollment_btn_clicked");
        BG.setSetting("show_protect_enrollment", false);
        openPage("https://chrome.google.com/webstore/detail/adblock-protect/fpkpgcabihmjieiegmejiloplfdmpcee");
        closeAndReloadPopup();
      });
    } catch(err) {
      processError(err);
    }
  });
} catch(err) {
  processError(err);
}
