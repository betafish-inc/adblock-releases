

/* For ESLint: List any global identifiers used in this file below */
/* global  */

import birdData from './data/birds.json';

import Channel from './channel';

// Channel containing hard coded birds loaded from disk.
// Subclass of Channel.
class BirdChannel extends Channel {
  getLatestListings(callback) {
    for (const bird of birdData) {
      this.listings.push(Channel.listingFactory(bird.width, bird.height, bird.url, 'This is a bird!', 'birdchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default BirdChannel;
