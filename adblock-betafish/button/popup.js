
var backgroundPage = ext.backgroundPage.getWindow();
var require = backgroundPage.require;

var Filter = require('filterClasses').Filter;
var FilterStorage = require('filterStorage').FilterStorage;
var Prefs = require('prefs').Prefs;
var getBlockedPerPage = require('stats').getBlockedPerPage;
var getDecodedHostname = require('url').getDecodedHostname;

// the tab/page object, which contains |id| and |url| (stored as unicodeUrl) of
// the current tab
var page = null;
var pageInfo = null;
$(function ()
{
  localizePage();

  var BG = chrome.extension.getBackgroundPage();

  // Set menu entries appropriately for the selected tab.
  $('.menu-entry, .menu-status, .separator').hide();

  BG.getCurrentTabInfo(function (info)
  {
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
    if (paused)
    {
      show(['div_status_paused', 'separator0', 'div_paused_adblock', 'div_options']);
    } else if (info.disabledSite)
    {
      show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'div_options', 'div_help_hide_start']);
    } else if (info.whitelisted)
    {
      show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'separator1', 'div_options', 'div_help_hide_start']);
    } else
    {
      show(['div_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'div_show_resourcelist_start', 'div_report_an_ad', 'separator1', 'div_options',
          'div_help_hide_start', 'separator3', 'block_counts', ]);

      $('#page_blocked_count').text(getBlockedPerPage(page).toLocaleString());
      $('#total_blocked_count').text(Prefs.blocked_total.toLocaleString());

      // Show help link until it is clicked.
      $('#block_counts_help').toggle(info.settings.show_block_counts_help_link).click(function ()
      {
        BG.setSetting('show_block_counts_help_link', false);
        ext.pages.open($(this).attr('href'));
        $(this).hide();
        closeAndReloadPopup();
      });
    }

    var host = parseUri(page.unicodeUrl).host;
    var advancedOption = info.settings.show_advanced_options;
    var eligibleForUndo = !paused && (info.disabledSite || !info.whitelisted);
    var urlToCheckForUndo = info.disabledSite ? undefined : host;
    if (eligibleForUndo && BG.countCache.getCustomFilterCount(urlToCheckForUndo))
    {
      show(['div_undo', 'separator0']);
    }

    if (SAFARI && !advanced_option) {
      hide(['div_report_an_ad', 'separator1']);
    }

    if (host === 'www.youtube.com' && /channel|user/.test(page.unicodeUrl) && /ab_channel/.test(page.unicodeUrl) && eligibleForUndo && info.settings.youtube_channel_whitelist)
    {
      $('#div_whitelist_channel').html(translate('whitelist_youtube_channel', parseUri.parseSearch(page.unicodeUrl).ab_channel));
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
      hide(['div_paused_adblock', 'div_whitelist_page', 'div_whitelist']);
    }

    for (var div in shown)
    {
      if (shown[div])
      {
        $('#' + div).show();
      }
    }

    if (SAFARI || !Prefs.show_statsinpopup || paused || info.disabledSite || info.whitelisted)
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
    var activeTab = safari.application.activeBrowserWindow.activeTab;
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
    var out = BG.makeReport();
    var supportURL = 'http://support.getadblock.com/discussion/new' + '?category_id=problems&discussion[body]=' + out;
    ext.pages.open(supportURL);
    closeAndReloadPopup();
  });

  $('#titletext').click(function ()
  {
    var chrome_url = 'https://chrome.google.com/webstore/detail/gighmmpiobklfepjocnamgkkbiglidom';
    var opera_url = 'https://addons.opera.com/extensions/details/adblockforopera/';
    var getadblock_url = 'https://getadblock.com/';
    if (OPERA)
    {
      BG.ext.pages.open(opera_url);
    } else if (SAFARI)
    {
      BG.ext.pages.open(getadblock_url);
    } else
    {
      BG.ext.pages.open(chrome_url);
    }

    closeAndReloadPopup();
  });

  $('#div_enable_adblock_on_this_page').click(function ()
  {
    if (BG.tryToUnwhitelist(page.unicodeUrl))
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
    BG.adblockIsPaused(false);
    BG.updateButtonUIAndContextMenus();
    closeAndReloadPopup();
  });

  $('#div_undo').click(function ()
  {
    var host = parseUri(page.unicodeUrl).host;
    BG.confirmRemovalOfCustomFiltersOnHost(host, activeTab);
    closeAndReloadPopup();
  });

  $('#div_whitelist_channel').click(function ()
  {
    BG.createWhitelistFilterForYoutubeChannel(page.unicodeUrl);
    closeAndReloadPopup();
    !SAFARI ? chrome.tabs.reload() : activeTab.url = activeTab.url;
  });

  $('#div_pause_adblock').click(function ()
  {
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

  $('#div_blacklist').click(function ()
  {
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
    BG.createPageWhitelistFilter(page.unicodeUrl);
    closeAndReloadPopup();
    !SAFARI ? chrome.tabs.reload() : activeTab.url = activeTab.url;
  });

  $('#div_show_resourcelist').click(function ()
  {
    $('#new_resourcelist_explanation').slideToggle();;
  });

  $('#div_report_an_ad').click(function ()
  {
    var url = 'adblock-adreport.html?url=' + encodeURIComponent(page.unicodeUrl) + '&tabId=' + page.id;
    BG.ext.pages.open(BG.ext.getURL(url));
    closeAndReloadPopup();
  });

  $('#div_options').click(function ()
  {
    BG.ext.pages.open(BG.ext.getURL('options.html'));
    closeAndReloadPopup();
  });

  $('#div_help_hide').click(function ()
  {
    if (OPERA)
    {
      $('#help_hide_explanation').text(translate('operabutton_how_to_hide2')).slideToggle();
    } else if (SAFARI)
    {
      $('#help_hide_explanation').text(translate('safaributton_how_to_hide2')).slideToggle(function ()
      {
        var popupheight = $('body').outerHeight();
        safari.extension.popovers[0].height = popupheight;
      });
    } else
    {
      $('#help_hide_explanation').slideToggle();
    }
  });

  $('#link_open').click(function ()
  {
    var linkHref = 'https://getadblock.com/share/';
    BG.ext.pages.open(linkHref);
    closeAndReloadPopup();
  });

});
