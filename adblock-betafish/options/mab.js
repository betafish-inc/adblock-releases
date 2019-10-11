'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, translate, License, MABPayment, localizePage, activateTab */

// showEnrollmentBox if the user needs to enroll another extension in MAB.
function showEnrollmentBox() {
  // Determine whether the box should be shown
  const settings = backgroundPage.getSettings();
  let licenseCodeIsEmpty = true;
  if (License && typeof License.get === 'function') {
    const currentLicense = License.get();
    if (currentLicense && currentLicense.code && currentLicense.code !== 'unknown') {
      licenseCodeIsEmpty = false;
    }
  }
  if ((!settings || settings.mab_enrollment_user_hidden !== true) && licenseCodeIsEmpty !== true) {
    const $enrollmentSection = $('#mab-enrollment-section');
    $enrollmentSection.show();

    // Handle user closing the enrollment box via close icon in upper right corner.
    $('#mab-enrollment-close').click(() => {
      if ($('#mab-enrollment-hide-forever').is(':checked')) {
        // User selected to hide the enrollment, we save it so it sync's across extensionn
        backgroundPage.setSetting('mab_enrollment_user_hidden', true);
      }
      $enrollmentSection.hide();
    });

    const $enrollmentResendButton = $('#mab-enrollment-resend');
    const $enrollmentResendProgress = $('#mab-enrollment-progress');
    const $enrollmentPrompt = $('#mab-enrollment-success');
    const $enrollmentResendSuccess = $('#mab-enrollment-resend-success');
    const $enrollmentResendSuccessIcon = $('#mab-enrollment-resend-success-icon');
    const $enrollmentResendError = $('#mab-enrollment-resend-error');
    const $enrollmentResendErrorIcon = $('#mab-enrollment-resend-error-icon');
    const showNext = () => {
      $enrollmentPrompt.hide();
      $enrollmentResendButton.show();
      $enrollmentResendProgress.hide();
    };
    $enrollmentResendButton.click((ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();

      // Show progress and then send to the API endpoint
      $enrollmentResendButton.hide();
      $enrollmentResendProgress.show();

      License.resendEmail((email) => {
        // show the success message with the email pushed into the message. For some reason,
        // jQuery is not updating the content so use the DOM.
        const enrollmentResendSuccess = document.getElementById('mab-enrollment-resend-success-email');
        enrollmentResendSuccess.textContent = translate('myadblock_enrollment_resend_success', [email]);

        showNext();
        $enrollmentResendSuccess.show();
        $enrollmentResendSuccessIcon.show();
        $enrollmentResendError.hide();
        $enrollmentResendErrorIcon.hide();
      }, () => {
        // we may want to push some of the error information up to the user if we have weird issues
        // but for now we just generically say they have an error without any additional details.
        showNext();
        $enrollmentResendSuccess.hide();
        $enrollmentResendSuccessIcon.hide();
        $enrollmentResendError.show();
        $enrollmentResendErrorIcon.show();
      });
    });
  }
}

$(document).ready(() => {
  localizePage();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }

  const payInfo = MABPayment.initialize('mab');
  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
    showEnrollmentBox();
  }

  $('.mab-feature:not(.locked) a').click(function goToTab() {
    activateTab($(this).attr('href'));
  });
});
