/* For ESLint: List any global identifiers used in this file below */
/* global  browser, send
*/

/**
 * Act as Proxy to the SubscriptionAdapter module
 *
 */
/* eslint-disable-next-line no-unused-vars */
class SubscriptionAdapter {
  static getIdFromURL = url => send('getIdFromURL', { url });

  static getAllSubscriptionsMinusText = () => send('getAllSubscriptionsMinusText');

  static isLanguageSpecific = adblockId => send('isLanguageSpecific', { adblockId });

  static getSubscriptionsMinusText = () => send('getSubscriptionsMinusText');
}
