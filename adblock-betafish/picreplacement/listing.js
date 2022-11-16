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


// Inputs: width:int, height:int, url:url, title:string, attributionUrl:url
class Listing {
  constructor(data) {
    this.width = data.width;
    this.height = data.height;
    this.url = data.url;
    this.title = data.title;
    this.attributionUrl = data.attributionUrl;
    this.channelName = data.channelName;
    if (data.name) {
      this.name = data.name;
    }
    if (data.thumbURL) {
      this.thumbURL = data.thumbURL;
    }
    if (data.userLink) {
      this.userLink = data.userLink;
    }
    if (data.anySize) {
      this.anySize = data.anySize;
    }
    if (data.type) {
      this.type = data.type;
    }
    if (data.ratio) {
      this.ratio = data.ratio;
    }
    if (data.customImage) {
      this.customImage = data.customImage;
    }
  }
}
export default Listing;
