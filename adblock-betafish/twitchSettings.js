/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global browser, ext,
   addCustomFilter, */

import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import { setBadge } from '../vendor/adblockplusui/adblockpluschrome/lib/browserAction';
import { getSettings, settings } from './prefs/settings';

const twitchChannelNamePages = new Map();

// On single page sites, such as Twitch, that update the URL using the History API pushState(),
// they don't actually load a new page, we need to get notified when this happens
// and update the URLs in the Page and Frame objects
const twitchHistoryStateUpdateHandler = async function (details) {
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
      if (await ewe.filters.getAllowingFilters(myPage.id).length) {
        setBadge(details.tabId, { number: '' });
      }
    }
  }
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
const createWhitelistFilterForTwitchChannel = function (url, origin) {
  let twitchChannel;
  if (/ab_channel=/.test(url)) {
    [, twitchChannel] = url.match(/ab_channel=([^]*)/);
  } else {
    twitchChannel = url.split('/').pop();
  }
  if (twitchChannel) {
    const filter = `@@||twitch.tv/*${twitchChannel}^$document`;
    return addCustomFilter(filter, origin);
  }
  return undefined;
};

const twitchMessageHandler = function (message, sender, sendResponse) {
  if (message.command === 'createWhitelistFilterForTwitchChannel' && message.url) {
    sendResponse(createWhitelistFilterForTwitchChannel(message.url, message.origin));
    return;
  }
  if (message.command === 'updateTwitchChannelName' && message.channelName) {
    twitchChannelNamePages.set(sender.tab.id, message.channelName);
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

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  addTwitchAllowlistListeners,
  removeTwitchAllowlistListeners,
  twitchChannelNamePages,
});
