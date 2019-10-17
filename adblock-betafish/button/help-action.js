'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global BG, page, transitionTo, logHelpFlowResults, filterUpdateError:true,
  chrome */

// Help flow button actions -- called when the associated buttons are clicked
const popupMenuHelpActionMap = {
  // Checks if the page is whitelisted. If the page isn't whitelisted,
  // updates filter lists and checks for update errors
  // Disables button while updating the filter lists and reenables it
  // when updating is complete or after 6 seconds
  okCheckWhitelistAction() {
    if (BG.pageIsWhitelisted({ page })) {
      transitionTo('seeAdOnWhitelist', false);
    } else {
      transitionTo('seeAdNotOnWhitelist', false);
      $('button').prop('disabled', true);
      BG.updateFilterLists();
      setTimeout(() => {
        const progress = BG.checkUpdateProgress();
        if (progress.inProgress) {
          setTimeout(() => {
            const progress2 = BG.checkUpdateProgress();
            if (progress2.inProgress || progress2.filterError) {
              filterUpdateError = true;
            }
            $('button').prop('disabled', false);
          }, 5000); // wait five seconds and check again
        } else {
          $('button').prop('disabled', false);
        }
        if (progress.filterError && !progress.inProgress) {
          filterUpdateError = true;
        }
      }, 1000); // wait one second and check
    }
  },
  dontRemoveWhitelistAction() {
    transitionTo('dontRemoveWhitelist', false);
  },
  removeWhitelistAction() {
    BG.tryToUnwhitelist(page.url.href);
    transitionTo('removeWhitelist', false);
  },
  finishFlowAction() {
    logHelpFlowResults('finishFlow');
    window.close();
  },
  reloadFinishFlowAction() {
    chrome.tabs.reload();
    logHelpFlowResults('reloadFinishFlow');
    window.close();
  },
  reloadCheckAction() {
    chrome.tabs.reload();
    transitionTo('checkedBasics', false);
  },
  stillSeeAdAction() {
    if (filterUpdateError) {
      transitionTo('seeAdFilterError', false);
    } else {
      transitionTo('seeAdFiltersGood', false);
    }
  },
  problemSolvedAction() {
    transitionTo('problemSolved', false);
  },
  seeAdEnglishSiteAction() {
    transitionTo('seeAdEnglishSite', false);
  },
  seeAdNotEnglishSiteAction() {
    transitionTo('seeAdNotEnglishSite', false);
  },
  // Unpauses and reloads the page
  unpauseAndReloadAction() {
    BG.adblockIsPaused(false);
    chrome.tabs.reload();
    transitionTo('unpauseAndReload', false);
  },
  dontChangeSeeAdsAction() {
    transitionTo('dontChangeSeeAds', false);
  },
  seeAdsUnpausedAction() {
    transitionTo('seeAdFiltersGood', false);
  },
  // Pauses and reloads the page
  reloadStillBrokenAction() {
    BG.adblockIsPaused(true);
    chrome.tabs.reload();
    transitionTo('reloadStillBroken', false);
  },
  stillBrokenNotAdBlockAction() {
    transitionTo('stillBrokenNotAdBlock', false);
  },
  stillBrokenAdBlockAction() {
    transitionTo('stillBrokenAdBlock', false);
  },
};
