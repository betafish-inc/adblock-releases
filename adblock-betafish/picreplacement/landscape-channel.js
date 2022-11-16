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
/* global  */

import landscapeData from './data/landscapes.json';

import Channel from './channel';

// Channel containing hard coded Landscapes loaded from CDN.
// Subclass of Channel.
class LandscapesChannel extends Channel {
  getLatestListings(callback) {
    for (const landscape of landscapeData) {
      this.listings.push(Channel.listingFactory(landscape.width, landscape.height, landscape.url, 'This is a landscape!', 'landscapechannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default LandscapesChannel;
