/* For ESLint: List any global identifiers used in this file below */
/* global  browser, send
*/

/**
 * Act as Proxy to the ServerMessages module
 *
 */
/* eslint-disable-next-line no-unused-vars */
class ServerMessages {
  static recordGeneralMessage = (msg, callback, additionalParams) => {
    send('channels.getIdByName', { msg, additionalParams });
    if (typeof callback === 'function') {
      callback();
    }
  };

  static recordAnonymousErrorMessage = (msg, callback, additionalParams) => {
    send('recordAnonymousErrorMessage', { msg, additionalParams });
    if (typeof callback === 'function') {
      callback();
    }
  };
}
