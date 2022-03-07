'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global require, exports, recommendations, Subscription
   DownloadableSubscription, browser, synchronizer */

const { filterStorage } = require('filterStorage');
const subClasses = require('subscriptionClasses');

if (subClasses) {
  this.Subscription = subClasses.Subscription;
  this.SpecialSubscription = subClasses.SpecialSubscription;
  this.DownloadableSubscription = subClasses.DownloadableSubscription;
}

// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
const SubscriptionAdapter = (function getSubscriptionAdapter() {
  // Get the URL for the corresponding ID
  const getUrlFromId = function (searchID) {
    for (const subscription of recommendations()) {
      const { url, id } = subscription;
      if (searchID === id) {
        return url;
      }
    }
    return '';
  };

  // Get the ID for the corresponding URL
  const getIdFromURL = function (searchURL) {
    for (const subscription of recommendations()) {
      const { url, id } = subscription;
      if (searchURL === url) {
        return id;
      }
    }
    return null;
  };

  // determine if the specified filter list is language specific
  // returns the boolean language attribue (if found)
  //         false otherwise
  const isLanguageSpecific = function (searchID) {
    // check for EasyList, as it is a language-specific list (en), but
    // shouldn't be treated as such by the AdBlock code
    if (searchID === 'easylist') {
      return false;
    }

    for (const subscription of recommendations()) {
      const { id } = subscription;
      if (id === searchID) {
        return subscription.language;
      }
    }
    return false;
  };

  // Get the ID for the corresponding URL
  const getSubscriptionInfoFromURL = function (searchURL) {
    for (const subscription of recommendations()) {
      const { url } = subscription;
      if (searchURL === url) {
        return subscription;
      }
    }
    return null;
  };

  // Unsubcribe the user from the subscription specified in the argument
  const unsubscribe = function (options) {
    const subscriptionUrl = getUrlFromId(options.id);
    if (subscriptionUrl !== '') {
      const subscription = Subscription.fromURL(subscriptionUrl);
      if (subscription) {
        filterStorage.removeSubscription(subscription);
      }
    }
  };

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  const getSubscriptionsMinusText = function () {
    const result = {};
    for (const subscription of filterStorage.subscriptions()) {
      if (subscription instanceof DownloadableSubscription) {
        const tempSub = {};
        for (const attr in subscription) {
          // if the subscription has a 'URL' property use it to
          // add the other attributes (id, language, hidden)
          if ((attr === 'url' || attr === '_url') && !tempSub.id) {
            const subscriptionInfo = getSubscriptionInfoFromURL(subscription[attr]);
            if (subscriptionInfo && subscriptionInfo.url) {
              tempSub.id = subscriptionInfo.id;
              tempSub.languages = subscriptionInfo.languages;
              tempSub.language = subscriptionInfo.language;
              tempSub.type = subscriptionInfo.type;
              tempSub.homepage = subscriptionInfo.homepage;
              tempSub.title = subscriptionInfo.title;
              tempSub.hidden = subscriptionInfo.hidden;
              tempSub.index = subscriptionInfo.index;
            }
          }
          if (attr !== '_filterText' && attr !== '_filterTextIndex') {
            tempSub[attr] = subscription[attr];
          }
        }
        // if the subscription doesn't have a 'id' property, use the 'URL' as an
        // 'id' property
        if (!tempSub.id || tempSub.id === undefined) {
          tempSub.id = `url:${subscription.url}`;
        }
        // if the subscription doesn't have a 'url' property, copy the '_url' property
        if (!tempSub.url && tempSub._url) {
          tempSub.url = tempSub._url;
        }
        if (!tempSub.downloadStatus && subscription._downloadStatus) {
          tempSub.downloadStatus = subscription._downloadStatus;
        }
        // Since FilterStorage.subscriptions only contains subscribed FilterLists,
        // add the 'subscribed' property
        tempSub.subscribed = true;
        result[tempSub.id] = tempSub;
      }
    }
    return result;
  };

  const rareFilterLists = {
    'http://fanboy.co.nz/fanboy-turkish.txt': 56,
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&mimetype=plaintext': 57,
    'https://adblock.gardar.net/is.abp.txt': 58,
    'https://github.com/SlashArash/adblockfa': 59,
    'https://adblock.ee/list.php': 60,
  };

  // Get a binary string representation of the users subscriptions
  const getSubscriptionsChecksum = function () {
    let resultA = 0;
    let resultB = 0;
    for (const subscription of filterStorage.subscriptions()) {
      if (subscription instanceof DownloadableSubscription) {
        const subscriptionInfo = getSubscriptionInfoFromURL(subscription.url);
        let index = (subscriptionInfo && subscriptionInfo.index) || 0; // 0 is the 'unkown' index
        // if URL wasn't found in our subscription file, check the rareFilterLists to get the index
        if (index === 0 && rareFilterLists[subscription.url]) {
          index = rareFilterLists[subscription.url];
        }
        index = parseInt(index, 10);
        if (index < 32) {
          resultA |= (2 ** index); // eslint-disable-line no-bitwise
        } else {
          resultB |= (2 ** (index - 32)); // eslint-disable-line no-bitwise
        }
      }
    }
    return resultB.toString(2).padStart(32, '0') + resultA.toString(2).padStart(32, '0');
  };

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  const getAllSubscriptionsMinusText = function () {
    const userSubs = getSubscriptionsMinusText();
    for (const subscription of recommendations()) {
      const {
        url, id, languages, language, type, title, homepage, hidden, index,
      } = subscription;
      if (!(id in userSubs)) {
        userSubs[id] = {};
        userSubs[id].subscribed = false;
        userSubs[id].id = id;
        userSubs[id].url = url;
        userSubs[id].userSubmitted = false;
        userSubs[id].language = language;
        userSubs[id].languages = languages;
        userSubs[id].hidden = hidden;
        userSubs[id].type = type;
        userSubs[id].title = title;
        userSubs[id].homepage = homepage;
        userSubs[id].index = index;
      }
    }
    return userSubs;
  };
  // Get all distraction control subscriptions
  // without the filter contents (text)
  const getDCSubscriptionsMinusText = function () {
    const userSubs = getAllSubscriptionsMinusText();
    const result = {};
    for (const id in userSubs) {
      const {
        url, type, title, homepage, hidden, subscribed, index,
      } = userSubs[id];
      if (type === 'distraction-control') {
        result[id] = {};
        result[id].subscribed = subscribed;
        result[id].id = id;
        result[id].url = url;
        result[id].userSubmitted = false;
        result[id].hidden = hidden;
        result[id].type = type;
        result[id].title = title;
        result[id].homepage = homepage;
        result[id].index = index;
      }
    }
    return result;
  };


  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command !== 'unsubscribe' || !message.id) {
      return;
    }
    unsubscribe({ id: message.id });
    sendResponse({});
  });

  // Subcribe the user to the subscription specified in the argument
  const subscribe = function (options) {
    if (options && options.id) {
      const subscriptionUrl = getUrlFromId(options.id);
      if (subscriptionUrl !== '') {
        const subscription = Subscription.fromURL(subscriptionUrl);
        if (subscription) {
          filterStorage.addSubscription(subscription);
          synchronizer.execute(subscription);
        }
      }
    }
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command !== 'subscribe' || !message.id) {
      return;
    }
    subscribe({ id: message.id });
    sendResponse({});
  });


  return {
    getSubscriptionInfoFromURL,
    getUrlFromId,
    unsubscribe,
    getSubscriptionsMinusText,
    getSubscriptionsChecksum,
    getAllSubscriptionsMinusText,
    getDCSubscriptionsMinusText,
    getIdFromURL,
    isLanguageSpecific,
  };
}());

exports.SubscriptionAdapter = SubscriptionAdapter;
