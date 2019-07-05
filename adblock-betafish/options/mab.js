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
  }

  $('.mab-feature:not(.locked) a').click(function() {
    activateTab($(this).attr('href'));
  });
});