
/* For ESLint: List any global identifiers used in this file below */
/* global browser, isTrustedSender, isTrustedSenderDomain */

import * as ewe from '../vendor/webext-sdk/dist/ewe-api';
import abRecommendationData from './data/betafish-subscriptions.json';

// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
const SubscriptionAdapter = (function getSubscriptionAdapter() {
  const addAdBlockProperties = function (sub) {
    const subscription = sub;
    if (abRecommendationData && subscription && abRecommendationData[subscription.url]) {
      subscription.id = abRecommendationData[subscription.url].id;
      subscription.index = abRecommendationData[subscription.url].index;
      subscription.hidden = abRecommendationData[subscription.url].hidden;
      subscription.type = abRecommendationData[subscription.url].type;
      Object.defineProperty(subscription, 'language', {
        get() {
          return (subscription.languages && subscription.languages.length > 0)
                  || abRecommendationData[subscription.url].language
                  || false;
        },
      });
    }
    return subscription;
  };

  // Get the URL for the corresponding ID
  const getUrlFromId = function (searchID) {
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { id } = subscription;
      if (searchID === id) {
        return url;
      }
    }
    return '';
  };

  // Get the ID for the corresponding URL
  const getIdFromURL = function (searchURL) {
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { id } = subscription;
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

    for (let subscription of ewe.subscriptions.getRecommendations()) {
      subscription = addAdBlockProperties(subscription);
      const { id } = subscription;
      if (id === searchID) {
        return subscription.language;
      }
    }
    return false;
  };

  // Get the ID for the corresponding URL
  const getSubscriptionInfoFromURL = function (searchURL) {
    for (let subscription of ewe.subscriptions.getRecommendations()) {
      subscription = addAdBlockProperties(subscription);
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
      ewe.subscriptions.remove(subscriptionUrl);
    }
  };

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  const getSubscriptionsMinusText = function () {
    const result = {};
    for (let subscription of ewe.subscriptions.getDownloadable()) {
      subscription = addAdBlockProperties(subscription);
      const tempSub = {};
      for (const attr in subscription) {
        tempSub[attr] = subscription[attr];
      }
      // if the subscription doesn't have a 'id' property, use the 'URL' as an
      // 'id' property
      if (!tempSub.id || tempSub.id === undefined) {
        tempSub.id = `url:${subscription.url}`;
      }
      // add the 'subscribed' property
      tempSub.subscribed = true;
      result[tempSub.id] = tempSub;
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
    for (let subscription of ewe.subscriptions.getDownloadable()) {
      subscription = addAdBlockProperties(subscription);
      let index = subscription.index || 0; // 0 is the 'unkown' index
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
    return resultB.toString(2).padStart(32, '0') + resultA.toString(2).padStart(32, '0');
  };

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  const getAllSubscriptionsMinusText = function () {
    const userSubs = getSubscriptionsMinusText();

    for (let subscription of ewe.subscriptions.getRecommendations()) {
      subscription = addAdBlockProperties(subscription);
      const {
        url, id, languages, language, type, title, homepage, hidden, index,
      } = subscription;
      if (!(id in userSubs)) {
        userSubs[id] = {};
        userSubs[id].subscribed = false;
        userSubs[id].url = url;
        userSubs[id].userSubmitted = false;
        userSubs[id].languages = languages;
        userSubs[id].type = type;
        userSubs[id].title = title;
      }
      userSubs[id].id = id;
      userSubs[id].homepage = homepage;
      userSubs[id].hidden = hidden;
      userSubs[id].language = language;
      userSubs[id].index = index;
    }
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { id } = subscription;
      if (subscription && !Object.prototype.hasOwnProperty.call(subscription, 'language')) {
        Object.defineProperty(subscription, 'language', {
          get() {
            return (subscription.languages && subscription.languages.length > 0) || false;
          },
        });
      }
      if (!(id in userSubs)) {
        userSubs[id] = {};
        userSubs[id].subscribed = false;
        userSubs[id].id = id;
        userSubs[id].url = url;
        userSubs[id].userSubmitted = false;
        userSubs[id].language = subscription.language;
        userSubs[id].languages = subscription.languages;
        userSubs[id].hidden = subscription.hidden;
        userSubs[id].type = subscription.type;
        userSubs[id].title = subscription.title;
        userSubs[id].homepage = subscription.homepage;
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
    if (message.command === 'unsubscribe' && message.id && isTrustedSenderDomain(sender)) {
      unsubscribe({ id: message.id });
      sendResponse({});
    }
  });

  // Subcribe the user to the subscription specified in the argument
  const subscribe = function (options) {
    if (options && options.id) {
      const subscriptionUrl = getUrlFromId(options.id);
      if (subscriptionUrl) {
        ewe.subscriptions.add(subscriptionUrl);
      }
    }
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'subscribe' && message.id && isTrustedSender(sender)) {
      subscribe({ id: message.id });
      sendResponse({});
    }
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

export default SubscriptionAdapter;
