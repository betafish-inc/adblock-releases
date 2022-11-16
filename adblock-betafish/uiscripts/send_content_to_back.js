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

// eslint-disable-next-line no-unused-vars
function sendContentToBack() {
  // Objects and embeds can catch our clicks unless we lay a div over
  // them.  But even then they can catch our clicks unless they were loaded
  // with wmode=transparent.  So, make them load that way, so that our
  // overlaid div catches the clicks instead.
  // We force a hide and show so they reload with wmode=transparent.  I've
  // seen cases (e.g. mtv3.fi's right side ad) where the show was so fast
  // that the wmode=transparent hadn't been applied; thus, we delay 250ms
  // before showing.
  const all = document.querySelectorAll('object,embed');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    el.oldDisplay = el.style.display;
    el.style.display = 'none';

    if (el.nodeName === 'OBJECT') {
      const param = document.createElement('param');
      param.setAttribute('name', 'wmode');
      param.setAttribute('value', 'transparent');
      el.appendChild(param);
    } else {
      el.setAttribute('wmode', 'transparent');
    }
  }

  window.setTimeout(() => {
    for (let i = 0; i < all.length; i++) {
      all[i].style.display = all[i].oldDisplay;
    }
  }, 250);

  // Also, anybody with a z-index over 1 million is going to get in our
  // way.  Decrease it.
  const zIndexes = document.querySelectorAll('[style*="z-index"]');
  for (let i = 0; i < zIndexes.length; i++) {
    const el = zIndexes[i];
    if (el.style['z-index'] >= 1000000) {
      el.style['z-index'] = 999;
    }
  }
}

// required return value for tabs.executeScript
/* eslint-disable-next-line no-unused-expressions */
'';

//# sourceURL=/uiscripts/send_content_to_back.js
