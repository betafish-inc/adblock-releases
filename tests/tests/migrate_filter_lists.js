(function()
{
  var FilterStorage = require("filterStorage").FilterStorage;
  var additions = [];
  function filterListener(action, subscription) {
    if (action.indexOf("subscription.added") == 0) {
      additions.push(action + " " + subscription.url);
    }
  }

  // Convert legacy AdBlock FilterLists to ABP Subscriptions
  function migrateLegacyFilterLists(mySubs) {
    if (!mySubs || mySubs.length < 1) {
      return;
    }
    // Migration logic...
    // Remove any existing subscriptions
    for (var i = 0; i < FilterStorage.subscriptions.length; i++) {
      var subscription = FilterStorage.subscriptions[i];
      FilterStorage.removeSubscription(subscription);
    }
    // Add AdBlock FilterLists
    for (var id in mySubs) {
      var sub = mySubs[id];
      if (sub.subscribed && sub.url && (id !== "malware")) {
        var subscription = Subscription.fromObject(sub);
        FilterStorage.addSubscription(subscription);
      } else if (!sub.subscribed && sub.url && (id !== "malware")) {
        var subscription = Subscription.fromObject(sub);
        FilterStorage.removeSubscription(subscription);
      }
    }
  }
  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  storage_get = function(key) {
    var store = localStorage;
    if (store === undefined) {
        return undefined;
    }
    var json = store.getItem(key);
    if (json == null)
      return undefined;
    try {
      return JSON.parse(json);
    } catch (e) {
      log("Couldn't parse json for " + key);
      return undefined;
    }
  };

   // Inputs: key:string, value:object.
  // If value === undefined, removes key from storage.
  // Returns undefined.
  storage_set = function(key, value) {
    var store = localStorage;
    if (value === undefined) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify(value));
  };
   //Create Test old AdBlock Subs, save,  then migrate
  determineUserLanguage = function() {
    return navigator.language.match(/^[a-z]+/i)[0];
  };

  function removeLegacyFilterLists(keepListeners) {
    storage_set('filter_lists', undefined);
    FilterNotifier.removeListener(filterListener);
  }

  function setupLegacyFilterLists(keepListeners) {

    FilterNotifier.addListener(filterListener);

    var create_default_subscriptions = function() {
      var result = {};
      // Returns the ID of the list appropriate for the user's locale, or ''
      function listIdForThisLocale() {
        var language = determineUserLanguage();
        switch(language) {
          case 'ar': return 'easylist_plus_arabic';
          case 'bg': return 'easylist_plus_bulgarian';
          case 'cs': return 'czech';
          case 'cu': return 'easylist_plus_bulgarian';
          case 'da': return 'danish';
          case 'de': return 'easylist_plus_german';
          case 'el': return 'easylist_plus_greek';
          case 'et': return 'easylist_plus_estonian';
          case 'fi': return 'easylist_plus_finnish';
          case 'fr': return 'easylist_plus_french';
          case 'he': return 'israeli';
          case 'hu': return 'hungarian';
          case 'is': return 'icelandic';
          case 'it': return 'italian';
          case 'id': return 'easylist_plus_indonesian';
          case 'ja': return 'japanese';
          case 'ko': return 'easylist_plun_korean';
          case 'lt': return 'easylist_plus_lithuania';
          case 'lv': return 'latvian';
          case 'nl': return 'dutch';
          case 'pl': return 'easylist_plus_polish';
          case 'ro': return 'easylist_plus_romanian';
          case 'ru': return 'russian';
          case 'sk': return 'czech';
          case 'sv': return 'swedish';
          case 'tr': return 'turkish';
          case 'uk': return 'russian';
          case 'zh': return 'chinese';
          default: return '';
        }
      }
      //Update will be done immediately after this function returns
      result["adblock_custom"] = { subscribed: true };
      result["easylist"] = { subscribed: true };
      result["malware"] = { subscribed: true };
      result["acceptable_ads"] = { subscribed: true };
      var list_for_lang = listIdForThisLocale();
      if (list_for_lang)
        result[list_for_lang] = { subscribed: true };
      return result;
    }

    var make_subscription_options = function() {
      // When modifying a list, IDs mustn't change!
      return {
        "adblock_custom": { // AdBlock custom filters
          url: "https://cdn.adblockcdn.com/filters/adblock_custom.txt",
        },
        "easylist": { // EasyList
          url: "https://easylist-downloads.adblockplus.org/easylist.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist.json",
          safariJSON_URL_AA: "https://cdn.adblockcdn.com/filters/easylist_aa.json",
        },
        "easylist_plus_bulgarian": { // Additional Bulgarian filters
          url: "http://stanev.org/abp/adblock_bg.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_bulgarian.json",
        },
        "dutch": { // Additional Dutch filters
          url: "https://easylist-downloads.adblockplus.org/easylistdutch.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/dutch.json",
        },
        "easylist_plus_finnish": { // Additional Finnish filters
          url: "http://adb.juvander.net/Finland_adb.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_finnish.json",
        },
        "easylist_plus_french": { // Additional French filters
          url: "https://easylist-downloads.adblockplus.org/liste_fr.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_french.json",
        },
        "easylist_plus_german": { // Additional German filters
          url: "https://easylist-downloads.adblockplus.org/easylistgermany.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_german.json",
        },
        "easylist_plus_greek": { // Additional Greek filters
          url: "https://www.void.gr/kargig/void-gr-filters.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_greek.json",
        },
        "easylist_plus_indonesian": { // Additional Indonesian filters
          url: "https://indonesianadblockrules.googlecode.com/hg/subscriptions/abpindo.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_indonesian.json",
        },
        "easylist_plus_polish": { // Additional Polish filters
          url: "https://raw.githubusercontent.com/adblockpolska/Adblock_PL_List/master/adblock_polska.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_polish.json",
          requiresList: "easylist",
        },
        "easylist_plus_romanian": { // Additional Romanian filters
          url: "http://www.zoso.ro/pages/rolist.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_romanian.json",
        },
        "russian": { // Additional Russian filters
          url: "https://easylist-downloads.adblockplus.org/advblock.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/russian.json",
        },
        "chinese": { // Additional Chinese filters
          url: "https://easylist-downloads.adblockplus.org/easylistchina.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/chinese.json",
        },
        "czech": { // Additional Czech and Slovak filters
          url: "https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/czech.json",
        },
        "danish": { // Danish filters
          url: "http://adblock.schack.dk/block.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/danish.json",
        },
        "hungarian": { // Hungarian filters
          url: "http://pete.teamlupus.hu/hufilter.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/hungarian.json",
        },
        "israeli": { // Israeli filters
          url: "https://easylist-downloads.adblockplus.org/israellist+easylist.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/israeli.json",
        },
        "italian": { // Italian filters
          url: "https://easylist-downloads.adblockplus.org/easylistitaly.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/italian.json",
          requiresList: "easylist",
        },
        "japanese": { // Japanese filters
          url: "https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/japanese.json",
        },
        "easylist_plun_korean": {  // Korean filters
          url: "https://secure.fanboy.co.nz/fanboy-korean.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plun_korean.json",
        },
        "latvian": {  // Latvian filters
          url: "https://gitorious.org/adblock-latvian/adblock-latvian/blobs/raw/master/lists/latvian-list.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/latvian.json",
        },
        "swedish": {  // Swedish filters
          url: "http://fanboy.co.nz/fanboy-swedish.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/swedish.json",
        },
        "turkish": {  // Turkish filters
          url: "http://fanboy.co.nz/fanboy-turkish.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/turkish.json",
        },
        "easyprivacy": { // EasyPrivacy
          url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easyprivacy.json",
        },
        "antisocial": { // Antisocial
          url: "https://easylist-downloads.adblockplus.org/fanboy-social.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/antisocial.json",
        },
        "malware": { // Malware protection
          url: "https://cdn.adblockcdn.com/filters/domains.json",
        },
        "annoyances": { // Fanboy's Annoyances
          url: "https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/annoyances.json",
        },
        "warning_removal": { // AdBlock warning removal
          url: "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/warning_removal.json",
        },
        "acceptable_ads": { // Acceptable Ads
          url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
        },
        "easylist_plus_estonian": { // Estonian filters
          url: "http://gurud.ee/ab.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_estonian.json",
        },
        "easylist_plus_lithuania": { // Lithuania filters
          url: "http://margevicius.lt/easylistlithuania.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_lithuania.json",
        },
        "easylist_plus_arabic": { // Arabic filters
          url: "https://easylist-downloads.adblockplus.org/Liste_AR.txt",
          requiresList: "easylist",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/easylist_plus_arabic.json",
        },
        "icelandic": { // Icelandic filters
          url: "http://adblock.gardar.net/is.abp.txt",
          safariJSON_URL: "https://cdn.adblockcdn.com/filters/icelandic.json",
        }
      };
    }
    var defaultSubscriptions = create_default_subscriptions();
    var sub_options = make_subscription_options();

    for (var id in sub_options) {
      var sub = sub_options[id];
      if (id in defaultSubscriptions) {
        sub.subscribed = true;
      }
    }
    storage_set('filter_lists', sub_options);
  };

  module("Migration AdBlock Filter Lists", {
    setup: setupLegacyFilterLists,
    teardown: removeLegacyFilterLists
  });

  test("Typical AdBlock Filter List Migration", function() {
    additions = [];
    var mySubs = storage_get('filter_lists');
    ok( mySubs, "Should be set up." );
    migrateLegacyFilterLists(mySubs);
    equal(((FilterStorage.subscriptions.length === 3) || (FilterStorage.subscriptions.length === 4)), true, "ABP subscription should equal 3 or 4(depending on user language)");
    equal(((additions.length === 3) || (additions.length === 4)), true, "# of additions should be 3 or 4");
  });

  test("No AdBlock Filter List Migration", function() {
    additions = [];
    var mySubs = [];
    var initialLength = FilterStorage.subscriptions.length;
    migrateLegacyFilterLists(mySubs);
    equal(FilterStorage.subscriptions.length, initialLength, "# of ABP subscriptions should be the same as before the test.");
    equal(additions.length, 0, "# of additions should equal 0");
  });

  test("Only Easylist", function() {
    additions = [];
    var mySubs = storage_get('filter_lists');
    ok( mySubs, "Should be set up." );
    for (var id in mySubs) {
      if (id !=="easylist") {
        var sub = mySubs[id];
        sub.subscribed = false;
      }
    }
    migrateLegacyFilterLists(mySubs);
    equal(FilterStorage.subscriptions.length, 1, "ABP subscription should equal 1");
    //equal(additions.length, 1, "# of additions should equal 1");
  });

  test("No FilterLists", function() {
    additions = [];
    var mySubs = storage_get('filter_lists');
    ok( mySubs, "Should be set up." );
    for (var id in mySubs) {
        var sub = mySubs[id];
        sub.subscribed = false;
    }
    delete mySubs["acceptable_ads"].subscribed;
    migrateLegacyFilterLists(mySubs);
    equal(FilterStorage.subscriptions.length, 0, "ABP subscription length should be zero");
    equal(additions.length, 0, "# of additions should equal 0");
  });

  test("User Added Sub", function() {
    additions = [];
    var mySubs = storage_get('filter_lists');
    ok( mySubs, "Should be set up." );
    var userAddedSub = {};
    userAddedSub.url = "https://raw.githubusercontent.com/wiltteri/wiltteri.txt/master/wiltteri.txt";
    userAddedSub.id = "https://raw.githubusercontent.com/wiltteri/wiltteri.txt/master/wiltteri.txt";
    userAddedSub.title = "TestTitle";
    userAddedSub.subscribed = true;
    mySubs[ userAddedSub.id ] = userAddedSub;
     //Migration logic...
    migrateLegacyFilterLists(mySubs);
    equal(((FilterStorage.subscriptions.length === 4) || (FilterStorage.subscriptions.length === 5)), true, "ABP subscription should equal 4 or 5(depending on user language)");
    equal(((additions.length === 4) || (additions.length === 5)), true, "# of additions should equal 4 or 5(depending on user language)");

  });

})();
