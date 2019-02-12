
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
}

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
}

$(function ()
{
  localizePage();

  // Set menu entries appropriately for the selected tab.
  $('.menu-entry, .menu-status, .separator').hide();
  BG.recordGeneralMessage("popup_opened");

  BG.getCurrentTabInfo(function (info)
  {
    $( window ).unload(function() {
      BG.recordGeneralMessage("popup_closed");
    });
    // Cache tab object for later use
    page = info.page;
    pageInfo = info;
    var shown = {};
    function show(L)
    {
      L.forEach(function (x)
      {
        shown[x] = true;
      });
    }

    function hide(L)
    {
      L.forEach(function (x)
      {
        shown[x] = false;
      });
    }

    show(['div_options']);
    var paused = BG.adblockIsPaused();
    var domainPaused = BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id});
    if (paused)
    {
      show(['div_status_paused', 'separator0', 'div_paused_adblock', 'div_options', 'help_link']);
    } else if (domainPaused)
    {
      show(['div_status_domain_paused', 'separator0', 'div_domain_paused_adblock', 'div_options', 'help_link']);
    } else if (info.disabledSite)
    {
      show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'div_options', 'help_link']);
    } else if (info.whitelisted)
    {
      show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'div_options', 'help_link']);
    } else
    {
      show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'div_troubleshoot_an_ad', 'separator3', 'separator4', 'div_options', 'block_counts', 'help_link']);

      chrome.runtime.sendMessage({
        type: "stats.getBlockedPerPage",
        tab: info.tab,
      },
      blockedPage =>
      {
        $('#page_blocked_count').text(blockedPage.toLocaleString());
      });
      $('#total_blocked_count').text(Prefs.blocked_total.toLocaleString());
    }

    var host = page.url.hostname;
    var eligibleForUndo = !paused && !domainPaused && (info.disabledSite || !info.whitelisted);
    var urlToCheckForUndo = info.disabledSite ? undefined : host;
    if (eligibleForUndo && BG.countCache.getCustomFilterCount(urlToCheckForUndo))
    {
      show(['div_undo', 'separator0']);
    }

    if (SAFARI && !advanced_option) {
      hide(['div_troubleshoot_an_ad', 'separator1']);
    }

    if (host === 'www.youtube.com' && info.youTubeChannelName && /ab_channel/.test(page.url.href) && eligibleForUndo)
    {
      $('#div_whitelist_channel').text(translate('whitelist_youtube_channel', info.youTubeChannelName));
      show(['div_whitelist_channel']);
    }

    if (chrome.runtime && chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk')
    {
      show(['div_status_beta']);
    }

    // In Safari with content blocking enabled,
    // whitelisting of domains is not currently supported.
    if (SAFARI && info.settings.safari_content_blocking)
    {
      hide(['div_paused_adblock', 'div_domain_paused_adblock', 'div_whitelist_page', 'div_whitelist']);
    }

    if ((info.settings.show_protect_enrollment && !info.myAdBlockInfo.myAdBlockFeature) ||
        (info.settings.show_protect_enrollment && info.myAdBlockInfo.myAdBlockFeature && !info.myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner)) {
      show(['div_adblock_protect_enrollment']);
      hide(['separator0']);
      $('#block_counts').addClass('remove-bottom-margin');
    }

    if (License.shouldShowMyAdBlockEnrollment() && info.myAdBlockInfo && info.myAdBlockInfo.myAdBlockFeature && info.myAdBlockInfo.myAdBlockFeature.displayPopupMenuBanner)
    {
      var $myAdBlockBanner = $('#div_myadblock_enrollment');
      $myAdBlockBanner.show();

      var nextVisibleDivs = $myAdBlockBanner.nextAll('div:visible');
      if (nextVisibleDivs.length)
      {
        // dynamically remove separator if it's
        // the next visible div element
        var $nextDiv = $(nextVisibleDivs[0]);
        if ($nextDiv.hasClass('separator'))
        {
          $nextDiv.hide();
          $myAdBlockBanner.addClass('bottom-space');
        }
      }
    }

    for (var div in shown)
    {
      if (shown[div])
      {
        $('#' + div).show();
      }
    }

    if (SAFARI || !Prefs.show_statsinpopup || paused || domainPaused || info.disabledSite || info.whitelisted)
    {
      $('#block_counts').hide();
    }
  });

  if (SAFARI)
  {
    // Update the width and height of popover in Safari
    $(window).load(function ()
    {
      var popupheight = $('body').outerHeight();
      safari.extension.popovers[0].height = popupheight + 5;
      safari.extension.popovers[0].width = 270;
    });

    // Store info about active tab
    activeTab = safari.application.activeBrowserWindow.activeTab;
  }

  // We need to reload popover in Safari, so that we could
  // update popover according to the status of AdBlock.
  // We don't need to reload popup in Chrome,
  // because Chrome reloads every time the popup for us.
  function closeAndReloadPopup()
  {
    if (SAFARI)
    {
      safari.self.hide();
      setTimeout(function ()
      {
        window.location.reload();
      }, 200);
    } else
    {
      window.close();
    }
  }

  // Click handlers
  $('#bugreport').click(function ()
  {
    BG.recordGeneralMessage("bugreport_clicked");
    var supportURL = 'https://help.getadblock.com/support/tickets/new';
    openPage(supportURL);
    closeAndReloadPopup();
  });

  $('.header-logo').click(function ()
  {
    BG.recordGeneralMessage("titletext_clicked");
    var chrome_url = 'https://chrome.google.com/webstore/detail/gighmmpiobklfepjocnamgkkbiglidom';
    var opera_url = 'https://addons.opera.com/extensions/details/adblockforopera/';
    var getadblock_url = 'https://getadblock.com/';
    if (OPERA)
    {
      openPage(opera_url);
    } else if (SAFARI)
    {
      openPage(getadblock_url);
    } else
    {
      openPage(chrome_url);
    }

    closeAndReloadPopup();
  });

  $('#div_enable_adblock_on_this_page').click(function ()
  {
    BG.recordGeneralMessage("enable_adblock_clicked");
    if (BG.tryToUnwhitelist(page.url.href))
    {
      !SAFARI ? chrome.tabs.reload() : activeTab.url = activeTab.url;
      closeAndReloadPopup();
    } else
    {
      $('#div_status_whitelisted').replaceWith(translate('disabled_by_filter_lists'));
    }
  });

  $('#div_paused_adblock').click(function ()
  {
    BG.recordGeneralMessage("unpause_clicked");
    BG.adblockIsPaused(false);
    BG.updateButtonUIAndContextMenus();
    closeAndReloadPopup();
  });

  $('#div_domain_paused_adblock').click(function ()
  {
    BG.recordGeneralMessage("domain_unpause_clicked");
    BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, false);
    BG.updateButtonUIAndContextMenus();
    closeAndReloadPopup();
  });

  $('#div_undo').click(function ()
  {
    BG.recordGeneralMessage("undo_clicked");
    var host = page.url.hostname;
    if (!SAFARI)
    {
      activeTab = page;
    }
    BG.confirmRemovalOfCustomFiltersOnHost(host, activeTab);
    closeAndReloadPopup();
  });

  $('#div_whitelist_channel').click(function ()
  {
    BG.recordGeneralMessage("whitelist_youtube_clicked");
    BG.createWhitelistFilterForYoutubeChannel(page.url.href);
    closeAndReloadPopup();
    !SAFARI ? chrome.tabs.reload() : activeTab.url = activeTab.url;
  });

  $('#div_pause_adblock').click(function ()
  {
    BG.recordGeneralMessage("pause_clicked");
    try
    {
      if (pageInfo.settings.safari_content_blocking)
      {
        alert(translate('safaricontentblockingpausemessage'));
      } else
      {
        BG.adblockIsPaused(true);
        BG.updateButtonUIAndContextMenus();
      }

      closeAndReloadPopup();
    }
    catch (ex)
    {
      BG.log(ex);
    }
  });

  $('#div_domain_pause_adblock').click(function ()
  {
    BG.recordGeneralMessage("domain_pause_clicked");
    BG.adblockIsDomainPaused({"url": page.url.href, "id": page.id}, true);
    BG.updateButtonUIAndContextMenus();
    closeAndReloadPopup();
  });

  $('#div_blacklist').click(function ()
  {
    BG.recordGeneralMessage("blacklist_clicked");
    if (!SAFARI)
    {
      BG.emitPageBroadcast({
        fn: 'top_open_blacklist_ui',
        options: {
          nothing_clicked: true,
        },
      }, {
        tab: page,
      } // fake sender to determine target page
      );
    } else
    {
      BG.dispatchMessage('show-blacklist-wizard');
    }

    closeAndReloadPopup();
  });

  $('#div_whitelist').click(function ()
  {
    BG.recordGeneralMessage("whitelist_domain_clicked");
    if (!SAFARI)
    {
      BG.emitPageBroadcast({
        fn: 'top_open_whitelist_ui',
        options: {},
      }, {
        tab: page,
      } // fake sender to determine target page
      );
    } else
    {
      BG.dispatchMessage('show-whitelist-wizard');
    }

    closeAndReloadPopup();
  });

  $('#div_whitelist_page').click(function ()
  {
    BG.recordGeneralMessage("whitelist_page_clicked");
    BG.createPageWhitelistFilter(page.url.href);
    closeAndReloadPopup();
    !SAFARI ? chrome.tabs.reload() : activeTab.url = activeTab.url;
  });

  $('#div_troubleshoot_an_ad').click(function ()
  {
    BG.recordGeneralMessage("troubleshoot_ad_clicked");
    var url = 'https://help.getadblock.com/support/solutions/articles/6000109812-report-an-unblocked-ad';
    openPage(url);
    closeAndReloadPopup();
  });

  $('#div_options').click(function ()
  {
    if (License.shouldShowMyAdBlockEnrollment())
    {
      myAdBlockBannerDisplay();
    }

    BG.recordGeneralMessage("options_clicked");
    openPage(chrome.extension.getURL('options.html'));
    closeAndReloadPopup();
  });

  $('#div_myadblock_enrollment').click(function ()
  {
    if (License.shouldShowMyAdBlockEnrollment())
    {
      myAdBlockBannerDisplay();
    }
    BG.recordGeneralMessage('myadblock_enrollment_clicked');
    openPage(chrome.extension.getURL('options.html'));
    closeAndReloadPopup();
  });

  $('#help_link').click(function ()
  {
    BG.recordGeneralMessage("feedback_clicked");
    openPage("http://help.getadblock.com/");
    closeAndReloadPopup();
  });

  $('#link_open').click(function ()
  {
    BG.recordGeneralMessage("link_clicked");
    var linkHref = "https://getadblock.com/pay/?exp=7003&u=" + BG.STATS.userId();
    openPage(linkHref);
    closeAndReloadPopup();
  });

  $('#protect_enrollment_btn').click(function ()
  {
    BG.recordGeneralMessage("protect_enrollment_btn_clicked");
    BG.setSetting("show_protect_enrollment", false);
    openPage("https://chrome.google.com/webstore/detail/adblock-protect/fpkpgcabihmjieiegmejiloplfdmpcee");
    closeAndReloadPopup();
  });

});
