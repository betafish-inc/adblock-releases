'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing, browser */

// Channel containing user imported images
// Subclass of Channel.

function CustomChannel() {
  Channel.call(this); // check if licensed in an init() function
  const that = this;

  // load the meta data Array from storage
  browser.storage.local.get(this.CUSTOM_META_KEY).then((customImageMetaData) => {
    const savedCustomImageMetaData = customImageMetaData;
    if (!savedCustomImageMetaData[this.CUSTOM_META_KEY]) {
      savedCustomImageMetaData[this.CUSTOM_META_KEY] = [];
    }
    const customMetaData = savedCustomImageMetaData[this.CUSTOM_META_KEY];
    for (let inx = 0; inx < customMetaData.length; inx++) {
      const listingData = customMetaData[inx];
      if (
        listingData
          && listingData.url
          && listingData.width
          && listingData.height
          && listingData.title
      ) {
        const theNewListing = that.createListing(listingData.width,
          listingData.height, listingData.url, listingData.title);
        that.listings.push(theNewListing);
      }
    }
  });
}
CustomChannel.prototype = {
  __proto__: Channel.prototype,
  createListing: function L(theWidth, theHeight, theURL, theName) {
    let width = theWidth;
    let height = theHeight;
    const url = theURL;
    const type = this.calculateType(width, height);

    if (typeof width === 'number') {
      width = `${width}`;
    }
    if (typeof height === 'number') {
      height = `${height}`;
    }
    return new Listing({
      width,
      height,
      url,
      attributionUrl: url,
      type,
      ratio: Math.max(width, height) / Math.min(width, height),
      title: `This is an image from your PC! : ${theName}`,
      channelName: 'custom_channel_name', // message.json key for channel name
      customImage: true,
    });
  },
  listings: [],
  CUSTOM_META_KEY: 'customMetaData',
  // to run - channels.channelGuide[channels.getIdByName("CustomChannel")].channel.deleteAll()
  deleteAll() {
    const customImagesArray = this.listings;
    for (let inx = 0; inx < customImagesArray.length; inx++) {
      if (customImagesArray[inx] && customImagesArray[inx].url) {
        browser.storage.local.remove(customImagesArray[inx].url);
      }
    }
    browser.storage.local.remove(this.CUSTOM_META_KEY).then(() => {
      this.listings = [];
    });
  },
  getLatestListings(callback) {
    callback(this.listings);
  },
  isMaximumAllowedImages() {
    return (this.listings.length >= 9);
  },
  saveListings() {
    const that = this;
    return new Promise((resolve, reject) => {
      const persistedMetaImageObj = {};
      persistedMetaImageObj[that.CUSTOM_META_KEY] = that.listings;
      browser.storage.local.set(persistedMetaImageObj).then(() => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        }
        resolve(true);
      });
    });
  },
  removeListingByURL(theURLToRemove) {
    for (let inx = 0; inx < this.listings.length; inx++) {
      const theListing = this.listings[inx];
      if (theListing && theListing.url === theURLToRemove) {
        this.listings.splice(inx, 1);
      }
    }
    const that = this;
    return new Promise((resolve, reject) => {
      that.saveListings().then((response) => {
        if (response) {
          browser.storage.local.remove(theURLToRemove).then(() => {
            if (browser.runtime.lastError) {
              reject(browser.runtime.lastError);
            }
            resolve(true);
          });
        } else {
          resolve(response);
        }
      });
    });
  },
  addCustomImage(imageInfo) {
    const that = this;
    return new Promise((resolve, reject) => {
      const randomKey = `file:///${new Date().getTime()}`;
      const persistedImageObj = {};
      persistedImageObj[randomKey] = {
        name: imageInfo.name,
        width: imageInfo.width,
        height: imageInfo.height,
        src: imageInfo.imageAsBase64,
      };
      browser.storage.local.set(persistedImageObj).then(() => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        }
        const theNewListing = this.createListing(imageInfo.width,
          imageInfo.height, randomKey, imageInfo.name);
        that.listings.push(theNewListing);
        that.saveListings()
          .then((response) => {
            if (response) {
              resolve(randomKey);
            } else {
              reject(response);
            }
          })
          .catch((response) => {
            reject(response);
          });
      });
    });
  },
  getBytesInUseForEachImage() {
    if (typeof browser.storage.local.getBytesInUse !== 'function') {
      return new Promise((resolve) => {
        resolve([0]);
      });
    }
    const customImagesArray = this.getListings();
    const promises = [];
    for (let inx = 0; inx < customImagesArray.length; inx++) {
      const thePromise = new Promise((resolve) => {
        if (customImagesArray[inx] && customImagesArray[inx].url) {
          browser.storage.local.getBytesInUse(customImagesArray[inx].url, (biu) => {
            resolve(biu);
          });
        }
      });
      promises.push(thePromise);
    }
    return Promise.all(promises);
  },
  getTotalBytesInUse() {
    if (typeof browser.storage.local.getBytesInUse !== 'function') {
      return new Promise((resolve) => {
        resolve(0);
      });
    }
    return new Promise((resolve) => {
      this.getBytesInUseForEachImage().then((results) => {
        let sum = 0;
        let numResults = results.length;
        while (numResults > 0) {
          numResults -= 1;
          sum += results[numResults];
        }
        resolve(sum);
      });
    });
  },
};

Object.assign(window, {
  CustomChannel,
});
