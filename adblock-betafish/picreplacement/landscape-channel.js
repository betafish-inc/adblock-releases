

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
