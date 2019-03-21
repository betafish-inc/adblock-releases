'use strict';
// Set to true to get noisier console.log statements
var VERBOSE_DEBUG = false;

// Enabled in adblock_start_common.js and background.js if the user wants
var logging = function (enabled) {
  if (enabled) {
    loggingEnable = true;
    window.log = function () {
      if (VERBOSE_DEBUG || arguments[0] !== '[DEBUG]') { // comment out for verbosity
        console.log.apply(console, arguments);
      }
    }
  } else {
    window.log = function () {
    }

    loggingEnable = false;
  }
}

logging(false); // disabled by default
var loggingEnable = false;

// Behaves very similarly to $.ready() but does not require jQuery.
var onReady = function (callback) {
    if (document.readyState === 'complete')
        window.setTimeout(callback, 0);
    else
        window.addEventListener('load', callback, false);
  };

// Excecute any bandaid for the specific site, if the bandaids.js was loaded.
onReady(function()
{
  if (typeof run_bandaids === "function")
  {
    run_bandaids();
  }
});

var translate = function (messageID, args) {
  if (Array.isArray(args)) {
    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] !== 'string') {
        args[i] = args[i].toString();
      }
    }
  } else if (args && typeof args !== 'string') {
    args = args.toString();
  }

  return chrome.i18n.getMessage(messageID, args);
};

var splitMessageWithReplacementText = function(rawMessageText, messageID) {
    var anchorStartPos = rawMessageText.indexOf('[[');
    var anchorEndPos = rawMessageText.indexOf(']]');

    if (anchorStartPos === -1 || anchorEndPos === -1) {
      log("replacement tag not found", messageID, rawMessageText, anchorStartPos, anchorEndPos);
      return { error: "no brackets found" };
    }
    var returnObj = {};
    returnObj.anchorPrefixText = rawMessageText.substring(0, anchorStartPos);
    returnObj.anchorText = rawMessageText.substring(anchorStartPos + 2, anchorEndPos);
    returnObj.anchorPostfixText = rawMessageText.substring(anchorEndPos + 2);
    return returnObj;
};

var localizePage = function () {

    //translate a page into the users language
    $('[i18n]:not(.i18n-replaced, [i18n_replacement_el])').each(function () {
        $(this).text(translate($(this).attr('i18n')));
    });

    $('[i18n_value]:not(.i18n-replaced)').each(function () {
        $(this).val(translate($(this).attr('i18n_value')));
    });

    $('[i18n_title]:not(.i18n-replaced)').each(function () {
        $(this).attr('title', translate($(this).attr('i18n_title')));
    });

    $('[i18n_placeholder]:not(.i18n-replaced)').each(function () {
        $(this).attr('placeholder', translate($(this).attr('i18n_placeholder')));
    });

  $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
    // Replace a dummy <a/> inside of localized text with a real element.
    // Give the real element the same text as the dummy link.
    var messageID = $(this).attr("i18n");
    if (!messageID || typeof messageID !== "string") {
      $(this).addClass("i18n-replaced");
      return;
    }
    if (!$(this).get(0).firstChild) {
       log("returning, no first child found", $(this).attr("i18n"));
       return;
    }
    if (!$(this).get(0).lastChild) {
       log("returning, no last child found", $(this).attr("i18n"));
       return;
    }
    var replaceElId = '#' + $(this).attr("i18n_replacement_el");
    if ($(replaceElId).length === 0) {
      log("returning, no child element found", $(this).attr("i18n"), replaceElId);
      return;
    }
    var rawMessageText = chrome.i18n.getMessage(messageID) || "";
    var messageSplit = splitMessageWithReplacementText(rawMessageText, messageID);
    $(this).get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
    $(this).get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
    if ($(replaceElId).get(0).tagName === "INPUT") {
      $('#' + $(this).attr("i18n_replacement_el")).prop('value', messageSplit.anchorText);
    } else {
      $('#' + $(this).attr("i18n_replacement_el")).text(messageSplit.anchorText);
    }

    // If localizePage is run again, don't let the [i18n] code above
    // clobber our work
    $(this).addClass("i18n-replaced");
  });

  // Make a right-to-left translation for Arabic and Hebrew languages
  var language = determineUserLanguage();
  if (language === 'ar' || language === 'he') {
    $('#main_nav').removeClass('right').addClass('left');
    $('.adblock-logo').removeClass('left').addClass('right');
    $('.closelegend').css('float', 'left');
    document.documentElement.dir = 'rtl';
  }

};  // end of localizePage

// Determine what language the user's browser is set to use
var determineUserLanguage = function () {
    if ((typeof navigator.language !== 'undefined') &&
        navigator.language)
        return navigator.language.match(/^[a-z]+/i)[0];
    else
        return null;
  };

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
const parseUriRegEx = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/;
var parseUri = function (url) {
    var matches = parseUriRegEx.exec(url);

    // The key values are identical to the JS location object values for that key
    var keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'port',
        'pathname', 'search', 'hash', ];
    var uri = {};
    for (var i = 0; (matches && i < keys.length); i++)
        uri[keys[i]] = matches[i] || '';
    return uri;
  };

// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function (search) {

    // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
    search = search.substring(search.indexOf('?') + 1).split('&');
    var params = {}, pair;
    for (var i = 0; i < search.length; i++) {
      pair = search[i].split('=');
      if (pair[0] && !pair[1])
          pair[1] = '';
      if (!params[decodeURIComponent(pair[0])] && decodeURIComponent(pair[1]) === 'undefined') {
        continue;
      } else {
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
    }

    return params;
  };

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
// keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function(domain, keepDot)
{
  if (domain)
  {
    var match = domain.match(/([^\.]+\.(?:co\.)?[^\.]+)\.?$/) || [domain, domain];
    return match[keepDot ? 0 : 1].toLowerCase();
  }
  else
  {
    return domain;
  }
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var sessionstorage_get = function(key)
{
  var json = sessionStorage.getItem(key);
  if (json == null)
    return undefined;
  try
  {
    return JSON.parse(json);
  }
  catch (e)
  {
    log("Couldn't parse json for " + key);
    return undefined;
  }
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var sessionstorage_set = function(key, value) {
  if (value === undefined) {
    sessionStorage.removeItem(key);
    return;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (ex) {
    if (ex.name == "QUOTA_EXCEEDED_ERR") {
      alert(translate("storage_quota_exceeded"));
      openTab("options/index.html#ui-tabs-2");
    }
  }
};

// Run a function on the background page.
// Inputs (positional):
// first, a string - the name of the function to call
// then, any arguments to pass to the function (optional)
// then, a callback:function(return_value:any) (optional)
var BGcall = function()
{
  var args = [];
  for (var i = 0; i < arguments.length; i++)
    args.push(arguments[i]);
  var fn = args.shift();
  var has_callback = (typeof args[args.length - 1] == "function");
  var callback = (has_callback ? args.pop() : function() {});
  chrome.runtime.sendMessage({
    command : "call",
    fn : fn,
    args : args
  }, callback);
};

// Inputs: key:string.
// Returns object from localStorage.
// The following two functions should only be used when
// multiple 'sets' & 'gets' may occur in immediately preceding each other
// chrome.storage.local.get & set instead
var storage_get = function(key) {
  var store = localStorage;
  var json = store.getItem(key);
  if (json == null)
    return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    log("Couldn't parse json for " + key, e);
    return undefined;
  }
};

// Inputs: key:string, value:object.
// Returns undefined.
var storage_set = function(key, value) {
  var store = localStorage;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    console.log(ex)
  }
};

var chromeStorageSetHelper = function(key, value, callback)
{
    let items = {};
    items[key] = value;
    chrome.storage.local.set(items, callback);
};

Object.assign(window, {
  sessionstorage_set,
  sessionstorage_get,
  storage_get,
  storage_set,
  BGcall,
  parseUri,
  determineUserLanguage,
  chromeStorageSetHelper,
  logging,
  translate,
});