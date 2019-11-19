'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, License, parseUri */

// MABPayment can be used in all the Options page tabs and should be used to display
// the CTA to pay for MyAdBlock. Currently used only in mab.js and themes.js
const MABPayment = (function mabPayment() {
  return {
    // Called to generate the correct info necessary to display/hide/use the CTA in the template
    // Input:
    // page:string - name of script of origin and should match the suffix in the CTA ids
    initialize(page) {
      return {
        id: `locked-user-pay-section-${page}`,
        linkId: `get-it-now-${page}`,
        url: License.MAB_CONFIG.payURL,
      };
    },
    // Called if the user hasn't paid and MAB is locked
    // Input:
    // payInfo:object - the object returned by initialize()
    freeUserLogic(payInfo) {
      const $paySection = $(`#${payInfo.id}`);
      const $payLink = $(`#${payInfo.linkId}`);
      $payLink.attr('href', payInfo.url);
      $paySection.slideDown();
    },
    // Called if the user is active and MAB is unlocked
    // Input:
    // payInfo:object - the object returned by initialize()
    paidUserLogic(payInfo) {
      const $paySection = $(`#${payInfo.id}`);
      $paySection.hide();
      $('.mab-feature.locked').removeClass('locked').addClass('hover-shadow');
      $('.theme-wrapper.locked').removeClass('locked');
      $('.overlay-icon').text('check');
    },
  };
}());
