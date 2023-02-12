/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */
/*
 * Same as the original source vendor\adblockplusui\lib\pages\options.js
 * except:
 *  - updated the paths to imported modules
 *  - the 'findOptionsPage' function will correctly find the AdBlock Options page
 *    when a hash is present in the URL.
 *  - use import / export instead of require
 * /

/** @module options */

"use strict";

import * as ewe from "../../vendor/webext-sdk/dist/ewe-api";
import { port as messagingPort } from "../../vendor/adblockplusui/adblockpluschrome/lib/messaging/port";
import { SessionStorage } from "../../vendor/adblockplusui/adblockpluschrome/lib/storage/session";

/**
 * Key to store/retrieve an optional message to send to the options page after
 * it opens.
 */
const optionsMessageKey = "optionsMessage";

let optionsPort = null;

// Firefox won't let us query for moz-extension:// pages, though
// starting with Firefox 56 an extension can query for its own URLs:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1271354
const optionsUrl = browser.runtime.getURL(
  browser.runtime.getManifest().options_ui.page
);

const session = new SessionStorage("options");

async function onMessage(message, port)
{
  if (message.type != "app.listen")
    return;

  const optionsMessage = await session.get(optionsMessageKey);

  if (!optionsMessage)
    return;

  await session.delete(optionsMessageKey);

  port.postMessage(optionsMessage);
}

async function onConnect(port)
{
  if (!ext.isTrustedSender(port.sender)){
    return;
  }

  if (port.name != "ui"){
    return;
  }

  if (!port.sender.tab || !port.sender.tab.url.startsWith(optionsUrl)) {
    return;
  }

  optionsPort = port;
  optionsPort.onDisconnect.addListener(() =>
  {
    optionsPort = null;
  });
  optionsPort.onMessage.addListener(onMessage);
}
browser.runtime.onConnect.addListener(onConnect);

/**
 * Opens the options page, or switches to its existing tab.
 * @param {Object} [message] - Message to send to options page
 */
async function showOptions(message)
{
  await session.delete(optionsMessageKey);

  // If the options page is already open, focus its tab manually to avoid
  // potentially opening it again, due to browser.runtime.openOptionsPage()
  // behaving differently across browsers
  if (optionsPort)
  {
    // Firefox for Android doesn't support browser.windows
    if ("windows" in browser)
    {
      await browser.windows.update(
        optionsPort.sender.tab.windowId,
        {focused: true}
      );
    }

    await browser.tabs.update(optionsPort.sender.tab.id, {active: true});

    // Send message after focusing options page
    if (message)
    {
      optionsPort.postMessage(message);
    }
  }
  else
  {
    // Send message after initializing options page
    if (message)
    {
      await session.set(optionsMessageKey, message);
    }

    await browser.runtime.openOptionsPage();
  }
}
export { showOptions };

// We need to clear the popup URL on Firefox for Android in order for the
// options page to open instead of the bubble. Unfortunately there's a bug[1]
// which prevents us from doing that, so we must avoid setting the URL on
// Firefox from the manifest at all, instead setting it here only for
// non-mobile.
// [1] - https://bugzilla.mozilla.org/show_bug.cgi?id=1414613
Promise.all([browser.action.getPopup({}),
             browser.runtime.getPlatformInfo()]).then(
  ([popup, platformInfo]) =>
  {
    if (!popup && platformInfo.os != "android")
      browser.action.setPopup({popup: "popup.html"});
  }
);

// On Firefox for Android, open the options page directly when the browser
// action is clicked.
browser.action.onClicked.addListener(async() =>
{
  const [tab] = await browser.tabs.query({active: true});
  const currentPage = new ext.Page(tab);

  let message = null;
  if (/^https?:$/.test(currentPage.url.protocol))
  {
    const isAllowlisted = await ewe.filters.isResourceAllowlisted(
      currentPage.url,
      "document",
      currentPage.id
    );
    message = {
      type: "app.respond",
      action: "showPageOptions",
      args: [
        {
          host: currentPage.url.hostname.replace(/^www\./, ""),
          allowlisted: isAllowlisted
        }
      ]
    };
  }

  await showOptions(message);
});

/**
 * Opens the options page in a new tab and waits for it to load, or switches to
 * the existing tab if the options page is already open.
 *
 * @event "options.open"
 */
messagingPort.on("options.open", async(message, sender) =>
{
  await showOptions();
});
