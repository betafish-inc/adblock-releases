'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global License, MABPayment, localizePage, activateTab, translate */

$(document).ready(() => {
  localizePage();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }

  const payInfo = MABPayment.initialize('mab');
  const $pageTitle = $('#premium-tab-header > h1.page-title');
  let manageSubscriptionURL = License.MAB_CONFIG.subscriptionURL;

  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
    $pageTitle.text(translate('premium_page_title'));
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
    $pageTitle.text(translate('premium'));

    if (License.isLicenseCodeValid()) {
      manageSubscriptionURL = `${manageSubscriptionURL}?lic=${License.get().code}`;
    }
    $('a#manage-subscription').attr('href', manageSubscriptionURL).show();
  }

  $('.mab-feature:not(.locked) a').click(function goToTab() {
    activateTab($(this).attr('href'));
  });
});
