

/* For ESLint: List any global identifiers used in this file below */
/* global */

import oceanData from './data/ocean.json';

import Channel from './channel';

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
class OceanChannel extends Channel {
  getLatestListings(callback) {
    for (const ocean of oceanData) {
      this.listings.push(Channel.listingFactory(ocean.width, ocean.height, ocean.url, 'This is a ocean!', 'oceanchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default OceanChannel;
