'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, require */

const oceanData = require('./data/ocean.json');

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function OceanChannel() {
  Channel.call(this);
}

OceanChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const listingArray = [];
    for (const ocean of oceanData) {
      listingArray.push(this.listingFactory(ocean.width, ocean.height, ocean.url, 'This is a ocean!', 'oceanchannelswitchlabel'));
    }
    callback(listingArray);
  },
};

Object.assign(window, {
  OceanChannel,
});
