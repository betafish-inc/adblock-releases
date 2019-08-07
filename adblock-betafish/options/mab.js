// showEnrollmentBox if the user needs to enroll another extension in MAB.
function showEnrollmentBox() {

  // Determine whether the box should be shown
  let settings = backgroundPage.getSettings();
  let licenseCodeIsEmpty = true;
  if (License && typeof License.get === 'function') {
    let currentLicense = License.get();
    if (currentLicense && currentLicense.code && currentLicense.code !== 'unknown') {
      licenseCodeIsEmpty = false;
    }
  }
  if ((!settings || settings.mab_enrollment_user_hidden !== true) && licenseCodeIsEmpty !== true) {
    let $enrollmentSection = $('#mab-enrollment-section');
    $enrollmentSection.show();

    // Handle user closing the enrollment box via close icon in upper right corner.
    $('#mab-enrollment-close').click(() => {
      if ($('#mab-enrollment-hide-forever').is(':checked')) {
        // User selected to hide the enrollment, we save it so it sync's across extensionn
        backgroundPage.setSetting('mab_enrollment_user_hidden', true);
      }
      $enrollmentSection.hide();
    });

    let $enrollmentResendButton = $('#mab-enrollment-resend');
    let $enrollmentResendProgress = $('#mab-enrollment-progress');
    let $enrollmentPrompt = $('#mab-enrollment-success');
    let $enrollmentResendSuccess = $('#mab-enrollment-resend-success');
    let $enrollmentResendSuccessIcon = $('#mab-enrollment-resend-success-icon');
    let $enrollmentResendError = $('#mab-enrollment-resend-error');
    let $enrollmentResendErrorIcon = $('#mab-enrollment-resend-error-icon');
    let showNext = () => {
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
        // show the success message with the email pushed into the message. For some reason, jQuery is
        // not updating the content so use the DOM.
        let enrollmentResendSuccess = document.getElementById('mab-enrollment-resend-success-email');
        enrollmentResendSuccess.textContent = translate('myadblock_enrollment_resend_success',[email]);

        showNext();
        $enrollmentResendSuccess.show();
        $enrollmentResendSuccessIcon.show();
        $enrollmentResendError.hide();
        $enrollmentResendErrorIcon.hide();
      }, (err) => {
        // we may want to push some of the error information up to the user if we have weird issues
        // but for now we just generically say they have an error without any additional details.
        showNext();
        $enrollmentResendSuccess.hide();
        $enrollmentResendSuccessIcon.hide();
        $enrollmentResendError.show();
        $enrollmentResendErrorIcon.show();
      });
    })
  }
}

$(document).ready( function () {
  localizePage();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }

  const iframeData = MABPayment.initialize("mab");
  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(iframeData);
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(iframeData);
    showEnrollmentBox();
  }

  $('.mab-feature:not(.locked) a').click(function() {
    activateTab($(this).attr('href'));
  });
});
