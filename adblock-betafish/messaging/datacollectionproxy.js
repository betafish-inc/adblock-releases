/* For ESLint: List any global identifiers used in this file below */
/* global  browser, send
*/

/**
 * Act as Proxy to the DataCollectionV2 module
 *
 */
/* eslint-disable-next-line no-unused-vars */
class DataCollectionV2 {
  static start = () => send('DataCollectionV2.start');

  static end = () => send('DataCollectionV2.end');
}
