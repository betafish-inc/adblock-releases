'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, getSettings, settings, require, ext, setSetting,
   addCustomFilter, filterNotifier, checkAllowlisted */

const browserAction = require('browserAction');

const twitchChannelNamePages = new Map();

// On single page sites, such as Twitch, that update the URL using the History API pushState(),
// they don't actually load a new page, we need to get notified when this happens
// and update the URLs in the Page and Frame objects
const twitchHistoryStateUpdateHandler = function (details) {
  if (details
      && Object.prototype.hasOwnProperty.call(details, 'frameId')
      && Object.prototype.hasOwnProperty.call(details, 'tabId')
      && Object.prototype.hasOwnProperty.call(details, 'url')
      && details.transitionType === 'link') {
    const myURL = new URL(details.url);
    if (myURL.hostname === 'www.twitch.tv') {
      const myFrame = ext.getFrame(details.tabId, details.frameId);
      const myPage = ext.getPage(details.tabId);
      myPage._url = myURL;
      myFrame.url = myURL;
      myFrame._url = myURL;
      if (checkAllowlisted(myPage)) {
        browserAction.setBadge(details.tabId, { number: '' });
      }
    }
  }
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
const createWhitelistFilterForTwitchChannel = function (url) {
  let twitchChannel;
  if (/ab_channel=/.test(url)) {
    [, twitchChannel] = url.match(/ab_channel=([^]*)/);
  } else {
    twitchChannel = url.split('/').pop();
  }
  if (twitchChannel) {
    const filter = `@@||twitch.tv/*${twitchChannel}^$document`;
    return addCustomFilter(filter);
  }
  return undefined;
};

const twitchMessageHandler = function (message, sender, sendResponse) {
  if (message.command === 'createWhitelistFilterForTwitchChannel' && message.url) {
    sendResponse(createWhitelistFilterForTwitchChannel(message.url));
    return;
  }
  if (message.command === 'updateTwitchChannelName' && message.channelName) {
    twitchChannelNamePages.set(sender.tab.id, message.channelName);
    sendResponse({});
  }
  if (message.command === 'allowlistingStateRevalidate') {
    const page = new ext.Page(sender.tab);
    filterNotifier.emit('page.WhitelistingStateRevalidate', page, checkAllowlisted(page));
    sendResponse({});
  }
};

const addTwitchAllowlistListeners = function () {
  twitchChannelNamePages.clear();
  browser.runtime.onMessage.addListener(twitchMessageHandler);
  browser.webNavigation.onHistoryStateUpdated.addListener(twitchHistoryStateUpdateHandler);
};

const removeTwitchAllowlistListeners = function () {
  twitchChannelNamePages.clear();
  browser.runtime.onMessage.removeListener(twitchMessageHandler);
  browser.webNavigation.onHistoryStateUpdated.removeListener(twitchHistoryStateUpdateHandler);
};

settings.onload().then(() => {
  if (getSettings().twitch_channel_allowlist) {
    addTwitchAllowlistListeners();
  }
});

Object.assign(window, {
  addTwitchAllowlistListeners,
  removeTwitchAllowlistListeners,
  twitchChannelNamePages,
});
