'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, STATS, getUILanguage, getSubscriptionsMinusText */

const sendDCReport = function (url, type, id) {
  if (!url || !type) {
    return;
  }
  const reportData = {
    url,
    type,
    platform: STATS && `browser:${STATS.browser}, browser version:${STATS.browserVersion}, OS:${STATS.os}, OS version:${STATS.osVersion}`,
    locale: getUILanguage(),
    version: browser.runtime.getManifest().version,
  };
  if (id) {
    const subs = getSubscriptionsMinusText();
    if (subs && subs[id]) {
      const lastUpdate = subs[id].lastDownload || subs[id]._lastDownload || 0;
      reportData.filterListLastUpdate = new Date(lastUpdate * 1000);
    }
  }
  $.ajax({
    url: 'https://getadblock.com/freshdesk/bugReportDistractionControl.php',
    data: {
      bug_report: JSON.stringify(reportData),
    },
    success() {
      // Do nothing
    },
    error(e) {
      // eslint-disable-next-line no-console
      console.log('error: ', e.status);
    },
    type: 'POST',
  });
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'sendDCReport' || !message.url || !message.type) {
    return;
  }
  sendDCReport(message.url, message.type, message.id);
  sendResponse({});
});
