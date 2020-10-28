'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, require */

const landscapeData = require('./data/landscapes.json');

// Channel containing hard coded Landscapes loaded from CDN.
// Subclass of Channel.
function LandscapesChannel() {
  Channel.call(this);
}
LandscapesChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const listingArray = [];
    for (const landscape of landscapeData) {
      listingArray.push(this.listingFactory(landscape.width, landscape.height, landscape.url, 'This is a landscape!', 'landscapechannelswitchlabel'));
    }
    callback(listingArray);
  },
};

Object.assign(window, {
  LandscapesChannel,
});
