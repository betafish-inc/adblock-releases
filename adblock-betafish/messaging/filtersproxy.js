
/* For ESLint: List any global identifiers used in this file below */
/* global browser, port, ListenerSupport, sendTypeMessage, send */

/**
 * Act as Proxy to the ewe.filters.* APIs
 *
 */
class FiltersProxy {
  static add = (text, origin) => send('filters.add', { text, origin });

  static remove = filters => send('filters.remove', { filters });

  static validate = text => send('filters.validate', { text });

  static getUserFilters = () => sendTypeMessage('filters.get');

  static onAdded = new ListenerSupport();

  static onChanged = new ListenerSupport();

  static onRemoved = new ListenerSupport();
}

/* eslint-disable-next-line no-unused-vars */
async function initializeFiltersProxy() {
  const processMessage = (message) => {
    if (message && message.type === 'filters.respond' && message.action) {
      switch (message.action) {
        case 'added':
          FiltersProxy.onAdded.emit(message.args);
          break;
        case 'changed':
          FiltersProxy.onChanged.emit(message.args);
          break;
        case 'removed':
          FiltersProxy.onRemoved.emit(message.args);
          break;
        default:
          break;
      }
    }
  };

  const port = browser.runtime.connect({ name: 'ui' });
  port.onMessage.addListener(processMessage);

  port.postMessage({
    type: 'filters.listen',
    filter: ['added', 'changed', 'removed'],
  });
}
