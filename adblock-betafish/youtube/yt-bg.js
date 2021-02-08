'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, getSettings, settings, require, ext, setSetting,
   addCustomFilter, checkAllowlisted, getUserFilters,
   isWhitelistFilter */

const { Filter } = require('filterClasses');
const { filterStorage } = require('filterStorage');
const { filterNotifier } = require('filterNotifier');

const ytChannelNamePages = new Map();

const webRequestFilter = {
  url:
  [
    { hostEquals: 'www.youtube.com' },
  ],
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: channelName:string parsed channel name
// Returns:  null if successful, otherwise an exception
const createAllowlistFilterForYoutubeChannelName = function (channelName) {
  if (channelName) {
    const filterText = `@@||www.youtube.com/*${channelName}|$document`;
    return addCustomFilter(filterText);
  }
  return undefined;
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
const createWhitelistFilterForYoutubeChannel = function (url) {
  let ytChannel;
  if (/ab_channel=/.test(url)) {
    [, ytChannel] = url.match(/ab_channel=([^]*)/);
  } else {
    ytChannel = url.split('/').pop();
  }
  if (ytChannel) {
    return createAllowlistFilterForYoutubeChannelName(ytChannel);
  }
  return undefined;
};

const removeAllowlistFilterForYoutubeChannel = function (text) {
  if (isWhitelistFilter(text)) {
    try {
      const filter = Filter.fromText(text);
      filterStorage.removeFilter(filter);
    } catch (ex) {
      // do nothing;
    }
  }
};

// inject the manage YT subscription
const injectManagedContentScript = function (details, historyUpdated) {
  const { tabId } = details;

  browser.tabs.sendMessage(tabId, { command: 'ping_yt_manage_cs' }).then((pingResponse) => {
    if (pingResponse && pingResponse.status === 'yes') {
      browser.tabs.sendMessage(tabId, { command: 'addYouTubeOnPageIcons', historyUpdated });
    } else {
      browser.tabs.executeScript(tabId, {
        file: 'purify.min.js',
        allFrames: false,
        runAt: 'document_end',
      }).then(() => {
        browser.tabs.executeScript(tabId, {
          file: 'adblock-yt-manage-cs.js',
          allFrames: false,
          runAt: 'document_end',
        }).then(() => {
          browser.tabs.sendMessage(tabId, { command: 'addYouTubeOnPageIcons', historyUpdated });
        });
      });
    }
  });
};


// On single page sites, such as YouTube, that update the URL using the History API pushState(),
// they don't actually load a new page, we need to get notified when this happens
// and update the URLs in the Page and Frame objects
const ytHistoryHandler = function (details) {
  if (details
      && Object.prototype.hasOwnProperty.call(details, 'frameId')
      && Object.prototype.hasOwnProperty.call(details, 'tabId')
      && Object.prototype.hasOwnProperty.call(details, 'url')
      && details.transitionType === 'link') {
    const myURL = new URL(details.url);
    if (myURL.hostname === 'www.youtube.com') {
      const myFrame = ext.getFrame(details.tabId, details.frameId);
      const myPage = ext.getPage(details.tabId);
      myPage._url = myURL;
      myFrame.url = myURL;
      myFrame._url = myURL;
      if (!/ab_channel/.test(details.url) && myURL.pathname === '/watch') {
        browser.tabs.sendMessage(details.tabId, { command: 'updateURLWithYouTubeChannelName' });
      } else if (/ab_channel/.test(details.url) && myURL.pathname !== '/watch') {
        browser.tabs.sendMessage(details.tabId, { command: 'removeYouTubeChannelName' });
      }
      if (getSettings().youtube_manage_subscribed && myURL.pathname === '/feed/channels') {
        // check if the user clicked the back / forward buttons, if so,
        // the data on the page is already loaded,
        // so the content script does not have to wait for it to load.
        injectManagedContentScript(details, !(details.transitionQualifiers && details.transitionQualifiers.includes('forward_back')));
      }
      filterNotifier.emit('page.WhitelistingStateRevalidate', myPage, checkAllowlisted(myPage));
    }
  }
};

const managedSubPageCompleted = function (details) {
  const theURL = new URL(details.url);
  if (theURL.pathname === '/feed/channels') {
    injectManagedContentScript(details);
  }
};

const addYTChannelListeners = function () {
  browser.webNavigation.onHistoryStateUpdated.addListener(ytHistoryHandler, webRequestFilter);
  if (getSettings().youtube_manage_subscribed) {
    browser.webNavigation.onCompleted.addListener(managedSubPageCompleted, webRequestFilter);
  }
};

const removeYTChannelListeners = function () {
  browser.webNavigation.onHistoryStateUpdated.removeListener(ytHistoryHandler, webRequestFilter);
  browser.webNavigation.onCompleted.removeListener(managedSubPageCompleted, webRequestFilter);
};

settings.onload().then(() => {
  if (getSettings().youtube_channel_whitelist) {
    addYTChannelListeners();
  }
});

const openYTManagedSubPage = function () {
  browser.tabs.create({ url: 'https://www.youtube.com/feed/channels' });
};

const getAllAdsAllowedUserFilters = function () {
  const userFilters = getUserFilters();
  const adsAllowedUserFilters = [];
  for (let inx = 0; inx < userFilters.length; inx++) {
    const filterText = userFilters[inx];
    if (isWhitelistFilter(filterText) && filterText.includes('youtube.com')) {
      adsAllowedUserFilters.push(filterText);
    }
  }
  return adsAllowedUserFilters;
};

let previousYTchannelId = '';
const previousYTvideoId = '';
let previousYTuserId = '';

// Listen for the message from the content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'updateYouTubeChannelName' && message.channelName) {
    ytChannelNamePages.set(sender.tab.id, message.channelName);
    sendResponse({});
    return;
  }
  if (message.command === 'get_channel_name_by_channel_id' && message.channelId) {
    if (previousYTchannelId !== message.channelId) {
      previousYTchannelId = message.channelId;
      const xhr = new XMLHttpRequest();
      const { channelId } = message;
      const key = atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz');
      const url = 'https://www.googleapis.com/youtube/v3/channels';
      xhr.open('GET', `${url}?part=snippet&id=${channelId}&key=${key}`);
      xhr.onload = function xhrOnload() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            browser.tabs.sendMessage(sender.tab.id, {
              command: 'updateURLWithYouTubeChannelName',
              channelName,
            });
          }
        }
      };
      xhr.send();
      sendResponse({});
      return;
    }
    browser.tabs.sendMessage(sender.tab.id, {
      command: 'updateURLWithYouTubeChannelName',
      channelName: ytChannelNamePages.get(sender.tab.id),
    });
    sendResponse({});
    return;
  }
  if (message.command === 'get_channel_name_by_user_id' && message.userId) {
    if (previousYTuserId !== message.userId) {
      previousYTuserId = message.userId;
      const xhr = new XMLHttpRequest();
      const { userId } = message;
      const key = atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz');
      const url = 'https://www.googleapis.com/youtube/v3/channels';
      xhr.open('GET', `${url}?part=snippet&forUsername=${userId}&key=${key}`);
      xhr.onload = function xhrOnload() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            browser.tabs.sendMessage(sender.tab.id, {
              command: 'updateURLWithYouTubeChannelName',
              channelName,
            });
          }
        }
      };
      xhr.send();
      sendResponse({});
    } else {
      browser.tabs.sendMessage(sender.tab.id, {
        command: 'updateURLWithYouTubeChannelName',
        channelName: ytChannelNamePages.get(sender.tab.id),
      });
      sendResponse({});
    }
  }
  if (message.command === 'openYTManagedSubPage' && getSettings().youtube_manage_subscribed) {
    openYTManagedSubPage();
    sendResponse({});
  }
  if (message.command === 'getAllAdsAllowedUserFilters') {
    sendResponse({ adsAllowedUserFilters: getAllAdsAllowedUserFilters() });
  }
  if (message.command === 'removeAllowlistFilterForYoutubeChannel' && message.text) {
    removeAllowlistFilterForYoutubeChannel(message.text);
    sendResponse({});
  }
  if (message.command === 'createWhitelistFilterForYoutubeChannel' && message.url) {
    sendResponse(createWhitelistFilterForYoutubeChannel(message.url));
  }
  if (message.command === 'createAllowlistFilterForYoutubeChannelName' && message.channelName) {
    sendResponse(createAllowlistFilterForYoutubeChannelName(message.channelName));
  }
  if (message.command === 'blockAllSubscribedChannel' && message.channelNames) {
    const { channelNames } = message;
    const parsedChannelNames = [];
    const userFilters = getAllAdsAllowedUserFilters();
    for (const [channelName] of Object.entries(channelNames)) {
      const name = channelNames[channelName].parsedChannelName;
      parsedChannelNames.push(name);
      for (let inx = 0; inx < userFilters.length; inx++) {
        const filterText = userFilters[inx];
        if (filterText.indexOf(name) > 1) {
          removeAllowlistFilterForYoutubeChannel(filterText);
        }
      }
    }
    sendResponse({});
  }
  if (message.command === 'allowAllSubscribedChannel' && message.channelNames) {
    const { channelNames } = message;
    for (const [channelName] of Object.entries(channelNames)) {
      const name = channelNames[channelName].parsedChannelName;
      createAllowlistFilterForYoutubeChannelName(name);
    }
    sendResponse({});
  }
});

Object.assign(window, {
  addYTChannelListeners,
  removeYTChannelListeners,
  ytChannelNamePages,
  openYTManagedSubPage,
});
