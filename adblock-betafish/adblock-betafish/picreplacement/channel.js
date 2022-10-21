

/* For ESLint: List any global identifiers used in this file below */
/* global  */

import {
  imageSizesMap,
} from './image-sizes-map';
import Listing from './listing';

// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
class Channel {
  constructor() {
    this.listings = [];
  }

  getListings() {
    return this.listings.slice(0); // shallow copy
  }

  static listingFactory(widthParam, heightParam, url, title, channelName) {
    let width = widthParam;
    let height = heightParam;
    const type = Channel.calculateType(width, height);

    if (typeof width === 'number') {
      width = `${width}`;
    }
    if (typeof height === 'number') {
      height = `${height}`;
    }
    return new Listing({
      width,
      height,
      url,
      attributionUrl: url,
      type,
      ratio: Math.max(width, height) / Math.min(width, height),
      title,
      channelName, // message.json key for channel name
    });
  }

  // Update the channel's listings and trigger an 'updated' event.
  refresh() {
    const that = this;
    this.getLatestListings((listings) => {
      that.listings = listings;
    });
  }

  // Load all photos so that they're in the cache.
  static prefetch() {
    // current - noop, since all of the URLs are hard coded.
  }

  static getLatestListings() {
    throw new Error('Implemented by subclass. Call callback with up-to-date listings.');
  }

  static calculateType(w, h) {
    let width = w;
    let height = h;

    if (typeof width === 'string') {
      width = parseInt(width, 10);
    }
    if (typeof height === 'string') {
      height = parseInt(height, 10);
    }
    let type = '';
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio >= 1.5 && ratio < 7) {
      type = (width > height ? imageSizesMap.get('wide') : imageSizesMap.get('tall'));
    } else if (ratio > 7) {
      type = (width > height ? imageSizesMap.get('skinnywide') : imageSizesMap.get('skinnytall'));
    } else {
      type = ((width > 125 || height > 125) ? imageSizesMap.get('big') : imageSizesMap.get('small'));
    }
    return type;
  }
}
export default Channel;
