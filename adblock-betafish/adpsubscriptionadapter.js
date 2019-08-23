
const {filterStorage} = require("filterStorage");
with (require('subscriptionClasses'))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
let SubscriptionAdapter = exports.SubscriptionAdapter = (function()
{
  // Get the URL for the corresponding ID
  var getUrlFromId = function(searchID)
  {
    for (let subscription of recommendations())
    {
      let {url, id} = subscription;
      if (searchID === id)
      {
        return url;
      }
    }
    return '';
  };

  // Get the ID for the corresponding URL
  var getIdFromURL = function(searchURL)
  {
    for (let subscription of recommendations())
    {
      let {url, id} = subscription;
      if (searchURL === url)
      {
        return id;
      }
    }
    return null;
  };

  // determine if the specified filter list is language specific
  // returns the boolean language attribue (if found)
  //         false otherwise
  var isLanguageSpecific = function(searchID)
  {
    for (let subscription of recommendations())
    {
      let {id} = subscription;
      if (id === searchID)
      {
        return id.language;
      }
    }
    return false;
  };

  // Get the ID for the corresponding URL
  var getSubscriptionInfoFromURL = function(searchURL)
  {
    for (let subscription of recommendations())
    {
      let {url} = subscription;
      if (searchURL === url)
      {
        return subscription;
      }
    }
    return null;
  };

  // Unsubcribe the user from the subscription specified in the arguement
  var unsubscribe = function(options)
  {
    var subscriptionUrl = getUrlFromId(options.id);
    if (subscriptionUrl !== '')
    {
      var subscription = Subscription.fromURL(subscriptionUrl);
      if (subscription)
      {
        filterStorage.removeSubscription(subscription);
      }
    }
  }

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  var getSubscriptionsMinusText = function()
  {
    var result = {};
    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof DownloadableSubscription)
      {
        var tempSub = {};
        for (var attr in subscription)
        {
          // if the subscription has a 'URL' property, use it to add the other attributes (id, language, hidden)
          if (attr === "url")
          {
            let subscriptionInfo = getSubscriptionInfoFromURL(subscription[attr]);
            if (subscriptionInfo && subscriptionInfo.url)
            {
              tempSub.id = subscriptionInfo.id;
              tempSub.languages = subscriptionInfo.languages;
              tempSub.language = subscriptionInfo.language;
              tempSub.type = subscriptionInfo.type;
              tempSub.homepage = subscriptionInfo.homepage;
              tempSub.title = subscriptionInfo.title;
              tempSub.hidden = subscriptionInfo.hidden;
            }
          }
          if (attr === "_filterText")
          {
            continue;
          }
          tempSub[attr] = subscription[attr];
        }
        // if the subscription doesn't have a 'id' property, use the 'URL' as an
        // 'id' property
        if (!tempSub["id"] || tempSub["id"] === undefined)
        {
          tempSub["id"] = "url:" + subscription.url;
        }
        // Since FilterStorage.subscriptions only contains subscribed FilterLists,
        // add the 'subscribed' property
        tempSub['subscribed'] = true;
        result[tempSub["id"]] = tempSub;
      }
    }
    return result;
  }

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  var getAllSubscriptionsMinusText = function()
  {
    var userSubs = getSubscriptionsMinusText();
    for (let subscription of recommendations())
    {
      let {url, id, languages, language, type, title, homepage, hidden} = subscription;
      if (!(id in userSubs))
      {
        userSubs[id] = {};
        userSubs[id]['subscribed'] = false;
        userSubs[id]['id'] = id;
        userSubs[id]['url'] = url;
        userSubs[id]['user_submitted'] = false;
        userSubs[id]['language'] = language;
        userSubs[id]['languages'] = languages;
        userSubs[id]['hidden'] = hidden;
        userSubs[id]['type'] = type;
        userSubs[id]['title'] = title;
        userSubs[id]['homepage'] = homepage;
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
    isLanguageSpecific
  };

})();