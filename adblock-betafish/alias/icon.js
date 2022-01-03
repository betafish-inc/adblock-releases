/*
 * Same as the original source adblockpluschrome/lib/icon.js
 * except:
 * - updated image file names from 'abp-' to 'ab-'
 * - updated the 'import' paths
 * - use the term 'whitelisted' instead of 'allowlisted' for now
 * - call renderIcons() at the end of the module for all platforms,
 *   not just Chromium
 * - added the showIconBadgeCTA, getNewBadgeTextReason functions, and related
 *   message listeners
 */
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

/** @module icon */

"use strict";

import { filterNotifier } from "filterNotifier";
import { setIconPath, setIconImageData, toggleBadge } from "../../adblockplusui/adblockpluschrome/lib/browserAction";
import * as info from "info";
const browserAction = require('../../adblockplusui/adblockpluschrome/lib/browserAction');

const ANIMATION_LOOPS = 3;
const FRAME_IN_MS = 100;

export const statsInIconKey = 'current_show_statsinicon';

let frameOpacities = calculateFrameOpacities(9, 7);
let frameOpacitiesCritical = calculateFrameOpacities(5, 3);

let stopRequested = false;
let canUpdateIcon = true;
let notRunning = Promise.resolve();
let allowlistedState = new ext.PageMap();

let icons = [null, null];

function easeOut(progress) {
  // This is merely an approximation to the built-in ease-out timing function
  // https://css-tricks.com/emulating-css-timing-functions-javascript/
  return 1 - Math.pow(1 - progress, 1.675);
}

function calculateFrameOpacities(keyframeFrames, transitionFrames) {
  let opacities = [];

  // Show second half of first keyframe
  // Omit first frame because it's only shown after the first timeout
  for (let i = 0; i < keyframeFrames / 2 - 1; i++)
    opacities.push(0);
  // Transition from first to second keyframe
  for (let i = 0; i < transitionFrames; i++)
    opacities.push(easeOut((i + 1) / (transitionFrames + 1)));
  // Show second keyframe
  for (let i = 0; i < keyframeFrames; i++)
    opacities.push(1);
  // Transition from second to first keyframe
  for (let i = 0; i < transitionFrames; i++)
    opacities.push(easeOut((transitionFrames - i) / (transitionFrames + 1)));
  // Show first half of first keyframe
  // Omit last frame due to an additional timeout that resets the icon
  for (let i = 0; i < keyframeFrames / 2 - 1; i++)
    opacities.push(0);

  return opacities;
}

async function loadImage(url) {
  let response = await fetch(url);
  let blob = await response.blob();
  return createImageBitmap(blob);
}

async function renderIcons() {
  let paths = [
    "icons/ab-16.png", "icons/ab-16-whitelisted.png",
    "icons/ab-32.png", "icons/ab-32-whitelisted.png"
  ];

  for (let path of paths) {
    let image = await loadImage(path);
    let [, size, allowlisted] = /\/ab-(16|32)(-whitelisted)?\./.exec(path);

    let canvas = new OffscreenCanvas(size, size);
    let context = canvas.getContext("2d");
    let imageData = icons[!!allowlisted | 0] || {};

    context.globalAlpha = 1;
    context.drawImage(image, 0, 0);
    imageData[size] = context.getImageData(0, 0, size, size);

    icons[!!allowlisted | 0] = imageData;
  }
}

function setIcon(page, opacity, frames) {
  opacity = opacity || 0;
  let allowlisted = !!allowlistedState.get(page);

  if (!frames) {
    if (opacity > 0.5) {
      setIconPath(
        page.id,
        "/icons/ab-$size-notification.png"
      );
    }
    else if (icons[allowlisted | 0]) {
      setIconImageData(page.id, icons[allowlisted | 0]);
    }
    else {
      setIconPath(
        page.id,
        "/icons/ab-$size" + (allowlisted ? "-allowlisted" : "") + ".png"
      );
    }
  }
  else {
    browser.browserAction.setIcon({
      tabId: page.id,
      imageData: frames["" + opacity + allowlisted]
    });
  }
}

filterNotifier.on("page.AllowlistingStateRevalidate", (page, filter) => {
  allowlistedState.set(page, !!filter);
  if (canUpdateIcon)
    setIcon(page);
});

async function renderFrames(opacities) {
  let images = await Promise.all([
    loadImage("icons/ab-16.png"),
    loadImage("icons/ab-16-whitelisted.png"),
    loadImage("icons/ab-16-whitelisted.png"),
    loadImage("icons/ab-20.png"),
    loadImage("icons/ab-20-whitelisted.png"),
    loadImage("icons/ab-20-whitelisted.png"),
    loadImage("icons/ab-32.png"),
    loadImage("icons/ab-32-whitelisted.png"),
    loadImage("icons/ab-32-whitelisted.png"),
    loadImage("icons/ab-40.png"),
    loadImage("icons/ab-40-whitelisted.png"),
    loadImage("icons/ab-40-whitelisted.png"),
  ]);
  opacities = new Set(opacities);
  let imageMap = {
    16: { base: [images[0], images[1]], overlay: images[2] },
    20: { base: [images[3], images[4]], overlay: images[5] },
    32: { base: [images[6], images[7]], overlay: images[8] },
    40: { base: [images[9], images[10]], overlay: images[11] }
  };

  let frames = {};
  let canvas = new OffscreenCanvas(0, 0);
  let context = canvas.getContext("2d");

  for (let allowlisted of [false, true]) {
    for (let opacity of opacities) {
      let imageData = {};
      let sizes = [16, 20, 32, 40];
      for (let size of sizes) {
        canvas.width = size;
        canvas.height = size;
        context.globalAlpha = 1;
        context.drawImage(imageMap[size]["base"][allowlisted | 0], 0, 0);
        context.globalAlpha = opacity;
        context.drawImage(imageMap[size]["overlay"], 0, 0);
        imageData[size] = context.getImageData(0, 0, size, size);
      }
      frames["" + opacity + allowlisted] = imageData;
    }
  }

  return frames;
}

async function animateIcon(opacities, frames) {
  let tabs = await browser.tabs.query({ active: true });
  let pages = tabs.map(tab => new ext.Page(tab));

  let animationLoop = 0;
  let animationStep = 0;
  let numberOfFrames = opacities.length;
  let opacity = 0;

  let onActivated = page => {
    pages.push(page);
    setIcon(page, opacity, frames);
    toggleBadge(page.id, true);
  };
  ext.pages.onActivated.addListener(onActivated);

  canUpdateIcon = false;
  for (let page of pages)
    toggleBadge(page.id, true);
  return new Promise((resolve, reject) => {
    let interval = setInterval(() => {
      let oldOpacity = opacity;
      opacity = opacities[animationStep++];

      if (opacity != oldOpacity) {
        for (let page of pages) {
          if (allowlistedState.has(page))
            setIcon(page, opacity, frames);
        }
      }

      if (animationStep > numberOfFrames) {
        if (++animationLoop > ANIMATION_LOOPS - 1 || stopRequested) {
          clearInterval(interval);
          ext.pages.onActivated.removeListener(onActivated);
          for (let page of pages)
            toggleBadge(page.id, false);
          canUpdateIcon = true;
          resolve();
        }
        else {
          animationStep = 0;
        }
      }
    }, FRAME_IN_MS);
  });
}

/**
 * Stops to animate the browser action icon
 * after the current interval has been finished.
 *
 * @return {Promise} A promise that is fullfilled when
 *                   the icon animation has been stopped.
 */
export async function stopIconAnimation() {
  stopRequested = true;
  await notRunning;
  stopRequested = false;
}

/**
 * Starts to animate the browser action icon to indicate a pending notifcation.
 * If the icon is already animated, it replaces the previous
 * animation as soon as the current interval has been finished.
 *
 * @param {string} type  The notification type (i.e: "information" or
 *                       "critical".)
 */
export function startIconAnimation(type) {
  let opacities = frameOpacities;
  if (type == "critical")
    opacities = frameOpacitiesCritical;

  notRunning = Promise.all([renderFrames(opacities), stopIconAnimation()])
    .then(results => {
      if (stopRequested)
        return;

      let frames = results[0];
      return animateIcon(opacities, frames);
    });
}

renderIcons();

/**
 * Returns the Object containing all of the reasons the text on the toolbar icon / badge is 'new'
 *
 */
export const NEW_BADGE_REASONS = {
  SEVEN_DAY: 'seven day',
  UPDATE: 'update',
  VPN_CTA: 'vpn cta',
  FREE_DC_UPDATE: 'free dc update',
};

/**
 * Handles the display of the New badge on the toolbar icon.
 * @param {Boolean} [showBadge] true shows the badge, false removes the badge
 */

let newBadgeTextReason = "";

export function showIconBadgeCTA(showBadge, reason) {
  if (!License.shouldShowPremiumCTA()) {
    return;
  }
  if (showBadge) {
    let newBadgeText = translate('new_badge');
    // Text that exceeds 4 characters is truncated on the toolbar badge,
    // so we default to English
    if (!newBadgeText || newBadgeText.length >= 5) {
      newBadgeText = 'New';
    }
    storageSet(statsInIconKey, Prefs.show_statsinicon);
    Prefs.show_statsinicon = false;
    // wait 10 seconds to allow any other ABP setup tasks to finish
    setTimeout(() => {
      // process all currently opened tabs
      browser.tabs.query({}).then((tabs) => {
        for (const tab of tabs) {
          if (tab.url && tab.url.startsWith('http')) {
            browserAction.setBadge(tab.id, { color: '#03bcfc', number: newBadgeText });
            newBadgeTextReason = reason || '';
          }
        }
      });
    }, 10000); // 10 seconds
  } else {
    // Restore show_statsinicon if we previously stored its value
    const storedValue = storageGet(statsInIconKey);
    if (typeof storedValue === 'boolean') {
      Prefs.show_statsinicon = storedValue;
      storageSet(statsInIconKey); // remove the data, since we no longer need it
      browser.tabs.query({}).then((tabs) => {
        for (const tab of tabs) {
          browser.browserAction.setBadgeText({
            tabId: tab.id,
            text: '',
          });
        }
      });
      browser.browserAction.setBadgeText({ text: ' ' });
    }
  }
};

/**
 * Returns the String reason the text on the toolbar icon / badge is 'new'
 *
 */
export function getNewBadgeTextReason() {
  return newBadgeTextReason;
};


browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'showIconBadgeCTA' && typeof request.value === 'boolean') {
    showIconBadgeCTA(request.value);
    sendResponse({});
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'getNewBadgeTextReason') {
    sendResponse({ reason: getNewBadgeTextReason() });
  }
});
