'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, exports, STATS, log, getSettings, Prefs,
   License, settings,
 */

const { showIconBadgeCTA, NEW_BADGE_REASONS } = require('./alias/icon.js');


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

exports.CtaABManager = CtaABManager;
