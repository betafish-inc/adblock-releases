

/* For ESLint: List any global identifiers used in this file below */
/* global settings, getSettings, setSetting, storageGet, storageSet, browser, ext */

import { contentTypes } from 'adblockpluscore/lib/contentTypes';
import * as ewe from '../../vendor/webext-sdk/dist/ewe-api';
import { EventEmitter } from '../../vendor/adblockplusui/adblockpluschrome/lib/events';
import {
  WIDE, TALL, SKINNYWIDE, SKINNYTALL,
} from './image-sizes-map';
import SubscriptionAdapter from '../subscriptionadapter';
import CustomChannel from './custom-channel';
import CatsChannel from './cat-channel';
import DogsChannel from './dog-channel';
import LandscapesChannel from './landscape-channel';
import BirdChannel from './birds-channel';
import FoodChannel from './food-channel';
import GoatsChannel from './goat-channel';
import OceanChannel from './ocean-channel';
import UnknownChannel from './unknown-channel';


const resourceTypes = new Map();
for (const type in contentTypes) {
  resourceTypes.set(type.toLowerCase(), contentTypes[type]);
}
resourceTypes.set('sub_frame', contentTypes.SUBDOCUMENT);
resourceTypes.set('beacon', contentTypes.PING);
resourceTypes.set('imageset', contentTypes.IMAGE);
resourceTypes.set('object_subrequest', contentTypes.OBJECT);
resourceTypes.set('main_frame', contentTypes.DOCUMENT);

const typeSelectors = new Map([
  [contentTypes.IMAGE, 'img,input'],
  [contentTypes.MEDIA, 'audio,video'],
  [contentTypes.SUBDOCUMENT, 'frame,iframe,object,embed'],
  [contentTypes.OBJECT, 'object,embed'],
]);

const REPORTING_OPTIONS = {
  filterType: 'blocking',
  includeElementHiding: false,
};


// const {
//  getUrlFromId,
//  getSubscriptionsMinusText,
// } = SubscriptionAdapter;
const subscription1 = SubscriptionAdapter.getUrlFromId('antisocial');
const subscription2 = SubscriptionAdapter.getUrlFromId('annoyances');

const channelObjects = {
  CustomChannel,
  CatsChannel,
  DogsChannel,
  LandscapesChannel,
  BirdChannel,
  FoodChannel,
  GoatsChannel,
  OceanChannel,
  UnknownChannel,
};

export const channelsNotifier = new EventEmitter();

// Contains and provides access to all the photo channels.
export class Channels {
  constructor(license) {
    this.license = license;
    this.channelGuide = undefined; // maps channel ids to channels and metadata
    this.loadFromStorage();
    this.initializeListeners();
  }

  // Inputs:
  //   name:string - a Channel class name.
  //   param:object - the single ctor parameter to the Channel class.
  //   enabled:bool - true if this channel is to be used for pictures.
  // Returns:
  //   id of newly created channel, or undefined if the channel already existed.
  add(data) {
    let Klass = channelObjects[data.name];
    if (!Klass) {
      Klass = channelObjects.UnknownChannel;
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
    channel.refresh();
    return id;
  }

  remove(channelId) {
    delete this.channelGuide[channelId];
    this.saveToStorage();
  }

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
  }

  // Return id for channel name
  getIdByName(name) {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].name === name) {
        return id;
      }
    }
    return undefined;
  }

  isCustomChannel(id) {
    return (this.getIdByName('CustomChannel') === id);
  }

  isCustomChannelEnabled() {
    return (this.channelGuide[this.getIdByName('CustomChannel')].enabled);
  }

  getListings(id) {
    return this.channelGuide[id].channel.getListings();
  }

  setEnabled(id, enabled) {
    const originalValue = this.channelGuide[id].enabled;
    this.channelGuide[id].enabled = enabled;
    this.saveToStorage();
    if (originalValue !== enabled) {
      channelsNotifier.emit('channels.changed', id, enabled, originalValue);
    }
  }

  refreshAllEnabled() {
    for (const id in this.channelGuide) {
      const data = this.channelGuide[id];
      if (data.enabled) {
        data.channel.refresh();
      }
    }
  }

  isAnyEnabled() {
    for (const id in this.channelGuide) {
      const channel = this.channelGuide[id];
      if (channel.enabled) {
        return true;
      }
    }
    return false;
  }

  disableAllChannels() {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].enabled) {
        this.channelGuide[id].enabled = false;
        channelsNotifier.emit('channels.changed', id, false, true);
      }
    }
  }

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
      for (const sub of SubscriptionAdapter.getSubscriptionsMinusText()) {
        if (sub.url === subscription1 || sub.url === subscription2) {
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
  }

  // adds any new or missing channels (in a disabled state) to the users channel guide
  addNewChannels() {
    const channelNames = ['DogsChannel', 'CatsChannel', 'LandscapesChannel', 'OceanChannel', 'GoatsChannel', 'BirdChannel', 'FoodChannel', 'CustomChannel'];
    for (const name of channelNames) {
      if (!this.getIdByName(name)) {
        this.add({
          name,
          param: undefined,
          enabled: false,
        });
      }
    }
  }

  loadFromStorage() {
    this.channelGuide = {};
    const entries = storageGet('channels');
    if (entries) {
      for (let i = 0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
    this.addNewChannels();
  }

  saveToStorage() {
    const toStore = [];
    const guide = this.getGuide();
    for (const id in guide) {
      toStore.push(guide[id]);
    }
    storageSet('channels', toStore);
  }

  static getContentType(details) {
    return resourceTypes.get(details.type) || contentTypes.OTHER;
  }

  static getFrameId(details) {
    return details.type === 'sub_frame' ? details.parentFrameId
      : details.frameId;
  }

  // Ignore EasyPrivacy rules, since they can cause issue with odd image swaps
  static shouldUseFilter(filter) {
    if (!filter) {
      return false;
    }

    for (const subscription of ewe.subscriptions.getForFilter(filter.text)) {
      if (subscription.downloadable && subscription.title === 'EasyPrivacy') {
        return false;
      }
    }
    return true;
  }

  filterListener({ request, filter }) {
    if (getSettings().picreplacement && this.license.isActiveLicense()) {
      if (!Channels.shouldUseFilter(filter)) {
        return;
      }
      if (request
          && request.tabId
          && filter
          && filter.type === 'elemhide'
          && filter.selector && filter.enabled) {
        const msgDetail = { hidingSelector: filter.selector, command: 'addSelector' };
        browser.tabs.sendMessage(request.tabId, msgDetail, { frameId: request.frameId });
      } else if (request
        && request.tabId
        && filter
        && filter.type === 'blocking'
        && filter.enabled) {
        const selector = typeSelectors.get(Channels.getContentType(request));
        const frameId = Channels.getFrameId(request);
        const msg = { selector, command: 'addBlockingSelector', url: request.url };
        browser.tabs.sendMessage(request.tabId, msg, { frameId });
      }
    } else if (!getSettings().picreplacement) {
      ewe.reporting.onBlockableItem.removeListener(this.filterListener, REPORTING_OPTIONS);
    }
  }

  initializeListeners() {
    this.license.ready().then(() => {
      settings.onload().then(() => {
        if (getSettings().picreplacement && this.license.isActiveLicense()) {
          ewe.reporting.onBlockableItem.removeListener(this.filterListener, REPORTING_OPTIONS);
          ewe.reporting.onBlockableItem.addListener(
            this.filterListener.bind(this), REPORTING_OPTIONS,
          );
        }
      });
    });

    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.message !== 'get_random_listing') {
        return;
      }
      const myPage = ext.getPage(sender.tab.id);
      if (!!ewe.filters.getAllowingFilters(myPage.id).length || !this.license.isActiveLicense()) {
        sendResponse({ disabledOnPage: true });
      }
      const result = this.randomListing(request.opts);
      if (result) {
        sendResponse(result);
      }
      sendResponse({ disabledOnPage: true });
    });
  }
}
