

/* For ESLint: List any global identifiers used in this file below */
/* global browser, log,  */

// If the computer is currently active, then schedules a function to be executed
// once when the computer is idle or locked
// If the computer is currently idle or locked, the function will be run immediately
//
// inputs: theFunction: function to be executed
//         seconds: maximum time to wait upon idle, in seconds. 600 if omitted.
const idleHandler = {
  IDLE_ALARM_NAME: 'idlehandleralarm',
  alarmHandler(alarm) {
    if (alarm && alarm.name === idleHandler.IDLE_ALARM_NAME) {
      idleHandler.runIfIdle();
    }
  },
  async scheduleItemOnce(callback, seconds) {
    // Schedule the item to be executed
    const state = await browser.idle.queryState(60);
    if (state === 'active') {
      idleHandler.scheduledItems.push({
        callback,
        runAt: new Date(Date.now() + 1000 * (seconds || 600)),
      });
      browser.alarms.onAlarm.removeListener(idleHandler.alarmHandler);
      browser.alarms.onAlarm.addListener(idleHandler.alarmHandler);
      browser.alarms.clear(idleHandler.IDLE_ALARM_NAME);
      browser.alarms.create(idleHandler.IDLE_ALARM_NAME, { periodInMinutes: 1 });
    } else {
      callback();
    }
  },
  scheduledItems: [],
  async runIfIdle() {
    // Checks if the browser is not active (either idle or locked).
    // If so, it executes all waiting functions
    // Otherwise, it checks if an item has waited longer than allowed, and
    // executes the ones who should be executed
    const state = await browser.idle.queryState(15);
    if (state === 'idle') {
      while (idleHandler.scheduledItems.length) {
        idleHandler.scheduledItems.shift().callback();
      }
    } else {
      const now = Date.now();
      // Inversed loop, to prevent splice() making it skip the item after an
      // executed item.
      for (let i = idleHandler.scheduledItems.length - 1; i >= 0; i--) {
        if (idleHandler.scheduledItems[i].runAt <= now) {
          idleHandler.scheduledItems.splice(i, 1)[0].callback();
        }
      }
    }
    if (!idleHandler.scheduledItems.length) {
      browser.idle.onStateChanged.removeListener(idleHandler.runIfIdle);
      browser.alarms.onAlarm.removeListener(idleHandler.alarmHandler);
      browser.alarms.clear(idleHandler.IDLE_ALARM_NAME);
    }
  },
};

export default idleHandler;
