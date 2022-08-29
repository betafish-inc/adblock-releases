

/* For ESLint: List any global identifiers used in this file below */
/* global browser */

import { TELEMETRY } from '../telemetry';
import SubscriptionAdapter from '../subscriptionadapter';

const sendDCReport = function (url, type, id) {
  if (!url || !type) {
    return;
  }
  const reportData = {
    url,
    type,
    platform: TELEMETRY && `browser:${TELEMETRY.browser}, browser version:${TELEMETRY.browserVersion}, OS:${TELEMETRY.os}, OS version:${TELEMETRY.osVersion}`,
    locale: browser.i18n.getUILanguage(),
    version: browser.runtime.getManifest().version,
  };
  if (id) {
    const subs = SubscriptionAdapter.getSubscriptionsMinusText();
    if (subs && subs[id]) {
      const lastUpdate = subs[id].lastDownload || 0;
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
