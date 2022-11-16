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
/* global browser, localizePage, parseUri, translate */

$(() => {
  localizePage();
  if (window.location && window.location.search) {
    const sectionEl = document.getElementById('imgDIV');
    const newPic = document.createElement('img');
    const searchQuery = parseUri.parseSearch(window.location.search);
    let styleString = 'background-position: 0px 0px; float: none;left: auto; top: auto; bottom: auto; right: auto; display: inline-block;';
    if (searchQuery && searchQuery.url && searchQuery.url.startsWith('file:///')) {
      browser.storage.local.get(searchQuery.url).then((savedCustomImageData) => {
        newPic.src = savedCustomImageData[searchQuery.url].src;
        styleString = `${styleString} width: ${savedCustomImageData[searchQuery.url].width}px; height: ${savedCustomImageData[searchQuery.url].height}px;`;
      });
    } else if (searchQuery && searchQuery.url) {
      newPic.src = searchQuery.url;
      newPic.classList.add('center');
      styleString = `${styleString} width: ${searchQuery.width}px; height: ${searchQuery.height}px;`;
    }
    if (searchQuery.width) {
      newPic.width = searchQuery.width;
    }
    if (searchQuery.height) {
      newPic.height = searchQuery.height;
    }
    if (searchQuery.channel) {
      newPic.alt = translate('preview_channel_image', translate(searchQuery.channel));
    }
    newPic.style.cssText = styleString;
    sectionEl.appendChild(newPic);
  }
});
