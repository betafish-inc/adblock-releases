/* For ESLint: List any global identifiers used in this file below */
/* global EventEmitter, browser, send,
*/

/**
 * Act as Proxy to the Settings module
 *
 */
const settingsNotifier = new EventEmitter();
let localsettings = {};
/* eslint-disable-next-line no-unused-vars */
let settings = {};
/* eslint-disable-next-line no-unused-vars */
const isValidTheme = async name => send('isValidTheme', { name });

/* eslint-disable-next-line no-unused-vars */
async function initializeSettings() {
  localsettings = await send('getSettings');
  settings = new Proxy(localsettings, {
    get(obj, prop) {
      return obj[prop];
    },
    set(objParm, prop, value) {
      const obj = objParm;
      obj[prop] = value;
      return send('setSetting', { name: prop, isEnabled: value });
    },
  });
}

const settingsPort = browser.runtime.connect({ name: 'settings' });
settingsPort.onMessage.addListener((message) => {
  if (message.action === 'changed' && message.args && message.args.length > 2) {
    const [key, value] = message.args;
    localsettings[key] = value;
    settingsNotifier.emit('settings.changed', ...message.args);
  }
});

settingsPort.postMessage({
  type: 'settings.listen',
  filter: ['changed'],
});
