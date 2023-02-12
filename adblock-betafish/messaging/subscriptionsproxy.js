
/* For ESLint: List any global identifiers used in this file below */
/* global browser, port, ListenerSupport, send, sendTypeMessage */

/**
 * Act as Proxy to the ewe.subscriptions.* APIs
 *
 */
class SubscriptionsProxy {
  static add = (url, properties = {}) => sendTypeMessage('subscriptions.add', { url, properties });

  static getDownloadable = () => sendTypeMessage('subscriptions.get');

  static sync = url => sendTypeMessage('subscriptions.sync', { url });

  static remove = url => sendTypeMessage('subscriptions.remove', { url });

  static has = url => send('subscriptions.has', { url });

  static onAdded = new ListenerSupport();

  static onChanged = new ListenerSupport();

  static onRemoved = new ListenerSupport();
}
/* eslint-disable-next-line no-unused-vars */
async function initializeSubscriptionsProxy() {
  SubscriptionsProxy.ACCEPTABLE_ADS_URL = await sendTypeMessage('app.get', { what: 'acceptableAdsUrl' });
  SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL = await sendTypeMessage('app.get', { what: 'acceptableAdsPrivacyUrl' });

  const processMessage = (message) => {
    if (message && message.type === 'subscriptions.respond' && message.action) {
      switch (message.action) {
        case 'added':
          SubscriptionsProxy.onAdded.emit(message.args);
          break;
        case 'changed':
          SubscriptionsProxy.onChanged.emit(message.args);
          break;
        case 'removed':
          SubscriptionsProxy.onRemoved.emit(message.args);
          break;
        default:
          break;
      }
    }
  };

  const port = browser.runtime.connect({ name: 'ui' });
  port.onMessage.addListener(processMessage);

  port.postMessage({
    type: 'subscriptions.listen',
    filter: ['added', 'changed', 'removed'],
  });
}
