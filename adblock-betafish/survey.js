//if the ping reponse indicates a survey (tab or overlay)
//gracefully processes the request
SURVEY = (function() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  var surveyAllowed = true;

  //open a Tab for a full page survey
  var processTab = function(surveyData) {

    var waitForUserAction = function() {
      if (SAFARI) {
        safari.application.removeEventListener("open", waitForUserAction, true);
      } else {
        chrome.tabs.onCreated.removeListener(waitForUserAction);
      }
      var openTabIfAllowed = function() {
        shouldShowSurvey(surveyData, function () {
          ext.pages.open('https://getadblock.com/' + surveyData.open_this_url);
        });
      }
      if (SAFARI) {
        // Safari has a bug: if you open a new tab, it will shortly thereafter
        // set the active tab's URL to "Top Sites". However, here, after the
        // user opens a tab, we open another. It mistakenly thinks
        // our tab is the one the user opened and clobbers our URL with "Top
        // Sites."
        // To avoid this, we wait a bit, let it update the user's tab, then
        // open ours.
        window.setTimeout(openTabIfAllowed, 500);
      } else {
        openTabIfAllowed();
      }
    };

    if (SAFARI) {
      safari.application.addEventListener("open", waitForUserAction, true);
    } else {
      if (chrome.tabs.onCreated.hasListener(waitForUserAction)) {
          chrome.tabs.onCreated.removeListener(waitForUserAction);
      }
      chrome.tabs.onCreated.addListener(waitForUserAction);
    }
  }; //end of processTab()

  //Display a notification overlay on the active tab
  // To avoid security issues, the tab that is selected must not be incognito mode (Chrome only),
  // and must not be using SSL / HTTPS
  var processOverlay = function(surveyData) {
    // Call |callback(tab)|, where |tab| is the active tab, or undefined if
    // there is no active tab.
    var getActiveTab = function(callback) {
      if (!SAFARI) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          callback(tabs[0]);
        });
      } else {
        var target = safari || {};
        target = target.application || {};
        target = target.activeBrowserWindow || {};
        callback(target.activeTab);
      }
    };

    // True if we are willing to show an overlay on this tab.
    var validTab = function(tab) {
      if (!SAFARI) {
        if (tab.incognito || tab.status !== "complete") {
          return false;
        }
      }
      return /^http:/.test(tab.url);
    };

    // Check to see if we should show the survey before showing the overlay.
    var showOverlayIfAllowed = function(tab) {
      shouldShowSurvey(surveyData, function() {
        var data = { command: "showoverlay", overlayURL: surveyData.open_this_url, tabURL:tab.url};
        var validateResponseFromTab = function(response) {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message) {
              recordErrorMessage('overlay message error ' + chrome.runtime.lastError.message);
            } else {
              recordErrorMessage('overlay message error ' + JSON.stringify(chrome.runtime.lastError));
            }
          } else if (!response || response.ack !== data.command) {
            recordErrorMessage('invalid response from notification overlay script' + response);
          }
        };
        if (SAFARI) {
          chrome.extension.sendRequest(data, validateResponseFromTab);
        } else {
          chrome.tabs.sendRequest(tab.id, data, validateResponseFromTab);
        }
      });
    };

    var retryInFiveMinutes = function() {
      var fiveMinutes = 5 * 60 * 1000;
      setTimeout(function() {
        processOverlay(surveyData);
      }, fiveMinutes);
    };

    getActiveTab(function(tab) {
      if (tab && validTab(tab)) {
        showOverlayIfAllowed(tab);
      } else {
        // We didn't find an appropriate tab
        retryInFiveMinutes();
      }
    });
  }; //end of processOverlay()

  //functions below are used by both Tab and Overlay Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  var shouldShowSurvey = function(surveyData, callback) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    if (surveyAllowed) {
        var data = { cmd: "survey", u: STATS.userId, sid: surveyData.survey_id };
        $.post(STATS.statsUrl, data, function(responseData) {
          try {
            var data = JSON.parse(responseData);
          } catch (e) {
            console.log('Error parsing JSON: ', responseData, " Error: ", e);
          }
          if (data && data.should_survey === 'true') {
            surveyAllowed = false;
            callback();
          }
        });
      }
  };

  // Check the response from a ping to see if it contains valid survey instructions.
  // If so, return an object containing data about the survey to show.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var surveyDataFrom = function(responseData) {
      if (responseData.length === 0)
        return null;

      log('validating ping response data', responseData);

      try {
        var surveyData = JSON.parse(responseData);
        if (!surveyData.open_this_url ||
            !surveyData.open_this_url.match ||
            !surveyData.open_this_url.match(/^\/survey\//)) {
          log("bad survey data", responseData);
          return null;
        }
      } catch (e) {
        console.log("Something went wrong with parsing survey data.");
        console.log('error', e);
        console.log('response data', responseData);
        return null;
      }
      return surveyData;
  };

  return {
    maybeSurvey: function(responseData) {
      if (getSettings().show_survey === false)
        return;

      var surveyData = surveyDataFrom(responseData);
      if (!surveyData)
        return;

      if (surveyData.type === 'overlay') {
        processOverlay(surveyData);
      } else if (surveyData.type === 'tab') {
        processTab(surveyData);
      }
    },//end of maybeSurvey
    types: function() {
      // 'O' = Overlay Surveys and 'T' = Tab Surveys
      return "OT";
    }
  };
})();
