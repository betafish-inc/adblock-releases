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

function Overlay(options) {
  const el = $(options.domElement);

  this.image = $("<div class='adblock-killme-overlay'></div>")
    .css({
      left: el.position().left,
      top: el.position().top,
      'background-color': 'transparent !important',
      position: 'absolute',
      'z-index': 1000000,
    })
    .width(el.width() || 0)
    .height(el.height() || 0);
  this.el = el;
  this.clickHandler = options.clickHandler;

  this.image
    .on('mouseenter', function onEnter() {
      // crbug.com/110084
      this.style.setProperty('background-color', 'rgba(130, 180, 230, 0.5)', 'important');
    })
    .on('mouseleave', function onLeave() {
      // crbug.com/110084
      this.style.setProperty('background-color', 'transparent', 'important');
    });

  Overlay.instances.push(this);
}

Overlay.instances = [];

Overlay.removeAll = function removeAllOverlays() {
  $.each(Overlay.instances, (i, overlay) => {
    overlay.image.remove();
  });
  Overlay.instances = [];
};

Overlay.prototype.display = function displayOverlay() {
  const that = this;
  this.image
    .appendTo(that.el.parent())
    .on('click', () => {
      that.clickHandler(that.el);
      return false;
    });
};

// required return value for tabs.executeScript
/* eslint-disable-next-line no-unused-expressions */
'';

//# sourceURL=/uiscripts/blacklisting/overlay.js
