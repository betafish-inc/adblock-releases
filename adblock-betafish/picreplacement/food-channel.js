'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, require */

const foodData = require('./data/food.json');

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function FoodChannel() {
  Channel.call(this);
}

FoodChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const listingArray = [];
    for (const food of foodData) {
      listingArray.push(this.listingFactory(food.width, food.height, food.url, 'This is food!', 'foodchannelswitchlabel'));
    }
    callback(listingArray);
  },
};

Object.assign(window, {
  FoodChannel,
});
