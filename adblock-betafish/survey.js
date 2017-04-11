// if the ping reponse indicates a survey (tab or overlay)
// gracefully processes the request

SURVEY = (function() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  var surveyAllowed = true;
  var lastNotificationID = "";

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

  var getBlockCountOnActiveTab = function(callback) {
    ext.pages.query(
    {
      active: true,
      lastFocusedWindow: true,
    }, function (pages)
    {
      if (pages.length === 0)
      {
        return;
      }
      page = pages[0];
      var blockedPerPage = require('stats').getBlockedPerPage(page);
      callback(blockedPerPage);
    });
  }

  //create a Notification
  var processNotification = function(surveyData) {
    // Check to see if we should show the survey before showing the overlay.
    var showNotificationIfAllowed = function(tab) {
      shouldShowSurvey(surveyData, function(updatedSurveyData) {
        lastNotificationID = (Math.floor(Math.random() * 3000)).toString();
        if (updatedSurveyData) {
          newSurveyData = surveyDataFrom(JSON.stringify(updatedSurveyData));
          if (newSurveyData.survey_id === surveyData.survey_id) {
            surveyData = newSurveyData;
          } else {
            recordGeneralMessage("survey ids do not match, original sid: " + surveyData.survey_id + " updated sid: " + newSurveyData.survey_id);
            return;
          }
        }
        if (!surveyData.notification_options ||
            !surveyData.notification_options.type ||
            !surveyData.notification_options.message ||
            !surveyData.notification_options.icon_url ||
            isNaN(surveyData.notification_options.priority)) {
          recordGeneralMessage("invalid survey data sid: " + surveyData.survey_id);
          return;
        }
        var notificationOptions = {
          title: surveyData.notification_options.title,
          iconUrl: surveyData.notification_options.icon_url,
          type: surveyData.notification_options.type,
          priority: surveyData.notification_options.priority,
          message: surveyData.notification_options.message
        };
        if (surveyData.notification_options.context_message) {
          notificationOptions.contextMessage = surveyData.notification_options.context_message;
        }
        if (surveyData.notification_options.require_interaction) {
          notificationOptions.requireInteraction = surveyData.notification_options.require_interaction;
        }
        if (surveyData.notification_options.is_clickable) {
          notificationOptions.isClickable = surveyData.notification_options.is_clickable;
        }
        // click handler for notification
        var notificationClicked = function(notificationId) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (notificationId === lastNotificationID && surveyData.notification_options.clicked_url) {
            recordGeneralMessage("notification clicked sid: " + surveyData.survey_id);
            openTab("https://getadblock.com/" + surveyData.notification_options.clicked_url);
          } else {
            recordGeneralMessage("notification clicked no URL to open sid: " + surveyData.survey_id);
          }
        };
        var buttonNotificationClicked = function(notificationId, buttonIndex) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (surveyData.notification_options.buttons) {
            if (notificationId === lastNotificationID && buttonIndex === 0) {
                recordGeneralMessage("button 0 clicked sid: " + surveyData.survey_id);
                openTab("https://getadblock.com/" + surveyData.notification_options.buttons[0].clicked_url);
            }
            if (notificationId === lastNotificationID && buttonIndex === 1) {
                recordGeneralMessage("button 1 clicked sid: " + surveyData.survey_id);
                openTab("https://getadblock.com/" + surveyData.notification_options.buttons[1].clicked_url);
            }
          }
        };
        var closedClicked = function(notificationId, byUser) {
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          recordGeneralMessage("notification closed sid: " + surveyData.survey_id + " bu:" + byUser);
        };
        chrome.notifications.onClicked.removeListener(notificationClicked);
        chrome.notifications.onClicked.addListener(notificationClicked);
        if (surveyData.notification_options.buttons) {
          var buttonArray = [];
          if (surveyData.notification_options.buttons[0]) {
            buttonArray.push({title: surveyData.notification_options.buttons[0].title,
                           iconUrl: surveyData.notification_options.buttons[0].icon_url})
          }
          if (surveyData.notification_options.buttons[1]) {
            buttonArray.push({title: surveyData.notification_options.buttons[1].title,
                           iconUrl: surveyData.notification_options.buttons[1].icon_url})
          }
          notificationOptions.buttons = buttonArray;
        }
        chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
        chrome.notifications.onButtonClicked.addListener(buttonNotificationClicked);
        chrome.notifications.onClosed.addListener(closedClicked);
        // show the notification to the user.
        chrome.notifications.create(lastNotificationID, notificationOptions, function(id) {
          if (chrome.runtime.lastError) {
            recordGeneralMessage("error, survey not shown, type:notification sid: " + surveyData.survey_id);
            chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
            chrome.notifications.onClicked.removeListener(notificationClicked);
            chrome.notifications.onClosed.removeListener(closedClicked);
            return;
          }
          recordGeneralMessage("survey shown, type:notification sid: " + surveyData.survey_id);
        });
      });
    };

    var retryInFiveMinutes = function() {
      var fiveMinutes = 5 * 60 * 1000;
      setTimeout(function() {
        processNotification(surveyData);
      }, fiveMinutes);
    };
    // check (again) if we still have permission to show a notification
    if (chrome &&
        chrome.notifications &&
        chrome.notifications.getPermissionLevel) {
        chrome.notifications.getPermissionLevel(function(permissionLevel){
          if (permissionLevel === "granted") {
            if (isNaN(surveyData.block_count_limit)) {
              log('invalid block_count_limit', surveyData.block_count_limit);
              return;
            }
            surveyData.block_count_limit = Number(surveyData.block_count_limit);
            chrome.idle.queryState(60, function(state) {
              if (state === "active") {
                getBlockCountOnActiveTab(function(blockedPerPage) {
                  if (blockedPerPage >= surveyData.block_count_limit) {
                    getActiveTab(function(tab) {
                      if (tab && validTab(tab)) {
                        showNotificationIfAllowed(tab);
                      } else {
                        // We didn't find an appropriate tab
                        retryInFiveMinutes();
                      }
                    });
                  } else {
                    retryInFiveMinutes();
                  }
                }); // end getBlockCountOnActiveTab
              } else {
                // browser is idle or locked
                retryInFiveMinutes();
              }
            }); // end chrome.idle.queryState
          }
        });
    }
  }; //end of processNotification()

  //open a Tab for a full page survey
  var processTab = function(surveyData) {

    var waitForUserAction = function() {
      if (SAFARI) {
        safari.application.removeEventListener("open", waitForUserAction, true);
      } else {
        chrome.tabs.onCreated.removeListener(waitForUserAction);
      }
      var openTabIfAllowed = function() {
        shouldShowSurvey(surveyData, function (responseData) {
          ext.pages.open('https://getadblock.com/' + responseData.open_this_url);
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
      chrome.tabs.onCreated.removeListener(waitForUserAction);
      chrome.tabs.onCreated.addListener(waitForUserAction);
    }
  }; //end of processTab()

  //Display a notification overlay on the active tab
  // To avoid security issues, the tab that is selected must not be incognito mode (Chrome only),
  // and must not be using SSL / HTTPS
  var processOverlay = function(surveyData) {

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
      var data = { cmd: "survey", u: STATS.userId(), sid: surveyData.survey_id };
      if (STATS.flavor === "E" && Prefs.blocked_total) {
        data["b"] = Prefs.blocked_total;
      }
      $.post(STATS.statsUrl, data, function(responseData) {
        try {
          var data = JSON.parse(responseData);
        } catch (e) {
          log('Error parsing JSON: ', responseData, " Error: ", e);
        }
        if (data && data.should_survey === 'true' && surveyAllowed) {
          surveyAllowed = false;
          callback(data);
        }
      });
    } else {
     log('survey not allowed');
    }
  };

  // Check the response from a ping to see if it contains valid survey instructions.
  // If so, return an object containing data about the survey to show.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var surveyDataFrom = function(responseData) {
      if (responseData.length === 0 || responseData.trim().length === 0)
        return null;

      try {
        var surveyData = JSON.parse(responseData);
        if (!surveyData)
          return;
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
      } else if (surveyData.type === 'notification') {
        processNotification(surveyData);
      }
    },//end of maybeSurvey
    types: function(callback) {
      // 'O' = Overlay Surveys
      // 'T' = Tab Surveys
      // 'N' = Notifications
      if (chrome &&
          chrome.notifications &&
          chrome.notifications.getPermissionLevel) {
          chrome.notifications.getPermissionLevel(function(permissionLevel){
            if (permissionLevel === "granted") {
              callback("OTN");
            } else {
              callback("OT");
            }
          });
          return;
      }
      callback("OT");
    }
  };
})();
