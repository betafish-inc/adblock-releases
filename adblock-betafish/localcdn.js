LocalCDN = (function() {
  "use-strict";

  var urlsMatchPattern = ["http://*/*", "https://*/*"];
  var hostRegex = /ajax\.googleapis\.com|ajax\.aspnetcdn\.com|ajax\.microsoft\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|yastatic\.net|yandex\.st|libs\.baidu\.com|lib\.sinaapp\.com|upcdn\.b0\.upaiyun\.com/;
  var pathRegex = { jquery: /jquery[\/\-](\d*\.\d*\.\d*)/ };
  var libraryPaths = { jquery: { prefix: "jquery-", postfix: ".min.js.local" }};
  var headersToRemove = ["Cookie", "Origin", "Referer"];
  var localFiles = {};
  var libraries = [];
  var versionArray = {};
  var redirectCountKey = "redirectCount";
  var dataCountKey = "redirectDataCount";
  var missedVersionsKey = "missedVersions";

  // Completes necessary set up for the LocalCDN
  // Post:  localFiles, libraries, and versionArray are populated based on 
  //        available local files
  var setUp = function() {
    localFiles = getAvailableFiles();
    libraries = Object.getOwnPropertyNames(localFiles);
    versionArray = populateVersionArray();
  };

  // Populates the version array based on the files available locally
  // Pre: localFiles and libraries must be populated first
  var populateVersionArray = function() {
    var libraryVersions = {};
    // go through each libarary
    for (var i = 0; i < libraries.length; i++) {
      // check for path info
      if (libraryPaths[libraries[i]]) {
        // get the filenames
        var filenames = Object.getOwnPropertyNames(localFiles[libraries[i]]);
        libraryVersions[libraries[i]] = [];
        for (var j = 0; j < filenames.length; j++){
          // extract the version from the filesname
          var version = filenames[j].replace(libraryPaths[libraries[i]].prefix, "");
          version = version.replace(libraryPaths[libraries[i]].postfix, "");
          libraryVersions[libraries[i]].push(version);
        }
      }
    }

    return libraryVersions;
  };

  // Handles a webRequest.onBeforeRequest event.
  // Redirects any requests for locally available files from a matching host,
  // if AdBlock is not paused. Otherwise allows request to continue as normal.
  // Records any redirects, bytes of data redirected, and missing versions of 
  // supported libararies.
  // Param: details: holds information about the request, including the URL.
  var libRequestHandler = function(details) {
    // respect pause
    if (!adblockIsPaused()) {
      var targetLibrary = null;
      var requestUrl = parseUri(details.url);

      // check if the url contains a library keyword
      for (var i = 0; i < libraries.length; i++) {
        if (requestUrl.pathname.indexOf(libraries[i]) != -1) {
          targetLibrary = libraries[i];
        }
      }

      // check the request host
      if (targetLibrary != null && hostRegex.test(requestUrl.host)) {
        // check the path
        var matches = pathRegex[targetLibrary].exec(requestUrl.pathname);
        if (matches) {
          var version = matches[1];

          // check if we have the version locally
          if (versionArray[targetLibrary].indexOf(version) != -1) {
            var fileName = libraryPaths[targetLibrary].prefix + version + libraryPaths[targetLibrary].postfix;
            var localPath = "localLib/" + targetLibrary + "/" + fileName;
            incrementRedirectCount();
            addToDataCount(targetLibrary, fileName);
            return { redirectUrl: chrome.runtime.getURL(localPath) };
          } else {
            addMissedVersion(targetLibrary, version);
          }
        } 
      }
    }

    return { cancel: false };
  };

  // Increments the redirect count by one.
  // The redirect count is loaded from and saved to localStorage.
  var incrementRedirectCount = function() {
    // get stored redirect count
    var storedRedirectCount = getStoredValue(redirectCountKey, 0);

    // increment
    storedRedirectCount++;

    // store updated count
    localStorage.setItem(redirectCountKey, JSON.stringify(storedRedirectCount));
  };

  // Adds the size of the specified file to the data count for that library.
  // The data count is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the file belongs to
  //        fileName: the file to be added to the data count
  var addToDataCount = function(targetLibrary, fileName) {
    // get stored redirect count
    var storedDataCount = getStoredValue(dataCountKey, 0);

    // add file size to data count
    storedDataCount = storedDataCount + localFiles[targetLibrary][fileName];

    // store updated count
    localStorage.setItem(dataCountKey, JSON.stringify(storedDataCount));
  };

  // Adds the specified version of the specified library to the missed versions
  // object, if it hasn't already been added. Otherwise increments the count for
  // that version.
  // The missed versions object is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the missing version belongs to
  //        version: the missing version to be added
  var addMissedVersion = function(targetLibrary, version) {
    // get stored missed versions
    var storedMissedVersions = getStoredValue(missedVersionsKey, {});

    // add new missed version
    if (!storedMissedVersions[targetLibrary]) {
      storedMissedVersions[targetLibrary] = {};
    }
    if (storedMissedVersions[targetLibrary][version] > 0) {
      storedMissedVersions[targetLibrary][version] = storedMissedVersions[targetLibrary][version] + 1;
    } else {
      storedMissedVersions[targetLibrary][version] = 1;
    }

    // store updated missed versions
    localStorage.setItem(missedVersionsKey, JSON.stringify(storedMissedVersions));
  };

  // Gets a stored value from localStorage if available, and parses it. Otherwise,
  // if the value isn't currently stored or if the parse fails, returns a default
  // value.
  // Param: keyName: the key under which the value is stored
  //        defaultValue: the value to be returned if the stored value cannot be
  //                      retrieved
  var getStoredValue = function(keyName, defaultValue) {
    var storedValue = localStorage.getItem(keyName);
    try {
      storedValue = JSON.parse(storedValue);
    } catch(err) {
      storedValue = defaultValue;
    } finally {
      if (!storedValue) {
        storedValue = defaultValue;
      }
      return storedValue;
    }
  };

  // Handles a webrequest.onBeforeSendHeaders event.
  // Strips the cookie, origin, and referer headers (if present) from any requests for 
  // a supported libarary from a matching host, if AdBlock is not paused. Otherwise 
  // allows request to continue as normal.
  // Param: details: holds information about the request, including the URL and request
  //                 headers
  var stripMetadataHandler = function(details) {
    // respect pause
    if (!adblockIsPaused()) {
      var requestUrl = parseUri(details.url);
      var match = false;

      // check if the url contains a library keyword
      for (var k = 0; k < libraries.length; k++) {
        if (requestUrl.pathname.indexOf(libraries[k]) != -1) {
          match = true;
        }
      }

      // check for a matching host
      if (match && hostRegex.test(requestUrl.host)) {
        // strip the headers to remove, if present
        for (var i = 0; i < details.requestHeaders.length; i++) {
          var aHeader = details.requestHeaders[i].name;
          if (aHeader === headersToRemove[0] || aHeader === headersToRemove[1] || aHeader === headersToRemove[2]) {
            details.requestHeaders.splice(i--, 1);
          }
        }
      }
    }

    return {requestHeaders: details.requestHeaders};
  };

  // Sets redirect count, data count, and missed versions back to default
  // (0 for redirect count and data count, and an empty object for missed
  // versions)
  var resetCollectedData = function() {
    localStorage.setItem(redirectCountKey, "0");
    localStorage.setItem(dataCountKey, "0");
    localStorage.setItem(missedVersionsKey, "{}");
  };

  setUp();

  return {
    // Starts the LocalCDN listeners
    start: function() {
      chrome.webRequest.onBeforeRequest.addListener(libRequestHandler, { urls: urlsMatchPattern }, ["blocking"]); 
      chrome.webRequest.onBeforeSendHeaders.addListener(stripMetadataHandler, { urls: urlsMatchPattern }, ["blocking", "requestHeaders"]);      
    },
    // Stops the LocalCDN listeners and reset data
    end: function() {
      chrome.webRequest.onBeforeRequest.removeListener(libRequestHandler); 
      chrome.webRequest.onBeforeSendHeaders.removeListener(stripMetadataHandler);
      resetCollectedData();
    },
    // Gets the redirect count as a number of redirects
    getRedirectCount: function() {
      return getStoredValue(redirectCountKey, 0);
    },
    // Gets the data count as a number of bytes
    getDataCount: function() {
      return getStoredValue(dataCountKey, 0);
    },
    // Gets the missed versions object, which includes a count of how many
    // times the missed version has been requested
    getMissedVersions: function() {
      return getStoredValue(missedVersionsKey, {});
    }
  };
})();