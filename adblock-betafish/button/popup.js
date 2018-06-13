
var BG = chrome.extension.getBackgroundPage();

const Prefs = BG.Prefs;
const getBlockedPerPage = BG.getBlockedPerPage;
const getDecodedHostname = BG.getDecodedHostname;

// the tab/page object, which contains |id| and |url| of
// the current tab
var page = null;
var pageInfo = null;
var activeTab = null;

var iframeSRCURL = "https://getadblock.com/myadblock/enrollment/?u=" + BG.STATS.userId();

const openPage = function(url) {
  chrome.tabs.create({url});
}

$(function ()
{
  localizePage();

  var License = BG.License;

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

    show(['div_options', 'separator2']);
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
      show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'separator1', 'div_options', 'help_link']);
    } else
    {
      show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'div_report_an_ad', 'separator3', 'separator4', 'div_options', 'block_counts', 'help_link']);

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
    var advancedOption = info.settings.show_advanced_options;
    var eligibleForUndo = !paused && !domainPaused && (info.disabledSite || !info.whitelisted);
    var urlToCheckForUndo = info.disabledSite ? undefined : host;
    if (eligibleForUndo && BG.countCache.getCustomFilterCount(urlToCheckForUndo))
    {
      show(['div_undo', 'separator0']);
    }

    if (SAFARI && !advanced_option) {
      hide(['div_report_an_ad', 'separator1']);
    }

    if (host === 'www.youtube.com' && /channel|user/.test(page.url.href) && /ab_channel/.test(page.url.href) && eligibleForUndo && info.settings.youtube_channel_whitelist)
    {
      $('#div_whitelist_channel').html(translate('whitelist_youtube_channel', parseUri.parseSearch(page.url.href).ab_channel));
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
    if (info.disabledSite) {
      hide(['div_myadblock_enrollment']);
    }
    if (License.shouldShowMyAdBlockEnrollment() && !License.isActiveLicense())
    {
      show(['div_myadblock_enrollment', 'separator-1', 'separator-2']);
      chrome.management.getSelf(function(info)
      {
        if (info && info.installType === "development")
        {
          iframeSRCURL = "https://getadblock.com/myadblock/enrollment/?testmode&u=" + BG.STATS.userId();
        }
      });
    }
    if (License.isActiveLicense())
    {
      show(['div_myadblock_options', 'separator-1', 'separator-2']);
    }
    if (License.shouldShowMyAdBlockEnrollment() || License.isActiveLicense())
    {
      if (info.disabledSite || info.whitelisted)
      {
        hide(['separator-2']);
      }
      if (shown['block_counts'] && Prefs.show_statsinpopup)
      {
        hide(['separator-1']);
      }
    }

    if ((window.devicePixelRatio >= 2) && (shown['div_myadblock_options'] || shown['div_myadblock_enrollment'] ))
    {
          $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-cat@2x.png");
          $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-dog@2x.png");
          $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscape@2x.png");
          $('#cat_enrollment').attr("src","icons/adblock-picreplacement-images-menu-cat@2x.png");
          $('#dog_enrollment').attr("src","icons/adblock-picreplacement-images-menu-dog@2x.png");
          $('#landscape_enrollment').attr("src","icons/adblock-picreplacement-images-menu-landscape@2x.png");
    }

    if (shown['div_myadblock_options'])
    {
      var guide = BG.channels.getGuide();
      var anyEnabled = false;
      for (var id in guide)
      {
        anyEnabled = anyEnabled || guide[id].enabled;
        if ((guide[id].name === "CatsChannel" && !guide[id].enabled) || !info.settings.picreplacement)
        {
          if (window.devicePixelRatio >= 2)
          {
            $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-catgrayscale@2x.png");
          } else
          {
            $('#cat_option').attr("src","icons/adblock-picreplacement-images-menu-catgrayscale.png");
          }
        }
        if ((guide[id].name === "DogsChannel" && !guide[id].enabled) || !info.settings.picreplacement)
        {
          if (window.devicePixelRatio >= 2)
          {
            $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-doggrayscale@2x.png");
          } else {
            $('#dog_option').attr("src","icons/adblock-picreplacement-images-menu-doggrayscale.png");
          }
        }
        if ((guide[id].name === "LandscapesChannel" && !guide[id].enabled) || !info.settings.picreplacement)
        {
          if (window.devicePixelRatio >= 2)
          {
            $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscapegrayscale@2x.png");
          } else
          {
            $('#landscape_option').attr("src","icons/adblock-picreplacement-images-menu-landscapegrayscale.png");
          }
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

  $('#titletext').click(function ()
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

  $('#div_report_an_ad').click(function ()
  {
    BG.recordGeneralMessage("report_ad_clicked");
    var url = 'adblock-adreport.html?url=' + encodeURIComponent(page.url.href) + '&tabId=' + page.id;
    openPage(chrome.extension.getURL(url));
    closeAndReloadPopup();
  });

  $('#div_options').click(function ()
  {
    BG.recordGeneralMessage("options_clicked");
    openPage(chrome.extension.getURL('options.html'));
    closeAndReloadPopup();
  });

  $('#div_myadblock_options').click(function ()
  {
    BG.recordGeneralMessage("myadblock_options_clicked");
    openPage(chrome.extension.getURL('adblock-picreplacement-options-general.html'));
    closeAndReloadPopup();
  });

  $('#div_myadblock_enrollment').click(function ()
  {
    BG.recordGeneralMessage("myadblock_wizard_clicked");
    $("#wrapper").hide();
    var originalWidth = document.body.style.width;
    var originalHeight = document.body.style.height;
    var iframe = document.createElement('iframe');
    iframe.id = "myadblock_wizard_frame";
    iframe.width="100%";
    iframe.height="100%";
    iframe.style.border = "solid 0px";
    iframe.src = iframeSRCURL;
    document.body.appendChild(iframe);
    document.body.style.width = "540px";
    document.body.style.height = "440px";
    document.body.style.border = "solid 0px";
    window.addEventListener("message", receiveMessage, false);

    function receiveMessage(event)
    {
      if (event.origin !== "https://getadblock.com") {
        return;
      }
      if (event.data && event.data.command === "resize" && event.data.height && event.data.width) {
        $(document.body).animate({ "width" : event.data.width + "px", "height" : event.data.height + "px" }, 400, "linear");
      }
      if (event.data && event.data.command === "openPage" && event.data.url && event.data.url.startsWith('http')) {
        openPage(event.data.url);
        closeAndReloadPopup();
      }
      if (event.data && event.data.command === "close") {
        document.body.removeChild(iframe);
        document.body.style.width = originalWidth;
        document.body.style.height = originalHeight;
        $("#wrapper").show();
      }
    }
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

});
