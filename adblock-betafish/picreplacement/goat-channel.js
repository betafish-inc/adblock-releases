'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, require */

const goatData = require('./data/goats.json');

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function GoatsChannel() {
  Channel.call(this);
}

GoatsChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const listingArray = [];
    for (const goat of goatData) {
      listingArray.push(this.listingFactory(goat.width, goat.height, goat.url, 'This is a goat!', 'goatchannelswitchlabel'));
    }
    callback(listingArray);
  },
};

Object.assign(window, {
  GoatsChannel,
});
