
// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties

// Get the URL for the corresponding ID
var getUrlFromId = function(id)
{
  var url = '';

  for (var u in abpSubscriptionIdMap)
  {
    if (abpSubscriptionIdMap[u].id === id)
    {
      url = u;
      break;
    }
  }

  if (url === '')
  {
    for (var u in abSubscriptionIdMap)
    {
      if (abSubscriptionIdMap[u].id === id)
      {
        url = u;
        break;
      }
    }
  }

  return url;
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
      FilterStorage.removeSubscription(subscription);
    }
  }
}

// Get only the user's subscriptions with in the AB format
// without the filter contents (text)
var getSubscriptionsMinusText = function()
{
  var result = {};
  for (var sub in FilterStorage.subscriptions)
  {
    var subscription = FilterStorage.subscriptions[sub];
    if (subscription instanceof DownloadableSubscription)
    {
      var tempSub = {};
      for ( var attr in subscription)
      {
        if ((attr === "text") || (attr === "filters"))
        {
          continue;
        }
        tempSub[attr] = subscription[attr];
        // if the subscription has a 'URL' property, use it to add an 'id'
        // property
        if (attr === "url")
        {
          if (tempSub[attr] in abpSubscriptionIdMap)
          {
            tempSub["id"] = abpSubscriptionIdMap[tempSub[attr]].id;
          }
          else if (tempSub[attr] in abSubscriptionIdMap)
          {
            tempSub["id"] = abSubscriptionIdMap[tempSub[attr]].id;
          }
        }
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
      // Add the language and hidden properties
      if (tempSub.url in abpSubscriptionIdMap)
      {
        tempSub.language = abpSubscriptionIdMap[tempSub.url].language;
        tempSub.hidden = abpSubscriptionIdMap[tempSub.url].hidden;
      }
      else if (tempSub.url in abSubscriptionIdMap)
      {
        tempSub.language = abSubscriptionIdMap[tempSub.url].language;
        tempSub.hidden = abSubscriptionIdMap[tempSub.url].hidden;
      }
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
  for (var url in abSubscriptionIdMap)
  {
    var id = abSubscriptionIdMap[url].id;
    if (!(id in userSubs))
    {
      userSubs[id] = {};
      userSubs[id]['subscribed'] = false;
      userSubs[id]['id'] = id;
      userSubs[id]['url'] = url;
      userSubs[id]['user_submitted'] = false;
      userSubs[id]['language'] = abSubscriptionIdMap[url]['language'];
      userSubs[id]['hidden'] = abSubscriptionIdMap[url]['hidden'];
    }
  }
  for (var url in abpSubscriptionIdMap)
  {
    var id = abpSubscriptionIdMap[url].id;
    if (!(id in userSubs))
    {
      userSubs[id] = {};
      userSubs[id]['subscribed'] = false;
      userSubs[id]['id'] = id;
      userSubs[id]['url'] = url;
      userSubs[id]['user_submitted'] = false;
      userSubs[id]['language'] = abpSubscriptionIdMap[url]['language'];
      userSubs[id]['hidden'] = abpSubscriptionIdMap[url]['hidden'];
    }
  }
  return userSubs;
};

var getIdFromURL = function(url)
{
  if (abpSubscriptionIdMap[url] && abpSubscriptionIdMap[url].id)
  {
    return abpSubscriptionIdMap[url].id;
  }
  else if (abSubscriptionIdMap[url] && abSubscriptionIdMap[url].id)
  {
    return abSubscriptionIdMap[url].id;
  }
  return null;
};

// A collection of unique ABP specific FilterList
// Only includes Filter Lists that are not in the AB collection
// Properties:  id       -unique identifier for the filter list
//              language -bool that indicates whether or not the filter list
//                        is language-specific (and should be included in the
//                        language drop-down)
//              hidden   -bool that indicates whether or not the filter list
//                        should be hidden from the default options on the
//                        Filter List tab (currently only used to hide language
//                        filter lists from the language drop-down)
var abpSubscriptionIdMap =
{
  "https://easylist-downloads.adblockplus.org/abpindo+easylist.txt" :
  {
    id : "easylist_plus_indonesian", // Additional Indonesian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt" :
  {
    id : "easylist_plus_bulgarian", // Additional Bulgarian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt" :
  {
    id : "chinese", // Additional Chinese filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistczechslovak+easylist.txt" :
  {
    id : "czech", // Additional Czech and Slovak filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistdutch+easylist.txt" :
  {
    id : "dutch", // Additional Dutch filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt" :
  {
    id : "easylist_plus_german", // Additional German filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistitaly+easylist.txt" :
  {
    id : "italian", // Italian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistlithuania+easylist.txt" :
  {
    id : "easylist_plus_lithuania", // Lithuania filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/latvianlist+easylist.txt" :
  {
    id : "latvian", // Latvian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/liste_ar+liste_fr+easylist.txt" :
  {
    id : "easylist_plus_arabic_plus_french", // Additional Arabic & French
                                              // filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt" :
  {
    id : "easylist_plus_french", // Additional French filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/rolist+easylist.txt" :
  {
    id : "easylist_plus_romanian", // Additional Romanian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt" :
  {
    id : "russian", // Additional Russian filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easyprivacy+easylist.txt" :
  {
    id : "easyprivacy", // EasyPrivacy
    language : false,
    hidden : false,
  },

  "http://adblock.dk/block.csv" :
  {
    id : "danish", // danish
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylistspanish.txt" :
  {
    id : "easylist_plus_spanish", // Spanish
    language : true,
    hidden : false,
  },

  "https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/polish-adblock-filters/adblock.txt" :
  {
    id : "easylist_plus_polish", // Polish
    language : true,
    hidden : false,
  },
};

// Properties:  id       -unique identifier for the filter list
//              language -bool that indicates whether or not the filter list
//                        is language-specific (and should be included in the
//                        language drop-down)
//              hidden   -bool that indicates whether or not the filter list
//                        should be hidden from the default options on the
//                        Filter List tab (currently only used to hide
//                        discontinued language filter lists from the language
//                        drop-down)
var abSubscriptionIdMap =
{
  "https://cdn.adblockcdn.com/filters/adblock_custom.txt" :
  {
    id : "adblock_custom", // AdBlock custom filters
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/easylist.txt" :
  {
    id : "easylist", // EasyList
    language : false,
    hidden : false,
  },

  "http://stanev.org/abp/adblock_bg.txt" :
  {
    id : "easylist_plus_bulgarian_old", // Additional Bulgarian filters
    language : true, // discontinued language list
    hidden : true,
  },

  "https://easylist-downloads.adblockplus.org/easylistdutch.txt" :
  {
    id : "dutch_old", // Additional Dutch filters
    language : true, // discontinued language list
    hidden : true,
  },

  "http://adb.juvander.net/Finland_adb.txt" :
  {
    id : "easylist_plus_finnish",
    language : true,
    hidden : false,
  },

  "https://easylist-downloads.adblockplus.org/liste_fr.txt" :
  {
    id : "easylist_plus_french_old", // Additional French filters
    language : true, // discontinued language list
    hidden : true,
  },

  "https://easylist-downloads.adblockplus.org/easylistgermany.txt" :
  {
    id : "easylist_plus_german_old", // Additional German filters
    language : true, // discontinued language list
    hidden : true,
  },

  "https://www.void.gr/kargig/void-gr-filters.txt" :
  {
    id : "easylist_plus_greek", // Additional Greek filters
    language : true,
    hidden : false,
  },

  "https://raw.githubusercontent.com/heradhis/indonesianadblockrules/master/subscriptions/abpindo.txt" :
  {
    id : "easylist_plus_indonesian_old", // Additional Indonesian filters
    language : true, // discontinued language list
    hidden : true,
  },

  "https://www.certyficate.it/adblock/adblock.txt" :
  {
    id : "easylist_plus_polish_old", // Additional Polish filters
    language : true, // discontinued language list
    hidden : true,
  },

  "http://www.zoso.ro/pages/rolist.txt" :
  {
    id : "easylist_plus_romanian_old", // Additional Romanian filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://easylist-downloads.adblockplus.org/advblock.txt" :
  {
    id : "russian_old", // Additional Russian filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://easylist-downloads.adblockplus.org/easylistchina.txt" :
  {
    id : "chinese_old", // Additional Chinese filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt" :
  {
    id : "czech_old", // Additional Czech and Slovak filters
    language : true, // discontinued language list
    hidden : true,
  },
  "http://adblock.schack.dk/block.txt" :
  {
    id : "danish_old", // Danish filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://raw.githubusercontent.com/szpeter80/hufilter/master/hufilter.txt" :
  {
    id : "hungarian", // Hungarian filters
    language : true,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/israellist+easylist.txt" :
  {
    id : "israeli", // Israeli filters
    language : true,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/easylistitaly.txt" :
  {
    id : "italian_old", // Italian filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt" :
  {
    id : "japanese", // Japanese filters
    language : true,
    hidden : false,
  },
  "https://secure.fanboy.co.nz/fanboy-korean.txt" :
  {
    id : "easylist_plun_korean", // Korean filters
    language : true,
    hidden : false,
  },
  "https://notabug.org/latvian-list/adblock-latvian/raw/master/lists/latvian-list.txt" :
  {
    id : "latvian_old", // Latvian filters
    language : true, // discontinued language list
    hidden : true,
  },
  "http://fanboy.co.nz/fanboy-swedish.txt" :
  {
    id : "swedish", // Swedish filters
    language : true,
    hidden : false,
  },
  "http://fanboy.co.nz/fanboy-turkish.txt" :
  {
    id : "turkish", // Turkish filters
    language : true,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/easyprivacy.txt" :
  {
    id : "easyprivacy", // EasyPrivacy
    language : false,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/fanboy-social.txt" :
  {
    id : "antisocial", // Antisocial
    language : false,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt" :
  {
    id : "annoyances", // Fanboy's Annoyances
    language : false,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt" :
  {
    id : "warning_removal", // AdBlock warning removal
    language : false,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/exceptionrules.txt" :
  {
    id : "acceptable_ads", // Acceptable Ads
    language : false,
    hidden : false,
  },
  "http://gurud.ee/ab.txt" :
  {
    id : "easylist_plus_estonian", // Estonian filters
    language : true,
    hidden : false,
  },
  "http://margevicius.lt/easylistlithuania.txt" :
  {
    id : "easylist_plus_lithuania_old", // Lithuania filters
    language : true, // discontinued language list
    hidden : true,
  },
  "https://easylist-downloads.adblockplus.org/Liste_AR.txt" :
  {
    id : "easylist_plus_arabic", // Arabic filters
    language : true,
    hidden : true,
  },
  "http://adblock.gardar.net/is.abp.txt" :
  {
    id : "icelandic", // Icelandic filters
    language : true,
    hidden : false,
  },
  "https://easylist-downloads.adblockplus.org/malwaredomains_full.txt" :
  {
    id : "malware", // Malware
    language : false,
    hidden : false,
  },
  "https://cdn.adblockcdn.com/filters/nominers.txt" :
  {
    id : "bitcoin_mining_protection", // Cryptocurrency (Bitcoin) Mining Protection
    language : false,
    hidden : false,
  },
};