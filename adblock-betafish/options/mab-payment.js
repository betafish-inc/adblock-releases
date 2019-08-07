'use strict';

let MABPayment = (function(){
  const updateWidthOnWindowResize = function(iframeData) {
    $(window).resize(function(){
      if (window.innerWidth < 825) {
        $(`#payment-iframe-${ iframeData.page }`).width(iframeData.widthThin);
        $(`#myadblock_wizard_frame_${ iframeData.page }`).width(iframeData.widthThin);
        $(`#payment-iframe-error-${ iframeData.page }`).width(iframeData.widthThin);
      } else {
        $(`#payment-iframe-${ iframeData.page }`).width(iframeData.width);
        $(`#myadblock_wizard_frame_${ iframeData.page }`).width(iframeData.width);
        $(`#payment-iframe-error-${ iframeData.page }`).width(iframeData.width);
      }
    });
  };

  const checkUrlAccesibility = function(iframeData) {
    if (License && License.isActiveLicense()) {
      return;
    }
    $.ajax({
      type: 'HEAD',
      url: iframeData.url,
      success: function() {
        $(`#payment-iframe-${ iframeData.page }`).show();
        showEnrollmentIframe(iframeData);
        $(`#payment-iframe-${ iframeData.page }`).addClass('slide-in');
        $(`#${ iframeData.page }-page .option-page-content`).addClass('center-if-iframe');
      },
      error: function() {
        $(`#payment-iframe-${ iframeData.page }`).hide();
        $(`#payment-iframe-error-${ iframeData.page }`).show();
        $(`#payment-iframe-error-${ iframeData.page }`).addClass('slide-in');
        $(`#${ iframeData.page }-page .option-page-content`).addClass('center-if-iframe');
      }
    });
  };

  const showEnrollmentIframe = function(iframeData) {
    const enrolledContent = document.getElementById(`payment-iframe-${ iframeData.page }`);
    const iframe = document.createElement('iframe');
    iframe.id = iframeData.id;
    iframe.width = window.innerWidth > 825 ? iframeData.width : iframeData.widthThin;
    iframe.height = iframeData.height;
    iframe.style.minHeight = iframeData.minHeight;
    iframe.style.border = iframeData.border;
    iframe.src = iframeData.url;

    // Append iframe only if it doesn't already exist
    if (enrolledContent && $(`#myadblock_wizard_frame_${ iframeData.page }`).length == 0) {
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

  return {
    initialize: function(page) {
      // the 'rand' query string parameter is added make the Frame URL unique,
      // to prevent the browser from caching the iframe, and it's contents
      const currentTheme = $('body').attr('id') || 'default_theme';
      let urlQueries = `?rand='${ (+ new Date()) }&theme=${ currentTheme }`;
      if (!License.isProd) {
        urlQueries += '&testmode=true';
      }
      const iframeUrl = 'https://getadblock.com/myadblock/enrollment/v3/';

      return {
        page: page,
        url: `${ iframeUrl }${ urlQueries }`,
        id: `myadblock_wizard_frame_${ page }`,
        width: '336px',
        widthThin: '264px',
        height: '100%',
        minHeight: '780px',
        border: 'solid 0px',
      }
    },
    freeUserLogic: function(iframeData) {
      checkUrlAccesibility(iframeData);
      updateWidthOnWindowResize(iframeData);
    },
    paidUserLogic: function(iframeData) {
      $(`#payment-iframe-${iframeData.page}`).hide();
      $('.option-page-content.center-if-iframe').removeClass('center-if-iframe');
      $('.mab-feature.locked').removeClass('locked').addClass('hover-shadow');
      $('.theme-wrapper.locked').removeClass('locked');
    }
  };
})();

