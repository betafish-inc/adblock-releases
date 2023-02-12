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
/* global License, MABPayment, localizePage, activateTab, translate,
   initializeProxies, settings */

$(async () => {
  await initializeProxies();
  localizePage();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }

  const payInfo = MABPayment.initialize('mab');
  const $pageTitle = $('#premium-tab-header > span > span.page-title');
  let manageSubscriptionURL = License.MAB_CONFIG.subscriptionURL;

  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
    $('#get-it-now-mab').on('click', MABPayment.userClickedPremiumCTA);
    $pageTitle.text(translate('premium_page_title'));
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
    $pageTitle.text(translate('premium'));
    if (License.getFormattedActiveSinceDate()) {
      $('#premium_status_msg').text(translate('premium_status_msg', License.getFormattedActiveSinceDate()));
    } else {
      $('#premium_status_msg').text(translate('premium_status_short_msg'));
    }
    $('.status_msg').css('display', 'inline-flex');

    if (License.isLicenseCodeValid() && License.code) {
      manageSubscriptionURL = `${manageSubscriptionURL}?lic=${License.code}`;
      $('a#manage-subscription').attr('href', manageSubscriptionURL).show();
    }
  }

  $('.mab-feature:not(.locked) a').on('click', function goToTab() {
    activateTab($(this).attr('href'));
  });

  if (settings) {
    const optionsTheme = settings.color_themes.options_page;
    if (optionsTheme === 'dark_theme') {
      $('#themes-preview').attr('src', 'icons/themes_lighttext.svg');
    } else {
      $('#themes-preview').attr('src', 'icons/themes_darktext.svg');
    }
  }
});
