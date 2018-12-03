const {checkWhitelisted} = require("whitelisting");
const {filterNotifier} = require("filterNotifier");
const Prefs = require('prefs').Prefs;

var updateButtonUIAndContextMenus = function ()
{
  chrome.tabs.query({}, tabs =>
  {
    for (let tab of tabs) {
      const page = new ext.Page(tab);
      if (adblockIsPaused() || adblockIsDomainPaused({"url": tab.url.href, "id": tab.id}))
      {
        page.browserAction.setBadge({ number: '' });
      }
      updateContextMenuItems(page);
    }
  });
};

var updateContextMenuItems = function (page)
{
  // Remove the AdBlock context menu
  page.contextMenus.remove(contextMenuItem.blockThisAd);
  page.contextMenus.remove(contextMenuItem.blockAnAd);
  page.contextMenus.remove(contextMenuItem.pauseAll);
  page.contextMenus.remove(contextMenuItem.unpauseAll);
  page.contextMenus.remove(contextMenuItem.pauseDomain);
  page.contextMenus.remove(contextMenuItem.unpauseDomain);

  // Check if the context menu items should be added
  if (!Prefs.shouldShowBlockElementMenu) {
    return;
  }

  const adblockIsPaused = window.adblockIsPaused();
  const domainIsPaused = window.adblockIsDomainPaused({"url": page.url.href, "id": page.id});

  if (adblockIsPaused)
  {
    page.contextMenus.create(contextMenuItem.unpauseAll);
  }
  else if (domainIsPaused)
  {
    page.contextMenus.create(contextMenuItem.unpauseDomain);
  }
  else if (checkWhitelisted(page))
  {
    page.contextMenus.create(contextMenuItem.pauseAll);
  }
  else
  {
    page.contextMenus.create(contextMenuItem.blockThisAd);
    page.contextMenus.create(contextMenuItem.blockAnAd);
    page.contextMenus.create(contextMenuItem.pauseDomain);
    page.contextMenus.create(contextMenuItem.pauseAll);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
{
  if (changeInfo.status == "loading") {
    updateContextMenuItems(new ext.Page(tab));
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse)
{
  switch (msg.type)
  {
    case 'report-html-page':
      updateContextMenuItems(sender.page);
      break;
  }
});

// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
filterNotifier.on("load", updateButtonUIAndContextMenus);
filterNotifier.on("save", updateButtonUIAndContextMenus);

Prefs.on(Prefs.shouldShowBlockElementMenu, function ()
{
  updateButtonUIAndContextMenus();
});

updateButtonUIAndContextMenus();

const contextMenuItem = (() =>
{
  return {
    pauseAll:
    {
      title: chrome.i18n.getMessage('pause_adblock_everywhere'),
      contexts: ['all'],
      onclick: () =>
      {
        recordGeneralMessage('cm_pause_clicked');
        adblockIsPaused(true);
        updateButtonUIAndContextMenus();
      },
    },
    unpauseAll:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: () =>
      {
        recordGeneralMessage('cm_unpause_clicked');
        adblockIsPaused(false);
        updateButtonUIAndContextMenus();
      },
    },
    pauseDomain:
    {
      title: chrome.i18n.getMessage('domain_pause_adblock'),
      contexts: ['all'],
      onclick: (page) =>
      {
        recordGeneralMessage('cm_domain_pause_clicked');
        adblockIsDomainPaused({'url': page.url.href, 'id': page.id}, true);
        updateButtonUIAndContextMenus();
      },
    },
    unpauseDomain:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: (page) =>
      {
        recordGeneralMessage('cm_domain_unpause_clicked');
        adblockIsDomainPaused({'url': page.url.href, 'id': page.id}, false);
        updateButtonUIAndContextMenus();
      },
    },
    blockThisAd:
    {
      title: chrome.i18n.getMessage('block_this_ad'),
      contexts: ['all'],
      onclick: function (page, clickdata)
      {
        emitPageBroadcast(
          { fn:'top_open_blacklist_ui', options:{ info: clickdata } },
          { tab: page }
        );
      },
    },
    blockAnAd:
    {
      title: chrome.i18n.getMessage('block_an_ad_on_this_page'),
      contexts: ['all'],
      onclick: function (page)
      {
        emitPageBroadcast(
          { fn:'top_open_blacklist_ui', options:{ nothing_clicked: true } },
          { tab: page }
        );
      },
    },
  };
})();

// Bounce messages back to content scripts.
if (!SAFARI)
{
  var emitPageBroadcast = (function ()
  {
    var injectMap =
    {
        top_open_whitelist_ui:
        {
          allFrames: false,
          include: [
            'adblock-jquery.js',
            'adblock-jquery-ui.js',
            'adblock-uiscripts-load_jquery_ui.js',
            'adblock-uiscripts-top_open_whitelist_ui.js',
            ],
        },
        top_open_blacklist_ui:
        {
          allFrames: false,
          include: [
            'adblock-jquery.js',
            'adblock-jquery-ui.js',
            'adblock-uiscripts-load_jquery_ui.js',
            'adblock-uiscripts-blacklisting-overlay.js',
            'adblock-uiscripts-blacklisting-clickwatcher.js',
            'adblock-uiscripts-blacklisting-elementchain.js',
            'adblock-uiscripts-blacklisting-blacklistui.js',
            'adblock-uiscripts-top_open_blacklist_ui.js',
            ],
        },
        send_content_to_back:
        {
          allFrames: true,
          include: ['adblock-uiscripts-send_content_to_back.js'],
        },
      };

    // Inject the required scripts to execute fnName(parameter) in
    // the current tab.
    // Inputs: fnName:string name of function to execute on tab.
    //         fnName must exist in injectMap above.
    //         parameter:object to pass to fnName.  Must be JSON.stringify()able.
    //         injectedSoFar?:int used to recursively inject required scripts.
    var executeOnTab = function (fnName, parameter, injectedSoFar)
    {
      injectedSoFar = injectedSoFar || 0;
      var data = injectMap[fnName];
      var details = { allFrames: data.allFrames };

      // If there's anything to inject, inject the next item and recurse.
      if (data.include.length > injectedSoFar)
      {
        details.file = data.include[injectedSoFar];
        chrome.tabs.executeScript(undefined, details, function ()
          {
          if (chrome.runtime.lastError)
            {
            log(chrome.runtime.lastError);
            return;
          }

          executeOnTab(fnName, parameter, injectedSoFar + 1);
        });
      }

      // Nothing left to inject, so execute the function.
      else
      {
        var param = JSON.stringify(parameter);
        details.code = fnName + '(' + param + ');';
        chrome.tabs.executeScript(undefined, details);
      }
    };

    // The emitPageBroadcast() function
    var theFunction = function (request)
    {
      executeOnTab(request.fn, request.options);
    };

    return theFunction;
  })();
}
Object.assign(window, {
  emitPageBroadcast,
  updateButtonUIAndContextMenus
});