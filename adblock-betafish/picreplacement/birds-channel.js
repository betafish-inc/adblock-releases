'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, require */

const birdData = require('./data/birds.json');

// Channel containing hard coded birds loaded from disk.
// Subclass of Channel.
function BirdChannel() {
  Channel.call(this);
}

BirdChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const listingArray = [];
    for (const bird of birdData) {
      listingArray.push(this.listingFactory(bird.width, bird.height, bird.url, 'This is a bird!', 'birdchannelswitchlabel'));
    }
    callback(listingArray);
  },
};

Object.assign(window, {
  BirdChannel,
});
