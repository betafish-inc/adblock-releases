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
/* global browser  */

/*
    This content script, when injected into tab, will
    wrap the Notification.requestPermission function, so that it will
    return a 'denied' permission if the user hadn't previously granted
    permission.
*/

// the following code will be injected into the Twitch JS page context.
if (typeof denyNotificationsRequests !== 'function') {
  const denyNotificationsRequests = function () {
    window.Notification.requestPermission = function theFN() {
      // When a website checks for the permission, deny it if not granted
      // and allow it if it's already allowed
      return new Promise((resolve) => {
        resolve(window.Notification.permission === 'granted' ? 'granted' : 'denied');
      });
    };
  }; // end of denyNotificationsRequests() - injected into the page context

  const injectDenyNotificationsWrapper = function () {
    const scriptToInject = `(${denyNotificationsRequests.toString()})();`;
    const script = document.createElement('script');
    script.type = 'application/javascript';
    script.async = false;
    script.textContent = scriptToInject;
    try {
      document.documentElement.appendChild(script);
      document.documentElement.removeChild(script);
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.log(ex);
    }
  };
  injectDenyNotificationsWrapper();
}
