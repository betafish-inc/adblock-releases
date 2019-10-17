'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global require, exports, recommendations, Subscription
   DownloadableSubscription */

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

  // Unsubcribe the user from the subscription specified in the arguement
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
          if (attr === 'url') {
            const subscriptionInfo = getSubscriptionInfoFromURL(subscription[attr]);
            if (subscriptionInfo && subscriptionInfo.url) {
              tempSub.id = subscriptionInfo.id;
              tempSub.languages = subscriptionInfo.languages;
              tempSub.language = subscriptionInfo.language;
              tempSub.type = subscriptionInfo.type;
              tempSub.homepage = subscriptionInfo.homepage;
              tempSub.title = subscriptionInfo.title;
              tempSub.hidden = subscriptionInfo.hidden;
            }
          }
          if (attr !== '_filterText') {
            tempSub[attr] = subscription[attr];
          }
        }
        // if the subscription doesn't have a 'id' property, use the 'URL' as an
        // 'id' property
        if (!tempSub.id || tempSub.id === undefined) {
          tempSub.id = `url:${subscription.url}`;
        }
        // Since FilterStorage.subscriptions only contains subscribed FilterLists,
        // add the 'subscribed' property
        tempSub.subscribed = true;
        result[tempSub.id] = tempSub;
      }
    }
    return result;
  };

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  const getAllSubscriptionsMinusText = function () {
    const userSubs = getSubscriptionsMinusText();
    for (const subscription of recommendations()) {
      const {
        url, id, languages, language, type, title, homepage, hidden,
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
      }
    }
    return userSubs;
  };


  return {
    getSubscriptionInfoFromURL,
    getUrlFromId,
    unsubscribe,
    getSubscriptionsMinusText,
    getAllSubscriptionsMinusText,
    getIdFromURL,
    isLanguageSpecific,
  };
}());

exports.SubscriptionAdapter = SubscriptionAdapter;
