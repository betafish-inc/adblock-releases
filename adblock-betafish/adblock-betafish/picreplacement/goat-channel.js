

/* For ESLint: List any global identifiers used in this file below */
/* global  */

import goatData from './data/goats.json';

import Channel from './channel';

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
class GoatsChannel extends Channel {
  getLatestListings(callback) {
    for (const goat of goatData) {
      this.listings.push(Channel.listingFactory(goat.width, goat.height, goat.url, 'This is a goat!', 'goatchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default GoatsChannel;
