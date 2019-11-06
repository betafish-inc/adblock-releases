'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, getUrlFromId, getSettings, storageGet, storageSet */

const { Subscription } = require('subscriptionClasses');
const { filterStorage } = require('filterStorage');
const { EventEmitter } = require('events');
const {
  imageSizesMap, WIDE, TALL, SKINNYWIDE, SKINNYTALL,
} = require('./image-sizes-map');

const minjQuery = require('../jquery/jquery.min');

const channelsNotifier = new EventEmitter();

const subscription1 = Subscription.fromURL(getUrlFromId('antisocial'));
const subscription2 = Subscription.fromURL(getUrlFromId('annoyances'));

// Inputs: width:int, height:int, url:url, title:string, attributionUrl:url
function Listing(data) {
  this.width = data.width;
  this.height = data.height;
  this.url = data.url;
  this.title = data.title;
  this.attributionUrl = data.attributionUrl;
  this.channelName = data.channelName;
  if (data.name) {
    this.name = data.name;
  }
  if (data.thumbURL) {
    this.thumbURL = data.thumbURL;
  }
  if (data.userLink) {
    this.userLink = data.userLink;
  }
  if (data.anySize) {
    this.anySize = data.anySize;
  }
  if (data.type) {
    this.type = data.type;
  }
  if (data.ratio) {
    this.ratio = data.ratio;
  }
}

// Contains and provides access to all the photo channels.
function Channels() {
  this.channelGuide = undefined; // maps channel ids to channels and metadata
  this.loadFromStorage();
}
Channels.prototype = {
  // Inputs:
  //   name:string - a Channel class name.
  //   param:object - the single ctor parameter to the Channel class.
  //   enabled:bool - true if this channel is to be used for pictures.
  // Returns:
  //   id of newly created channel, or undefined if the channel already existed.
  add(data) {
    let Klass = window[data.name];
    if (!Klass) {
      Klass = window.UnknownChannel;
    }
    const dataParam = JSON.stringify(data.param);
    for (const id in this.channelGuide) {
      const c = this.channelGuide[id];
      if (c.name === data.name && JSON.stringify(c.param) === dataParam) {
        return undefined;
      }
    }
    const id = Math.floor(Math.random() * Date.now());
    const channel = new Klass(data.param);
    this.channelGuide[id] = {
      name: data.name,
      param: data.param,
      enabled: data.enabled,
      channel,
    };
    this.saveToStorage();
    const that = this;
    minjQuery(channel).bind('updated', () => {
      chrome.extension.sendRequest({ command: 'channel-updated', id });
      if (that.channelGuide[id].enabled) {
        that.channelGuide[id].channel.prefetch();
      }
    });
    channel.refresh();
    return id;
  },

  remove(channelId) {
    delete this.channelGuide[channelId];
    this.saveToStorage();
  },

  // Return read-only map from each channel ID to
  // { name, param, enabled }.
  getGuide() {
    const results = {};
    for (const id in this.channelGuide) {
      const c = this.channelGuide[id];
      results[id] = {
        name: c.name,
        param: c.param,
        enabled: c.enabled,
      };
    }

    return results;
  },

  // Return id for channel name
  getIdByName(name) {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].name === name) {
        return id;
      }
    }
    return undefined;
  },

  getListings(id) {
    return this.channelGuide[id].channel.getListings();
  },
  setEnabled(id, enabled) {
    const originalValue = this.channelGuide[id].enabled;
    this.channelGuide[id].enabled = enabled;
    this.saveToStorage();
    if (originalValue !== enabled) {
      channelsNotifier.emit('channels.changed', id, enabled, originalValue);
    }
  },

  refreshAllEnabled() {
    for (const id in this.channelGuide) {
      const data = this.channelGuide[id];
      if (data.enabled) {
        data.channel.refresh();
      }
    }
  },

  isAnyEnabled() {
    for (const id in this.channelGuide) {
      const channel = this.channelGuide[id];
      if (channel.enabled) {
        return true;
      }
    }
    return false;
  },

  disableAllChannels() {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].enabled) {
        this.channelGuide[id].enabled = false;
        channelsNotifier.emit('channels.changed', id, false, true);
      }
    }
  },

  // Returns a random Listing from all enabled channels or from channel
  // |channelId| if specified, trying to match the ratio of |width| and
  // |height| decently.  Returns undefined if there are no enabled channels.
  randomListing(opts) {
    if (!getSettings().picreplacement) {
      return undefined;
    }
    // if the element to be replace is 'fixed' in position, it may make for bad pic
    // replacement element.
    if (opts.position === 'fixed') {
      for (const sub of filterStorage.subscriptions()) {
        if (sub.url === subscription1.url || sub.url === subscription2.url) {
          return undefined;
        }
      }
    }

    const heightLowRange = opts.height;
    const widthLowRange = opts.width;
    const heightHighRange = (opts.height * 1.25);
    const widthHighRange = (opts.width * 1.25);
    const typeMatchListings = [];
    const rangeLimitedListings = [];
    let targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);

    for (const id in this.channelGuide) {
      const data = this.channelGuide[id];
      if (opts.channelId === id || (data.enabled && !opts.channelId)) {
        data.channel.getListings().forEach((element) => {
          if (
            (opts.type === WIDE || opts.type === SKINNYWIDE)
            && (element.type !== SKINNYTALL)
            && (element.width <= widthHighRange)
            && (element.height >= heightLowRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          } else if (
            (opts.type === TALL || opts.type === SKINNYTALL)
            && (element.type !== SKINNYWIDE)
            && (element.width >= widthLowRange)
            && (element.width <= widthHighRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          } else if (
            (opts.type !== WIDE)
            && (opts.type !== TALL)
            && (opts.type !== SKINNYTALL)
            && (opts.type !== SKINNYWIDE)
            && (element.width >= widthLowRange)
            && (element.width <= widthHighRange)
            && (element.height >= heightLowRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          }
          if (
            opts.type === element.type
            && element.width >= widthLowRange
            && element.height >= heightLowRange
          ) {
            typeMatchListings.push(element);
          }
        });
      }
    }
    let exactTypeMatchListings = [];
    if (rangeLimitedListings.length > 0) {
      const randomIndex = Math.floor(Math.random() * rangeLimitedListings.length);
      const theListing = Object.assign({}, rangeLimitedListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      if (opts.height !== theListing.height && opts.width !== theListing.width) {
        theListing.height = (theListing.height * opts.width) / theListing.width;
        theListing.width = opts.width;
      }
      return theListing;
    }
    let bestMatchRatio = 0;
    targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
    typeMatchListings.forEach((listing) => {
      if (Math.abs(listing.ratio - targetRatio) < Math.abs(bestMatchRatio - targetRatio)) {
        exactTypeMatchListings = []; // remove previous matches
        exactTypeMatchListings.push(listing);
        bestMatchRatio = listing.ratio;
      } else if (listing.ratio === bestMatchRatio) {
        exactTypeMatchListings.push(listing);
      }
    });
    if (exactTypeMatchListings.length > 0) {
      const randomIndex = Math.floor(Math.random() * exactTypeMatchListings.length);
      const theListing = Object.assign({}, exactTypeMatchListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      return theListing;
    }

    return undefined;
  },

  loadFromStorage() {
    this.channelGuide = {};

    const entries = storageGet('channels');
    if (!entries || (entries.length > 0 && !entries[0].name)) {
      this.add({
        name: 'DogsChannel',
        param: undefined,
        enabled: false,
      });
      this.add({
        name: 'CatsChannel',
        param: undefined,
        enabled: false,
      });
      this.add({
        name: 'LandscapesChannel',
        param: undefined,
        enabled: false,
      });
    } else {
      for (let i = 0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
  },

  saveToStorage() {
    const toStore = [];
    const guide = this.getGuide();
    for (const id in guide) {
      toStore.push(guide[id]);
    }
    storageSet('channels', toStore);
  },
};


// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
function Channel() {
  this.listings = [];
}
Channel.prototype = {
  getListings() {
    return this.listings.slice(0); // shallow copy
  },

  // Update the channel's listings and trigger an 'updated' event.
  refresh() {
    const that = this;
    this.getLatestListings((listings) => {
      that.listings = listings;
      minjQuery(that).trigger('updated');
    });
  },

  // Load all photos so that they're in the cache.
  prefetch() {
    // current - noop, since all of the URLs are hard coded.
  },

  getLatestListings() {
    throw new Error('Implemented by subclass. Call callback with up-to-date listings.');
  },

  calculateType(w, h) {
    let width = w;
    let height = h;

    if (typeof width === 'string') {
      width = parseInt(width, 10);
    }
    if (typeof height === 'string') {
      height = parseInt(height, 10);
    }
    let type = '';
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio >= 1.5 && ratio < 7) {
      type = (width > height ? imageSizesMap.get('wide') : imageSizesMap.get('tall'));
    } else if (ratio > 7) {
      type = (width > height ? imageSizesMap.get('skinnywide') : imageSizesMap.get('skinnytall'));
    } else {
      type = ((width > 125 || height > 125) ? imageSizesMap.get('big') : imageSizesMap.get('small'));
    }
    return type;
  },
};

Object.assign(window, {
  Channel,
  Channels,
  Listing,
  channelsNotifier,
});
