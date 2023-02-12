/* For ESLint: List any global identifiers used in this file below */
/* global  browser, send,
*/

/**
 * Act as Proxy to the LocalDataCollection (aka 'stats') module
 *
 */
class LocalDataCollection {
  static start = () => send('LocalDataCollection.start');

  static end = () => send('LocalDataCollection.end');

  static clearCache = () => send('LocalDataCollection.clearCache');

  static saveCacheData = () => send('LocalDataCollection.saveCacheData');
}

/* eslint-disable-next-line no-unused-vars */
async function initializeLocalDataCollection() {
  LocalDataCollection.EXT_STATS_KEY = await send('LocalDataCollection.EXT_STATS_KEY');
  LocalDataCollection.easyPrivacyURL = await send('LocalDataCollection.easyPrivacyURL');
}
