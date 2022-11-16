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
/* global browser, log, openTab, License,
 */

import { showIconBadgeCTA, NEW_BADGE_REASONS } from './alias/icon';


const CtaABManager = (function get() {
  let ctaData = {
    enrollment: false,
  };
  const ctaDataStorageKey = 'ctaData';
  // Load the CTA A/B data from persistent storage
  // Should only be called during startup / initialization
  browser.storage.local.get(ctaDataStorageKey).then((response) => {
    if (response[ctaDataStorageKey]) {
      ctaData = response[ctaDataStorageKey];
    }
  });

  // Check the response from a ping to see if it contains valid CTA A/B instructions.
  // If so, return an object containing data about the CTA A/B data.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  const dataFrom = function (responseData) {
    if (!responseData || responseData.length === 0 || responseData.trim().length === 0) {
      return null;
    }
    let pingData = {};
    try {
      pingData = JSON.parse(responseData);
      if (!pingData) {
        return null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Something went wrong with parsing data.');
      // eslint-disable-next-line no-console
      console.log('error', e);
      // eslint-disable-next-line no-console
      console.log('response data', responseData);
      return null;
    }
    return pingData;
  };

  return {
    get() {
      return ctaData;
    },
    isEnrolled() {
      return (ctaData.enrollment === true);
    },
    getVar() {
      return ctaData.var;
    },
    getExp() {
      return ctaData.exp;
    },
    maybeCtaAB(responseData) {
      if (!License.shouldShowPremiumCTA()) {
        return;
      }
      const pingData = dataFrom(responseData);
      if (!pingData) {
        return;
      }
      ctaData.enrollment = true;
      ctaData.var = pingData.var;
      ctaData.exp = pingData.exp;
      browser.storage.local.set({ ctaData });
      showIconBadgeCTA(true, NEW_BADGE_REASONS.VPN_CTA);
    }, // end of maybeCtaAB
    types() {
      // 'C' = A/B Test of CTAs
      return 'C';
    },
  };
}());

export default CtaABManager;
