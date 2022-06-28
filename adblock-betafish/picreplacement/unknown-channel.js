

/* For ESLint: List any global identifiers used in this file below */
/* global  */

import Channel from './channel';

// Empty Channel
// Subclass of Channel.
//
// Allows the Sync process to create an new named Channel
// when the sync process recieves a request with a unknown channel name
class UnknownChannel extends Channel {
  // eslint-disable-next-line class-methods-use-this
  getLatestListings(callback) {
    callback([]);
  }
}
export default UnknownChannel;
