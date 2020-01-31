'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, exports, log */

// Schedules a function to be executed once when the computer is idle.
// Call idleHandler.scheduleItem to schedule a function for exection upon idle
// inputs: theFunction: function to be executed
//         seconds: maximum time to wait upon idle, in seconds. 600 if omitted.
const idleHandler = {
  scheduleItemOnce(callback, seconds) {
    // Schedule the item to be executed
    idleHandler.scheduledItems.push({
      callback,
      runAt: new Date(Date.now() + 1000 * (seconds || 600)),
    });
    if (!idleHandler.timer) {
      idleHandler.timer = window.setInterval(idleHandler.runIfIdle, 5000);
    }
  },
  timer: null,
  scheduledItems: [],
  runIfIdle() {
    // Checks if the browser is idle. If so, it executes all waiting functions
    // Otherwise, it checks if an item has waited longer than allowed, and
    // executes the ones who should be executed
    browser.idle.queryState(15, (state) => {
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
        idleHandler.timer = window.clearInterval(idleHandler.timer);
      }
    });
  },
};

exports.idleHandler = idleHandler;
