'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, exports, STATS, log, getSettings, Prefs, openTab */

// if the ping response indicates a survey (tab or overlay)
// gracefully processes the request
const stats = require('stats');
const { recordGeneralMessage, recordErrorMessage } = require('./servermessages').ServerMessages;

const SURVEY = (function getSurvey() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  let surveyAllowed = true;
  let lastNotificationID = '';

  // Call |callback(tab)|, where |tab| is the active tab, or undefined if
  // there is no active tab.
  const getActiveTab = function (callback) {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      callback(tabs[0]);
    });
  };

  // True if we are willing to show an overlay on this tab.
  const validTab = function (tab) {
    if (tab.incognito || tab.status !== 'complete') {
      return false;
    }
    return /^http:/.test(tab.url);
  };

  const getBlockCountOnActiveTab = function (callback) {
    chrome.tabs.query(
      {
        active: true,
        lastFocusedWindow: true,
      },
    ).then((tabs) => {
      if (tabs.length === 0) {
        return;
      }
      const blockedPerPage = stats.getBlockedPerPage(tabs[0]);
      callback(blockedPerPage);
    });
  };

  // functions below are used by both Tab and Overlay Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  const shouldShowSurvey = function (surveyData, callback) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    if (surveyAllowed) {
      let data = { cmd: 'survey', u: STATS.userId(), sid: surveyData.survey_id };
      if (STATS.flavor === 'E' && Prefs.blocked_total) {
        data.b = Prefs.blocked_total;
      }
      $.post(STATS.statsUrl, data, (responseData) => {
        try {
          data = JSON.parse(responseData);
        } catch (e) {
          log('Error parsing JSON: ', responseData, ' Error: ', e);
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
  const surveyDataFrom = function (responseData) {
    let surveyData;

    if (responseData.length === 0 || responseData.trim().length === 0) {
      return null;
    }
    try {
      surveyData = JSON.parse(responseData);
      if (!surveyData) {
        return null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Something went wrong with parsing survey data.');
      // eslint-disable-next-line no-console
      console.log('error', e);
      // eslint-disable-next-line no-console
      console.log('response data', responseData);
      return null;
    }
    return surveyData;
  };

  // create a Notification
  const processNotification = function (surveyDataParam) {
    let surveyData = surveyDataParam;

    // Check to see if we should show the survey before showing the overlay.
    const showNotificationIfAllowed = function () {
      shouldShowSurvey(surveyData, (updatedSurveyData) => {
        lastNotificationID = (Math.floor(Math.random() * 3000)).toString();
        if (updatedSurveyData) {
          const newSurveyData = surveyDataFrom(JSON.stringify(updatedSurveyData));
          if (newSurveyData.survey_id === surveyData.survey_id) {
            surveyData = newSurveyData;
          } else {
            recordGeneralMessage('survey_ids_do_not_match', undefined, {
              original_sid: surveyData.survey_id,
              updated_sid: newSurveyData.survey_id,
            });
            return;
          }
        }
        if (!surveyData.notification_options
            || !surveyData.notification_options.type
            || !surveyData.notification_options.message
            || !surveyData.notification_options.icon_url
            || Number.isNaN(surveyData.notification_options.priority)) {
          recordGeneralMessage('invalid_survey_data', undefined, { sid: surveyData.survey_id });
          return;
        }
        const notificationOptions = {
          title: surveyData.notification_options.title,
          iconUrl: surveyData.notification_options.icon_url,
          type: surveyData.notification_options.type,
          priority: surveyData.notification_options.priority,
          message: surveyData.notification_options.message,
        };
        if (surveyData.notification_options.context_message) {
          const contextMessage = surveyData.notification_options.context_message;
          notificationOptions.contextMessage = contextMessage;
        }
        if (surveyData.notification_options.require_interaction) {
          const requireInteraction = surveyData.notification_options.require_interaction;
          notificationOptions.requireInteraction = requireInteraction;
        }
        if (surveyData.notification_options.is_clickable) {
          const isClickable = surveyData.notification_options.is_clickable;
          notificationOptions.isClickable = isClickable;
        }
        // click handler for notification
        const notificationClicked = function (notificationId) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          // Exceptions required since the errors cannot be resolved by changing
          // the order of function definitions. TODO: refactor to remove exceptions
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onClosed.removeListener(closedClicked);

          const clickedUrl = surveyData.notification_options.clicked_url;
          if (notificationId === lastNotificationID && clickedUrl) {
            recordGeneralMessage('notification_clicked', undefined, { sid: surveyData.survey_id });
            openTab(`https://getadblock.com/${surveyData.notification_options.clicked_url}`);
          } else {
            recordGeneralMessage('notification_clicked_no_URL_to_open', undefined, { sid: surveyData.survey_id });
          }
        };
        const buttonNotificationClicked = function (notificationId, buttonIndex) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          // Exception required since the error cannot be resolved by changing
          // the order of function definitions. TODO: refactor to remove exception
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (surveyData.notification_options.buttons) {
            if (notificationId === lastNotificationID && buttonIndex === 0) {
              recordGeneralMessage('button_0_clicked', undefined, { sid: surveyData.survey_id });
              openTab(`https://getadblock.com/${surveyData.notification_options.buttons[0].clicked_url}`);
            }
            if (notificationId === lastNotificationID && buttonIndex === 1) {
              recordGeneralMessage('button_1_clicked', undefined, { sid: surveyData.survey_id });
              openTab(`https://getadblock.com/${surveyData.notification_options.buttons[1].clicked_url}`);
            }
          }
        };
        const closedClicked = function (notificationId, byUser) {
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          recordGeneralMessage('notification_closed', undefined, { sid: surveyData.survey_id, bu: byUser });
        };
        chrome.notifications.onClicked.removeListener(notificationClicked);
        chrome.notifications.onClicked.addListener(notificationClicked);
        if (surveyData.notification_options.buttons) {
          const buttonArray = [];
          if (surveyData.notification_options.buttons[0]) {
            buttonArray.push({
              title: surveyData.notification_options.buttons[0].title,
              iconUrl: surveyData.notification_options.buttons[0].icon_url,
            });
          }
          if (surveyData.notification_options.buttons[1]) {
            buttonArray.push({
              title: surveyData.notification_options.buttons[1].title,
              iconUrl: surveyData.notification_options.buttons[1].icon_url,
            });
          }
          notificationOptions.buttons = buttonArray;
        }
        chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
        chrome.notifications.onButtonClicked.addListener(buttonNotificationClicked);
        chrome.notifications.onClosed.addListener(closedClicked);
        // show the notification to the user.
        chrome.notifications.create(lastNotificationID, notificationOptions).then(() => {
          recordGeneralMessage('survey_shown', undefined, { sid: surveyData.survey_id });
        }).catch(() => {
          recordGeneralMessage('error_survey_not_shown', undefined, { sid: surveyData.survey_id });
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
        });
      });
    };

    const retryInFiveMinutes = function () {
      const fiveMinutes = 5 * 60 * 1000;
      setTimeout(() => {
        processNotification(surveyData);
      }, fiveMinutes);
    };
    // check (again) if we still have permission to show a notification
    if (chrome
        && chrome.notifications
        && chrome.notifications.getPermissionLevel) {
      chrome.notifications.getPermissionLevel((permissionLevel) => {
        if (permissionLevel === 'granted') {
          if (Number.isNaN(surveyData.block_count_limit)) {
            log('invalid block_count_limit', surveyData.block_count_limit);
            return;
          }
          surveyData.block_count_limit = Number(surveyData.block_count_limit);
          chrome.idle.queryState(60, (state) => {
            if (state === 'active') {
              getBlockCountOnActiveTab((blockedPerPage) => {
                if (blockedPerPage >= surveyData.block_count_limit) {
                  getActiveTab((tab) => {
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
  }; // end of processNotification()

  // open a Tab for a full page survey
  const processTab = function (surveyData) {
    const openTabIfAllowed = function () {
      setTimeout(() => {
        shouldShowSurvey(surveyData, (responseData) => {
          chrome.tabs.create({ url: `https://getadblock.com/${responseData.open_this_url}` });
        });
      }, 10000); // 10 seconds
    };

    const waitForUserAction = function () {
      chrome.tabs.onCreated.removeListener(waitForUserAction);
      openTabIfAllowed();
    };

    chrome.idle.queryState(60, (state) => {
      if (state === 'active') {
        openTabIfAllowed();
      } else {
        chrome.tabs.onCreated.removeListener(waitForUserAction);
        chrome.tabs.onCreated.addListener(waitForUserAction);
      }
    });
  }; // end of processTab()

  // Display a notification overlay on the active tab
  // To avoid security issues, the tab that is selected must not be incognito mode (Chrome only),
  // and must not be using SSL / HTTPS
  const processOverlay = function (surveyData) {
    // Check to see if we should show the survey before showing the overlay.
    const showOverlayIfAllowed = function (tab) {
      shouldShowSurvey(surveyData, () => {
        const data = { command: 'showoverlay', overlayURL: surveyData.open_this_url, tabURL: tab.url };
        const validateResponseFromTab = function (response) {
          if (!response || response.ack !== data.command) {
            recordErrorMessage('invalid_response_from_notification_overlay_script', undefined, { errorMessage: response });
          }
        };
        chrome.tabs.sendMessage(tab.id, data).then(validateResponseFromTab).catch((error) => {
          recordErrorMessage('overlay_message_error', undefined, { errorMessage: JSON.stringify(error) });
        });
      });
    };

    const retryInFiveMinutes = function () {
      const fiveMinutes = 5 * 60 * 1000;
      setTimeout(() => {
        processOverlay(surveyData);
      }, fiveMinutes);
    };

    getActiveTab((tab) => {
      if (tab && validTab(tab)) {
        showOverlayIfAllowed(tab);
      } else {
        // We didn't find an appropriate tab
        retryInFiveMinutes();
      }
    });
  }; // end of processOverlay()

  return {
    maybeSurvey(responseData) {
      if (getSettings().show_survey === false) {
        return;
      }

      const surveyData = surveyDataFrom(responseData);
      if (!surveyData) {
        return;
      }

      if (surveyData.type === 'overlay') {
        processOverlay(surveyData);
      } else if (surveyData.type === 'tab') {
        processTab(surveyData);
      } else if (surveyData.type === 'notification') {
        processNotification(surveyData);
      }
    }, // end of maybeSurvey
    types(callback) {
      // 'O' = Overlay Surveys
      // 'T' = Tab Surveys
      // 'N' = Notifications
      if (chrome
          && chrome.notifications
          && chrome.notifications.getPermissionLevel) {
        chrome.notifications.getPermissionLevel((permissionLevel) => {
          if (permissionLevel === 'granted') {
            callback('OTN');
          } else {
            callback('OT');
          }
        });
        return;
      }
      callback('OT');
    },
  };
}());

exports.SURVEY = SURVEY;
