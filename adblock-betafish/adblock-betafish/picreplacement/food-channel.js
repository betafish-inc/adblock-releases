

/* For ESLint: List any global identifiers used in this file below */
/* global */

import foodData from './data/food.json';

import Channel from './channel';

// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
class FoodChannel extends Channel {
  getLatestListings(callback) {
    for (const food of foodData) {
      this.listings.push(Channel.listingFactory(food.width, food.height, food.url, 'This is food!', 'foodchannelswitchlabel'));
    }
    callback(this.listings);
  }
}
export default FoodChannel;
