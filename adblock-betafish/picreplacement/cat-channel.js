

/* For ESLint: List any global identifiers used in this file below */
/* global   */

import catData from './data/cats.json';

import Channel from './channel';

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
class CatsChannel extends Channel {
  getLatestListings(callback) {
    for (const cat of catData) {
      this.listings.push(Channel.listingFactory(cat.width, cat.height, cat.url, 'This is a cat!', 'catchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default CatsChannel;
