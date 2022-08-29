

/* For ESLint: List any global identifiers used in this file below */
/* global */

import dogData from './data/dogs.json';

import Channel from './channel';

// Channel containing hard coded dogs loaded from CDN
// Subclass of Channel.
class DogsChannel extends Channel {
  getLatestListings(callback) {
    for (const dog of dogData) {
      this.listings.push(Channel.listingFactory(dog.width, dog.height, dog.url, 'This is a dog!', 'dogchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default DogsChannel;
