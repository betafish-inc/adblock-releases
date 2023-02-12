/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global browser, TELEMETRY,  */

import { log, determineUserLanguage } from './utilities/background/bg-functions';

// Log an 'error' message on GAB log server.
const ServerMessages = (function serverMessages() {
  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const sendMessageToLogServer = function (payload, callback) {
    fetch('https://log.getadblock.com/v2/record_log.php', {
      method: 'POST',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(() => {
        if (typeof callback === 'function') {
          callback();
        }
      })
      .catch((error) => {
        log('message server returned error: ', error);
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
      u: TELEMETRY.userId(),
      f: TELEMETRY.flavor,
      o: TELEMETRY.os,
      l: determineUserLanguage(),
      t: queryType,
      v: browser.runtime.getManifest().version,
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
      f: TELEMETRY.flavor,
      o: TELEMETRY.os,
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

  // Log a error message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  const recordAnonymousErrorMessage = function (msg, callback, additionalParams) {
    if (!msg) {
      return;
    }
    const payload = {
      f: TELEMETRY.flavor,
      o: TELEMETRY.os,
      l: determineUserLanguage(),
      t: 'error',
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

  // Send an error message to the backup log server. This is to be used when
  // there's fetch failure.  It may fail as well depending on the failure,
  // and state of the local computer & network
  const sendMessageToBackupLogServer = function (msg, errorMsg, queryType = 'error') {
    const payload = {
      u: TELEMETRY.userId(),
      f: TELEMETRY.flavor,
      o: TELEMETRY.os,
      l: determineUserLanguage(),
      t: queryType,
      v: browser.runtime.getManifest().version,
      error: errorMsg,
    };
    const eventWithPayload = { event: msg, payload };
    fetch('https://192.241.161.10/v2/record_log.php', {
      method: 'POST',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventWithPayload),
    });
  };

  return {
    recordErrorMessage,
    recordAnonymousMessage,
    recordAnonymousErrorMessage,
    recordStatusMessage,
    recordGeneralMessage,
    recordAdreportMessage,
    sendMessageToBackupLogServer,
  };
}());

export default ServerMessages;
