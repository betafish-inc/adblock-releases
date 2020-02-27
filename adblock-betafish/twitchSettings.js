'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, getSettings, idleHandler, settings, require */

const { idleHandler } = require('./idlehandler.js');

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const twitchSettings = {
  player: '.video-player__container',
  playerVideo: '.video-player__container video',
  playerAd: '.video-player__container iframe',
  muteButton: "button[data-a-target='player-mute-unmute-button']",
  adNotice: '.tw-absolute.tw-c-background-overlay.tw-c-text-overlay.tw-inline-block.tw-left-0.tw-pd-1.tw-top-0',
  overlay: '.video-player__overlay',
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'getTwitchSettings') {
    return;
  }

  const response = {
    twitchSettings,
    twitchEnabled: getSettings().twitch_hiding,
  };
  sendResponse(response);
});

const getTwitchSettingsFile = function () {
  fetch('https://cdn.adblockcdn.com/filters/twitchSettings.json').then(resp => resp.json()).then((data) => {
    if (data) {
      twitchSettings.player = data.player;
      twitchSettings.playerVideo = data.playerVideo;
      twitchSettings.playerAd = data.playerAd;
      twitchSettings.muteButton = data.muteButton;
      twitchSettings.adNotice = data.adNotice;
      twitchSettings.overlay = data.overlay;
    }
  });
};

settings.onload().then(() => {
  const twitchEnabled = getSettings().twitch_hiding;
  if (twitchEnabled) {
    getTwitchSettingsFile();
    window.setInterval(() => {
      idleHandler.scheduleItemOnce(() => {
        getTwitchSettingsFile();
      });
    }, DAY_IN_MS);
  }
});

Object.assign(window, {
  twitchSettings,
  getTwitchSettingsFile,
});
