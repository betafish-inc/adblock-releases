/** @module subscriptioninit */
/** similar to the ABP subscriptionInit module */
SubscriptionInit = (function()
{

"use strict";

  var Subscription = require("subscriptionClasses").Subscription;
  var DownloadableSubscription = require("subscriptionClasses").DownloadableSubscription;
  var SpecialSubscription = require("subscriptionClasses").SpecialSubscription;
  var FilterStorage = require("filterStorage").FilterStorage;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var Prefs = require("prefs").Prefs;
  var Synchronizer = require("synchronizer").Synchronizer;
  var Utils = require("utils").Utils;
  var initNotifications = require("notificationHelper").initNotifications;
  var firstRun;

/**
 *
 * This function detects the first run
 */
function detectFirstRun()
{
  firstRun = (FilterStorage.firstRun && !Prefs.suppress_first_run_page);
}

/**
 * Determines whether to add the default ad blocking subscription. Returns true,
 * if there are no filter subscriptions besides those other subscriptions added
 * automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there is no data
 * and therefore no subscriptions. But it also causes the default ad blocking
 * subscription to be added again after some data corruption or
 * misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscription()
{
  for (var inx = 0; inx < FilterStorage.subscriptions.length; ++inx)
  {
    var subscription = FilterStorage.subscriptions[inx];
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != Prefs.subscriptions_exceptionsurl &&
        subscription.url != Prefs.subscriptions_antiadblockurl)
    {
      return false;
    }

    if (subscription instanceof SpecialSubscription &&
        subscription.filters.length > 0)
    {
      return false;
    }
  }
  return true;
}

/**
 * Gets the filter subscriptions to be added when the extnesion is loaded.
 *
 * @return {Promise|Subscription[]}
 */
function getSubscriptions()
{
  var subscriptions = [];
  // Add "AdBlock Custom" subscription
  if (firstRun)
  {
    var acceptableAdsSubscription = Subscription.fromURL("https://cdn.adblockcdn.com/filters/adblock_custom.txt");
    subscriptions.push(acceptableAdsSubscription);
    var nominersSubscription = Subscription.fromURL("https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt");
    subscriptions.push(nominersSubscription);
  }

  // Add any AB specific default langugae subscriptions
  // and any subsequent required subscriptions
  if (shouldAddDefaultSubscription())
  {
    return fetch("adblock-subscriptions.xml").then(function(response)
      {
        return response.text();
      }).then(function(text)
      {
        var doc = new DOMParser().parseFromString(text, "application/xml");
        var nodes = doc.getElementsByTagName("subscription");

        var node = Utils.chooseFilterSubscription(nodes);
        if (node)
        {
          var url = node.getAttribute("url");
          var title = node.getAttribute("title");
          // EasyList shouldn't be added here, but in the ABP
          // Only language / region specific filter lists / subscriptions
          if (url && title !== "EasyList")
          {
            var subscription = Subscription.fromURL(url);
            subscription.disabled = false;
            subscription.title = title;
            subscription.homepage = node.getAttribute("homepage");
            subscriptions.push(subscription);
            var requiredSubTitle = node.getAttribute("requires");
            if (requiredSubTitle) {
              for (var i = 0; i < nodes.length; i++)
              {
                var requiredNode = nodes[i];
                if (requiredSubTitle === requiredNode.getAttribute("title") &&
                    requiredNode.getAttribute("url"))
                {
                  var requiredSubscription = Subscription.fromURL(requiredNode.getAttribute("url"));
                  requiredSubscription.disabled = false;
                  requiredSubscription.title = requiredNode.getAttribute("title");
                  requiredSubscription.homepage = requiredNode.getAttribute("homepage");
                  subscriptions.push(requiredSubscription);
                }
              }
            }
          }
        }

        return subscriptions;
      });
  }

  return subscriptions;
}

function finishInitialization(subscriptions)
{
  for (var inx = 0; inx < subscriptions.length; ++inx)
  {
    var subscription = subscriptions[inx];
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
    {
      Synchronizer.execute(subscription);
    }
  }
}

function init()
{
  Promise.all([FilterNotifier.once("load"), Prefs.untilLoaded]).then(detectFirstRun).then(getSubscriptions).then(finishInitialization);
}

var returnObj = {};
returnObj.init = init;
return returnObj;
})();