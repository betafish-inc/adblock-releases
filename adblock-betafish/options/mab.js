'use strict';

(function(){
  const init = function() {
    // the 'rand' query string parameter is added make the Frame URL unique,
    // to prevent the browser from caching the iframe, and it's contents
    const currentTheme = $('body').attr('id') || 'default_theme';
    const urlQueries = `?rand='${ (+ new Date()) }&theme=${ currentTheme }`;
    const iframeUrl = 'https://getadblock.com/myadblock/enrollment/v3/';

    return {
      url: `${ iframeUrl }${ urlQueries }`,
      id: 'myadblock_wizard_frame',
      width: '336px',
      widthThin: '264px',
      height: '100%',
      border: 'solid 0px',
    }
  }
  const freeUserLogic = function(iframeData) {
    const updateWidthOnWindowResize = function() {
      $(window).resize(function(){
        if (window.innerWidth < 825) {
          $('#payment-iframe').width(iframeData.widthThin);
          $('#myadblock_wizard_frame').width(iframeData.widthThin);
          $('#payment-iframe-error').width(iframeData.widthThin);
        } else {
          $('#payment-iframe').width(iframeData.width);
          $('#myadblock_wizard_frame').width(iframeData.width);
          $('#payment-iframe-error').width(iframeData.width);
        }
      });
    };

    const checkUrlAccesibility = function() {
      if (License && License.isActiveLicense()) {
        return;
      }
      $.ajax({
        type: 'HEAD',
        url: iframeData.url,
        success: function() {
          $('#payment-iframe').show();
          showEnrollmentIframe(iframeData.url);
        },
        error: function() {
          $('#payment-iframe').hide();
          $('#payment-iframe-error').show();
        }
      });
    };

    const showEnrollmentIframe = function() {
      const enrolledContent = document.getElementById('payment-iframe');
      const iframe = document.createElement('iframe');
      iframe.id = iframeData.id;
      iframe.width = window.innerWidth > 825 ? iframeData.width : iframeData.widthThin;
      iframe.height = iframeData.height;
      iframe.style.border = iframeData.border;
      iframe.src = iframeData.url;

      // Append iframe only if it doesn't already exist
      if (enrolledContent && $('#myadblock_wizard_frame').length == 0) {
        enrolledContent.appendChild(iframe);
        window.addEventListener("message", receiveMessage, false);
      }

      function receiveMessage(event)
      {
        if (event.origin !== parseUri(iframeData.url).origin) {
          return;
        }
        if (event.data && event.data.command === "resize" && event.data.height && event.data.width) {
          $(enrolledContent).animate({ "width" : event.data.width + "px", "height" : event.data.height + "px" }, 400, "linear");
        }
        if (event.data && event.data.command === "openPage" && event.data.url && event.data.url.startsWith('http')) {
          chrome.tabs.create({ url:event.data.url });
        }
        if (event.data && event.data.command === "close") {
          enrolledContent.removeChild(iframe);
        }
      }
    };
    checkUrlAccesibility();
    updateWidthOnWindowResize();
  }
  const paidUserLogic = function() {
    $('#payment-iframe').hide();
    $('.option-page-content.center-if-iframe').removeClass('center-if-iframe');
    $('.mab-feature.locked').removeClass('locked').addClass('hover-shadow');
    $('.mab-feature a').click(function() {
      activateTab($(this).attr('href'));
    });
  }

  $(document).ready(function () {
    const iframeData = init();
    localizePage();

    if (!License || $.isEmptyObject(License)) {
      return;
    } else if (License.shouldShowMyAdBlockEnrollment()) {
      $('#payment-iframe').show();
      freeUserLogic(iframeData);
    } else if (License.isActiveLicense()) {
      paidUserLogic();
    }
  });
})();