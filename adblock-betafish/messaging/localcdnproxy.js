/* For ESLint: List any global identifiers used in this file below */
/* global  browser, send,
*/

/**
 * Act as Proxy to the LocalCDN module
 *
 */
/* eslint-disable-next-line no-unused-vars */
class LocalCDN {
  static start = () => send('LocalCDN.start');

  static end = () => send('LocalCDN.end');
}
