'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, ext, adblockIsPaused, adblockIsDomainPaused
   recordGeneralMessage, log */

const { checkWhitelisted } = require('whitelisting');
const { filterNotifier } = require('filterNotifier');
const { Prefs } = require('prefs');

const updateButtonUIAndContextMenus = function () {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      const page = new ext.Page(tab);
      if (adblockIsPaused() || adblockIsDomainPaused({ url: tab.url.href, id: tab.id })) {
        page.browserAction.setBadge({ number: '' });
      }
      // eslint-disable-next-line no-use-before-define
      updateContextMenuItems(page);
    }
  });
};

// Bounce messages back to content scripts.
const emitPageBroadcast = (function emitBroadcast() {
  const injectMap = {
    topOpenWhitelistUI:
      {
        allFrames: false,
        include: [
          'adblock-jquery.js',
          'adblock-uiscripts-load_wizard_resources.js',
          'adblock-uiscripts-top_open_whitelist_ui.js',
        ],
      },
    topOpenBlacklistUI:
      {
        allFrames: false,
        include: [
          'adblock-jquery.js',
          'adblock-uiscripts-load_wizard_resources.js',
          'adblock-uiscripts-blacklisting-overlay.js',
          'adblock-uiscripts-blacklisting-clickwatcher.js',
          'adblock-uiscripts-blacklisting-elementchain.js',
          'adblock-uiscripts-blacklisting-blacklistui.js',
          'adblock-uiscripts-top_open_blacklist_ui.js',
        ],
      },
    sendContentToBack:
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
  //         alreadyInjected?:int used to recursively inject required scripts.
  const executeOnTab = function (fnName, parameter, alreadyInjected) {
    const injectedSoFar = alreadyInjected || 0;
    const data = injectMap[fnName];
    const details = { allFrames: data.allFrames };

    // If there's anything to inject, inject the next item and recurse.
    if (data.include.length > injectedSoFar) {
      details.file = data.include[injectedSoFar];
      chrome.tabs.executeScript(undefined, details).then(() => {
        executeOnTab(fnName, parameter, injectedSoFar + 1);
      }).catch((error) => {
        log(error);
      });
    } else {
      // Nothing left to inject, so execute the function.
      const param = JSON.stringify(parameter);
      details.code = `${fnName}(${param});`;
      chrome.tabs.executeScript(undefined, details);
    }
  };

  // The emitPageBroadcast() function
  const theFunction = function (request) {
    executeOnTab(request.fn, request.options);
  };

  return theFunction;
}());

const contextMenuItem = (() => ({
  pauseAll:
    {
      title: chrome.i18n.getMessage('pause_adblock_everywhere'),
      contexts: ['all'],
      onclick: () => {
        recordGeneralMessage('cm_pause_clicked');
        adblockIsPaused(true);
        updateButtonUIAndContextMenus();
      },
    },
  unpauseAll:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: () => {
        recordGeneralMessage('cm_unpause_clicked');
        adblockIsPaused(false);
        updateButtonUIAndContextMenus();
      },
    },
  pauseDomain:
    {
      title: chrome.i18n.getMessage('domain_pause_adblock'),
      contexts: ['all'],
      onclick: (info, tab) => {
        recordGeneralMessage('cm_domain_pause_clicked');
        adblockIsDomainPaused({ url: tab.url, id: tab.id }, true);
        updateButtonUIAndContextMenus();
      },
    },
  unpauseDomain:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: (info, tab) => {
        recordGeneralMessage('cm_domain_unpause_clicked');
        adblockIsDomainPaused({ url: tab.url, id: tab.id }, false);
        updateButtonUIAndContextMenus();
      },
    },
  blockThisAd:
    {
      title: chrome.i18n.getMessage('block_this_ad'),
      contexts: ['all'],
      onclick(info, tab) {
        emitPageBroadcast(
          { fn: 'topOpenBlacklistUI', options: { info } },
          { tab },
        );
      },
    },
  blockAnAd:
    {
      title: chrome.i18n.getMessage('block_an_ad_on_this_page'),
      contexts: ['all'],
      onclick(info, tab) {
        emitPageBroadcast(
          { fn: 'topOpenBlacklistUI', options: { nothingClicked: true } },
          { tab },
        );
      },
    },
}))();

const updateContextMenuItems = function (page) {
  // Remove the AdBlock context menu items
  chrome.contextMenus.removeAll();

  // Check if the context menu items should be added
  if (!Prefs.shouldShowBlockElementMenu) {
    return;
  }

  const adblockIsPaused = window.adblockIsPaused();
  const domainIsPaused = window.adblockIsDomainPaused({ url: page.url.href, id: page.id });
  if (adblockIsPaused) {
    chrome.contextMenus.create(contextMenuItem.unpauseAll);
  } else if (domainIsPaused) {
    chrome.contextMenus.create(contextMenuItem.unpauseDomain);
  } else if (checkWhitelisted(page)) {
    chrome.contextMenus.create(contextMenuItem.pauseAll);
  } else {
    chrome.contextMenus.create(contextMenuItem.blockThisAd);
    chrome.contextMenus.create(contextMenuItem.blockAnAd);
    chrome.contextMenus.create(contextMenuItem.pauseDomain);
    chrome.contextMenus.create(contextMenuItem.pauseAll);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status) {
    updateContextMenuItems(new ext.Page(tab));
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'report-html-page') {
    updateContextMenuItems(sender.page);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'sendContentToBack') {
    return;
  } // not for us
  emitPageBroadcast({ fn: 'sendContentToBack', options: {} });
  sendResponse({});
});

// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
filterNotifier.on('load', updateButtonUIAndContextMenus);
filterNotifier.on('save', updateButtonUIAndContextMenus);

Prefs.on(Prefs.shouldShowBlockElementMenu, () => {
  updateButtonUIAndContextMenus();
});

updateButtonUIAndContextMenus();

Object.assign(window, {
  emitPageBroadcast,
  updateButtonUIAndContextMenus,
});
