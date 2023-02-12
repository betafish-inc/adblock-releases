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
/* global License, parseUri, ServerMessages, storageSet, storageGet, getFormattedTabName */

// MABPayment can be used in all the Options page tabs and should be used to display
// the CTAs to pay for Premium.

let userClosedSyncCTA;
let userSawSyncCTA;
let pageReloadedOnSettingChange;

/* eslint-disable-next-line no-unused-vars */
function initializeMABPayment() {
  userClosedSyncCTA = storageGet(License.userClosedSyncCTAKey);
  userSawSyncCTA = storageGet(License.userSawSyncCTAKey);
  pageReloadedOnSettingChange = storageGet(License.pageReloadedOnSettingChangeKey);
}

/* eslint-disable-next-line no-unused-vars */
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
    // Returns:object - the object with functions handling the logic for Sync CTAs
    freeUserLogic(payInfo) {
      const $paySection = $(`#${payInfo.id}`);
      const $payLink = $(`#${payInfo.linkId}`);
      $payLink.attr('href', payInfo.url);
      $paySection.slideDown();
    },
    // Called if the user is active and Premium is unlocked
    // Input:
    // payInfo:object - the object returned by initialize()
    paidUserLogic(payInfo) {
      const $paySection = $(`#${payInfo.id}`);
      $paySection.hide();
      $('.mab-feature.locked').removeClass('locked').addClass('hover-shadow');
      $('.theme-wrapper.locked').removeClass('locked');
      $('.overlay-icon').text('check');
    },
    // When the Options page loads we show the Sync CTAs on the General,
    // Filter Lists and Customize tabs only in the following conditions:
    //   - Free users see the CTA on page load only on their first Options page visit
    //   - Free users never see a Sync CTA after dismissing one by clicking on the close button
    //   - Free users see the CTA again only if they changed settings and never closed the CTA
    //   - Paid users should never see the CTA
    // Input:
    //  settingChanged:bool|undefined - true if user just changed a setting
    displaySyncCTAs: (settingChanged) => {
      const userChangedSettings = settingChanged || pageReloadedOnSettingChange;
      const alreadyShowingCTAs = $('.sync-cta:visible').length;
      if (!License || !License.shouldShowMyAdBlockEnrollment() || userClosedSyncCTA) {
        return;
      }
      if (!alreadyShowingCTAs && (userChangedSettings || !userSawSyncCTA)) {
        $('.sync-cta').fadeIn(1000);
        ServerMessages.recordGeneralMessage('options_page_sync_cta_seen');
      }
    },
    userClosedSyncCTA: () => {
      const $syncCTAs = $('.sync-cta');
      const $getSyncCTAs = $('.get-sync-cta');
      const $goodbyeSyncCTAs = $('.goodbye-sync-cta');
      $getSyncCTAs.fadeOut(1000, () => {
        $goodbyeSyncCTAs.fadeIn(1000, () => {
          setTimeout(() => {
            $goodbyeSyncCTAs.fadeOut(1000, () => {
              $syncCTAs.slideUp();
            });
          }, 10000);
        });
      });
      storageSet(License.userClosedSyncCTAKey, true);
      ServerMessages.recordGeneralMessage('options_page_sync_cta_closed');
    },
    userClickedSyncCTA: () => {
      ServerMessages.recordGeneralMessage('options_page_sync_cta_clicked');
    },
    userClickedPremiumCTA: () => {
      ServerMessages.recordGeneralMessage(`options_page_premium_cta_clicked_${getFormattedTabName()}`);
    },
  };
}());
