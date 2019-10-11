'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, localizePage, parseUri, translate */

const BG = chrome.extension.getBackgroundPage();

$(document).ready(() => {
  localizePage();
  if (window.location && window.location.search) {
    const searchQuery = parseUri.parseSearch(window.location.search);
    if (searchQuery && searchQuery.url) {
      const newPic = document.createElement('img');
      newPic.src = searchQuery.url;
      newPic.classList.add('center');
      const sectionEl = document.getElementById('imgDIV');

      if (searchQuery.width) {
        newPic.width = searchQuery.width;
      }
      if (searchQuery.height) {
        newPic.height = searchQuery.height;
      }
      if (searchQuery.channel) {
        newPic.alt = translate('preview_channel_image', translate(searchQuery.channel));
      }

      newPic.style.cssText = `background-position: 0px 0px; float: none;left: auto; top: auto; bottom: auto; right: auto; display: inline-block; width: ${searchQuery.width}px; height: ${searchQuery.height}px;`;
      sectionEl.appendChild(newPic);
    }
  }
});
