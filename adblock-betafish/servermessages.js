'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, exports, STATS, log, logging, determineUserLanguage */

// Log an 'error' message on GAB log server.
const ServerMessages = (function serverMessages() {
  const postFilterStatsToLogServer = function (data, callback) {
    if (!data) {
      return;
    }
    const payload = { event: 'filter_stats', payload: data };
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: 'https://log.getadblock.com/v2/record_log.php',
      data: JSON.stringify(payload),
      success(text, status, xhr) {
        if (typeof callback === 'function') {
          callback(text, status, xhr);
        }
      },
      error(xhr, textStatus, errorThrown) {
        log('message server returned error: ', textStatus, errorThrown);
        if (callback) {
          callback(errorThrown, textStatus, xhr);
        }
      },
    });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const sendMessageToLogServer = function (payload, callback) {
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: 'https://log.getadblock.com/v2/record_log.php',
      data: JSON.stringify(payload),
      success() {
        if (typeof callback === 'function') {
          callback();
        }
      },

      error(e) {
        log('message server returned error: ', e.status);
      },
    });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const recordMessageWithUserID = function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }
    const payload = {
      u: STATS.userId(),
      f: STATS.flavor,
      o: STATS.os,
      l: determineUserLanguage(),
      t: queryType,
      v: chrome.runtime.getManifest().version,
    };
    if (typeof additionalParams === 'object') {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  // Log a message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  const recordAnonymousMessage = function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }

    const payload = {
      f: STATS.flavor,
      o: STATS.os,
      l: determineUserLanguage(),
      t: queryType,
    };
    if (typeof additionalParams === 'object') {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  const recordErrorMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'error', callback, additionalParams);
  };

  // Log an 'status' related message on GAB log server.
  const recordStatusMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'stats', callback, additionalParams);
  };

  // Log a 'general' message on GAB log server.
  const recordGeneralMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'general', callback, additionalParams);
  };

  // Log a 'adreport' message on GAB log server.
  const recordAdreportMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'adreport', callback, additionalParams);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command !== 'recordGeneralMessage' || !message.msg) {
      return;
    }
    recordGeneralMessage(message.msg, undefined, message.additionalParams);
    sendResponse({});
  });

  return {
    recordErrorMessage,
    recordAnonymousMessage,
    postFilterStatsToLogServer,
    recordStatusMessage,
    recordGeneralMessage,
    recordAdreportMessage,
  };
}());

exports.ServerMessages = ServerMessages;
