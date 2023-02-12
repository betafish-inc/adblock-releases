/* For ESLint: List any global identifiers used in this file below */
/* global EventEmitter, send, browser, sendTypeMessage,
*/

/**
 * Act as Proxy to the Prefs module.
 * - emit events related to Prefs
 * - the current state of the cache Prefs should match the values in storage
 *
 */
const prefsNotifier = new EventEmitter();
const localprefs = {};
/* eslint-disable-next-line no-unused-vars */
let Prefs = {};
let abpPrefPropertyNames = {};

/* eslint-disable-next-line no-unused-vars */
async function initializePrefs() {
  abpPrefPropertyNames = await send('getABPPrefPropertyNames');
  abpPrefPropertyNames.forEach(async (key) => {
    localprefs[key] = await sendTypeMessage('prefs.get', { key });
  });

  Prefs = new Proxy(localprefs, {
    get(obj, prop) {
      return obj[prop];
    },
    set(objParm, prop, value) {
      const obj = objParm;
      obj[prop] = value;
      return sendTypeMessage('prefs.set', { key: prop, value });
    },
  });

  const prefsPort = browser.runtime.connect({ name: 'ui' });
  prefsPort.onMessage.addListener((message) => {
    if (message.type === 'prefs.respond') {
      const key = message.action;
      const value = message.args[0];
      localprefs[key] = value;
      prefsNotifier.emit('prefs.changed', key, value);
    }
  });

  prefsPort.postMessage({
    type: 'prefs.listen',
    filter: abpPrefPropertyNames,
  });
}
