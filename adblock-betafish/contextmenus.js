const {checkWhitelisted} = require("whitelisting");

var updateButtonUIAndContextMenus = function ()
{
  ext.pages.query({}, function (pages)
  {
    pages.forEach(function (page)
    {
      if (adblockIsPaused())
      {
        page.browserAction.setBadge({ number: '' });
      }

      updateContextMenuItems(page);
    });
  });
};

var updateContextMenuItems = function (page)
{
  // Remove the AdBlock context menu
  page.contextMenus.remove(AdBlockContextMenuItemOne);
  page.contextMenus.remove(AdBlockContextMenuItemTwo);

  // Check if the context menu items should be added
  if (Prefs.shouldShowBlockElementMenu &&
      !checkWhitelisted(page))
  {
    page.contextMenus.create(AdBlockContextMenuItemOne);
    page.contextMenus.create(AdBlockContextMenuItemTwo);
  }
};

ext.pages.onLoading.addListener(updateContextMenuItems);

ext.onMessage.addListener(function (msg, sender, sendResponse)
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
FilterNotifier.addListener(function (action)
{
  if (action == 'load' || action == 'save')
  {
    updateButtonUIAndContextMenus();
  }
});

Prefs.on(Prefs.shouldShowBlockElementMenu, function ()
{
  updateButtonUIAndContextMenus();
});

updateButtonUIAndContextMenus();

var AdBlockContextMenuItemOne = {
    title: ext.i18n.getMessage('block_this_ad'),
    contexts: ['all'],
    onclick: function (page, clickdata)
    {
      emitPageBroadcast(
        { fn:'top_open_blacklist_ui', options:{ info: clickdata } },
        { tab: page }
      );
    },
  };

var AdBlockContextMenuItemTwo = {
    title: ext.i18n.getMessage('block_an_ad_on_this_page'),
    contexts: ['all'],
    onclick: function (page, clickdata)
    {
      emitPageBroadcast(
        { fn:'top_open_blacklist_ui', options:{ nothing_clicked: true } },
        { tab: page }
      );
    },
  };

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
            'punycode.min.js',
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
            'punycode.min.js',
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
