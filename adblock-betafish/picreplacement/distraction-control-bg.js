/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global browser, log */

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
  const formData = new FormData();
  formData.append('bug_report', JSON.stringify(reportData));
  fetch('https://getadblock.com/freshdesk/bugReportDistractionControl.php', {
    body: formData,
    method: 'post',
  }).catch((error) => {
    log('freshdesk returned error: ', error);
  });
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'sendDCReport' || !message.url || !message.type) {
    return;
  }
  sendDCReport(message.url, message.type, message.id);
  sendResponse({});
});
