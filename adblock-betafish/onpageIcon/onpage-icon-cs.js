

/* For ESLint: List any global identifiers used in this file below */
/* global browser setLangAndDirAttributes, DOMPurify */

(function onScriptLoad() {
  const divID = '_ABoverlay';
  const defaultBottomPosition = 100;
  const defaultRightPosition = 50;

  const removeIcon = function () {
    const el = document.getElementById(divID);
    if (el) {
      el.parentNode.removeChild(el);
    }
  };

  // Domains that we should adjust the position
  //   (height and / or right) of the on page icon
  // Hostname is is the key
  // selector: string - valid CSS selector used to trigger an adjustment
  // heightAdjustment: Integer (optional) - the value to add to height of the found element
  // rightAdjustment: Integer (optional) - the value of the new right position
  const problemSites = {
    'www.msn.com': {
      selector: '#onetrust-banner-sdk',
      heightAdjustment: 60,
    },
    'www.bing.com': {
      selector: '#bnp_container, #mfa_root',
      heightAdjustment: 60,
      rightAdjustment: 60,
      delay: 2500,
    },
    'www.facebook.com': {
      // the following selector 'finds' the new message icon in the lower right corner on FB
      selector: 'div[aria-label*="New message"]',
      heightAdjustment: 40,
      rightAdjustment: 30,
      delay: 10000,
    },
  };

  // Inputs:
  //   - base : the DIV element to attach the CSS as children
  //   - callback : function to call when loading is complete
  function loadIconResources(base, callback) {
    function loadCss(cssSrc) {
      const cssUrl = browser.runtime.getURL(cssSrc);
      const fontCssUrl = browser.runtime.getURL('fonts/font-face.css');
      const styleElement = document.createElement('style');
      styleElement.classList.add('adblock-ui-stylesheet');

      const cssPromise = fetch(cssUrl).then(response => response.text());
      const fontCSSPromise = fetch(fontCssUrl).then(response => response.text());
      Promise.all([cssPromise, fontCSSPromise]).then((detailsArray) => {
        styleElement.textContent = `${detailsArray[0]} \n ${detailsArray[1]}`;
      });
      base.appendChild(styleElement);
    }

    function loadFont(name, style, weight, unicodeRange) {
      return new FontFace('Lato', `url(${browser.runtime.getURL(`/fonts/${name}.woff`)}`, { style, weight, unicodeRange });
    }

    loadCss('adblock-onpage-icon.css');

    // load fonts programmatically
    // Referencing the fonts in CSS do not load the fonts properly (reason unknown)
    // but programmatically loading them performs reliably.
    const fonts = [];
    fonts.push(loadFont('lato-regular', 'normal', 'normal', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(loadFont('lato-ext-regular', 'normal', 'normal', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(loadFont('lato-ext-italic', 'italic', 'normal', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(loadFont('lato-italic', 'italic', 'normal', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(loadFont('lato-ext-bolditalic', 'italic', 'bold', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(loadFont('lato-bolditalic', 'italic', 'bold', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(loadFont('lato-ext-bold', 'normal', 'bold', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(loadFont('lato-bold', 'normal', 'bold', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(new FontFace('Material Icons', `url(${browser.runtime.getURL('/icons/MaterialIcons-Regular.woff2')}`, { style: 'normal', weight: 'normal' }));
    fonts.push(new FontFace('AdBlock Icons', `url(${browser.runtime.getURL('/icons/adblock-icons.woff2')}`, { style: 'normal', weight: 'normal' }));
    Promise.all(fonts).then((loaded) => {
      for (let i = 0; i < loaded.length; i++) {
        // documents.fonts supported in Chrome 60+ and documents.fonts.add() is experimental
        // https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet#Browser_compatibility
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts#Browser_compatibility
        document.fonts.add(loaded[i]);
      }
      callback();
    }).catch(() => {
      callback();
    });
  }

  // create the icon DIV, including the children and insert them into the DOM
  const showOverlay = function (titlePrefixText, titleText,
    msgText, buttonText, ctaIconURL,
    buttonAction, surveyId) {
    // if either the DIV already exists, don't add another one, just return
    if (document.getElementById(divID)) {
      return;
    }
    const mainBody = document.body;
    if (mainBody) {
      const overlayElement = document.createElement('div');
      overlayElement.id = divID;
      const sanitizedTitleText = DOMPurify.sanitize(titleText);
      const sanitizedMsgText = DOMPurify.sanitize(msgText);
      const sanitizedButtonText = DOMPurify.sanitize(buttonText);
      const overlayChildElement = DOMPurify.sanitize(`
        <div class="hoverOverIcon">
          <div class="grow speech-bubble">
            <div id="header-icons">
              <span  class="header-section">
                <img class="header-logo" alt="AdBlock logo" src="${browser.runtime.getURL('icons/adblock-20.svg')}">
                <span class="header-logo-text">ADBLOCK</span>
              </span>
              <span class="header-section">
                <i
                  tabindex="10"
                  class="material-icons md-20"
                  id="settingsIcon"
                  role="img"
                  aria-label="settings"
                  >settings</i
                >
                <i
                  tabindex="10"
                  class="material-icons md-20"
                  id="closeIcon"
                  role="img"
                  aria-label="close"
                  >close</i
                >
              </span>
            </div>
            <div id="speech-bubble-content">
              <div class="titleRow">
                <span id="titlePrefixText" class="titleText">${titlePrefixText}</span>
                <span class="titleText">${sanitizedTitleText}</span>
              </div>
              <div class="msgBody">
                <div id="msgText">${sanitizedMsgText}</div>
                <span id="heroImg">
                ${ctaIconURL}
                </span>
              </div>
              <div id="footer">
                <button
                  type="button"
                  id="btnLearnMore"
                >${sanitizedButtonText}</button>
              </div>
            </div>
          </div>
          <div id="overlayIcon" class="showMoreIcon">
              <span id="iconlogo">
                <svg width="39" height="36" viewBox="0 0 39 36" fill="none" xmlns="http://www.w3.org/2000/svg" version="1.1" >
                <defs>
                  <style type="text/css"><![CDATA[
                    #hand {
                      animation-name: wave-animation;
                      animation-duration: 2s;
                      animation-iteration-count: 5;
                      transform-origin: 50% 70%;
                    }
                    @keyframes wave-animation {
                      0% {
                        transform: rotate(0deg);
                      }
                      10% {
                        transform: rotate(-20deg);
                      }
                      20% {
                        transform: rotate(12deg);
                      }
                      30% {
                        transform: rotate(-20deg);
                      }
                      40% {
                        transform: rotate(9deg);
                      }
                      50% {
                        transform: rotate(0deg);
                      }
                      100% {
                        transform: rotate(0deg);
                      }
                    }
                    @keyframes hideMe {
                      to {
                        opacity: 0;
                      }
                    }
                    #svgIcon circle {
                      animation: hideMe 1s ease-in-out forwards;
                      animation-play-state: paused;
                    }
                    #svgIcon:hover circle {
                      animation-play-state: running;
                    }
                  ]]></style>
                </defs>
                <g id="svgIcon">
                  <path id="octagon" fill-rule="evenodd" clip-rule="evenodd" d="M11.8572 0C10.2659 0 8.73965 0.632213 7.61441 1.75755L1.75718 7.6153C0.632071 8.7405 0 10.2665 0 11.8578V20.1429C0 21.7342 0.632141 23.2603 1.75736 24.3856L7.61445 30.2426C8.73966 31.3679 10.2658 32 11.8571 32H20.1421C21.7334 32 23.2595 31.3679 24.3847 30.2426L30.2418 24.3856C31.367 23.2603 31.9992 21.7342 31.9992 20.1429V11.8578C31.9992 10.2665 31.3671 8.74051 30.242 7.6153L24.3848 1.75755C23.2595 0.632215 21.7333 0 20.1419 0H11.8572Z" fill="#E40D0D"/>
                  <path id="hand" fill-rule="evenodd" clip-rule="evenodd" d="M15.6177 27.5994C20.9189 27.5994 22.1768 22.7368 22.1768 22.7368L25.2193 13.9948C25.2193 13.9948 25.4941 13.0874 25.4437 13.0773C22.6103 12.5479 22.0079 14.5444 22.0079 14.5444C22.0079 14.5444 20.9189 17.3727 20.75 17.3727C20.5811 17.3727 20.5609 17.1634 20.5609 17.1634V7.00223C20.5609 7.00223 20.6139 5.69143 19.2678 5.69143C17.9217 5.69143 17.9898 7.00475 17.9898 7.00475L17.9923 14.5116C17.9923 14.5116 18.0099 14.8141 17.7579 14.8141C17.5335 14.8141 17.5461 14.5217 17.5461 14.5217V5.47717C17.5461 5.47717 17.6293 4 16.2681 4C14.9069 4 14.98 5.48725 14.98 5.48725L14.9674 14.4108C14.9674 14.4108 14.985 14.6855 14.7607 14.6855C14.5514 14.6855 14.559 14.4133 14.559 14.4133V6.93165C14.559 6.93165 14.6346 5.40911 13.2482 5.40911C11.887 5.40911 11.9601 6.95938 11.9601 6.95938L11.9475 14.8595C11.9475 14.8595 11.9727 15.0888 11.7584 15.0888C11.5316 15.0888 11.5366 14.8595 11.5366 14.8595L11.5265 10.0826C11.5265 10.0826 11.5391 8.76172 10.3947 8.76172C9.17717 8.76172 9.19986 10.0826 9.19986 10.0826V20.3925C9.20742 20.39 8.89232 27.5994 15.6177 27.5994Z" fill="white"/>
                  <circle cx="31" cy="28" r="8" fill="#2284F7"/>
                  <path id="numberOne" d="M33.2746 31.075V32H29.2746V31.075H30.7396V26.86C30.7396 26.6933 30.7446 26.5217 30.7546 26.345L29.7146 27.215C29.6546 27.2617 29.5946 27.2917 29.5346 27.305C29.4779 27.315 29.4229 27.315 29.3696 27.305C29.3196 27.295 29.2746 27.2783 29.2346 27.255C29.1946 27.2283 29.1646 27.2 29.1446 27.17L28.7546 26.635L30.9596 24.76H31.9746V31.075H33.2746Z" fill="white"/>
                </g>
              </svg>
            </span>
          </div>
        </div>
      `, {
        ALLOW_UNKNOWN_PROTOCOLS: true, RETURN_DOM_FRAGMENT: true, ADD_ATTR: ['data'], ADD_TAGS: [],
      });

      if (DOMPurify.removed && DOMPurify.removed.length > 0) {
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_invalid_msg', additionalParams: { surveyId } });
        return;
      }

      const settingsIcon = overlayChildElement.querySelector('#settingsIcon');
      settingsIcon.onclick = function settingsClicked(event) {
        if (!event.isTrusted) {
          return;
        }
        removeIcon();
        browser.runtime.sendMessage({ command: 'openTab', urlToOpen: browser.runtime.getURL('options.html#general') });
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_settings_clicked', additionalParams: { surveyId } });
      };

      const closeIcon = overlayChildElement.querySelector('#closeIcon');
      closeIcon.onclick = function closedClicked(event) {
        if (!event.isTrusted) {
          return;
        }
        removeIcon();
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_closed_clicked', additionalParams: { surveyId } });
      };

      const leanMoreBtn = overlayChildElement.querySelector('#btnLearnMore');
      if (buttonText && buttonAction) {
        leanMoreBtn.onclick = function learnMoreClicked(event) {
          if (!event.isTrusted) {
            return;
          }
          removeIcon();
          if (buttonAction && buttonAction.startsWith('/')) {
            browser.runtime.sendMessage({ command: 'openTab', urlToOpen: `https://getadblock.com${buttonAction}` });
          } else if (buttonAction && buttonAction.startsWith('#')) {
            browser.runtime.sendMessage({ command: 'openTab', urlToOpen: browser.runtime.getURL(`options.html${buttonAction}`) });
          }
          browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_btn_clicked', additionalParams: { surveyId } });
        };
      } else {
        leanMoreBtn.style.display = 'none';
      }

      const adBlockIcon = overlayChildElement.querySelector('#overlayIcon');
      const mouseHandler = function () {
        adBlockIcon.removeEventListener('mouseenter', mouseHandler);
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_expanded', additionalParams: { surveyId } });
        browser.runtime.sendMessage({ onpageiconevent: 'mouseenter' });
      };
      adBlockIcon.addEventListener('mouseenter', mouseHandler);
      if (!ctaIconURL) {
        const heroImg = overlayChildElement.querySelector('#heroImg');
        heroImg.style.display = 'none';
      }
      const baseShadow = overlayElement.attachShadow({ mode: 'open' });

      const determineFBNewMsgIconBottomPosition = (iconNodelist) => {
        const startElement = iconNodelist[0];
        const elems = startElement.parentElement.parentElement.childNodes;
        let lowTop = startElement.getBoundingClientRect().top + 1;
        for (let inx = 0; inx < elems.length; inx++) {
          const theEl = elems[inx];
          const posit = theEl.getBoundingClientRect();
          if (posit.top < lowTop) {
            lowTop = posit.top;
          }
        }
        return lowTop;
      };

      const determineOnPageIconBottomPostion = () => {
        const host = window.location.hostname;
        if (!problemSites[host] || !problemSites[host].heightAdjustment) {
          return defaultBottomPosition;
        }
        if (host === 'www.facebook.com') { // Special processing for FB
          const newMsgIconNodeList = document.querySelectorAll(problemSites[host].selector);
          if (newMsgIconNodeList.length > 1) {
            return -1; // too many icons on the page match, don't show anything
          }
          if (newMsgIconNodeList.length === 0) {
            // it would appear there's no icons / chatheads, use the default
            return defaultBottomPosition;
          }
          const bottomPosition = window.innerHeight
                - (determineFBNewMsgIconBottomPosition(newMsgIconNodeList)
                - problemSites[host].heightAdjustment);
          return bottomPosition;
        }
        const conflictingElement = document.querySelector(problemSites[host].selector);
        if (conflictingElement) {
          const rect = conflictingElement.getBoundingClientRect();
          if (rect && rect.height > 0) {
            return problemSites[host].heightAdjustment + rect.height;
          }
        }
        return defaultBottomPosition;
      };

      const determineOnPageIconRightPostion = () => {
        const host = window.location.hostname;
        if (!problemSites[host] || !problemSites[host].rightAdjustment) {
          return defaultRightPosition;
        }
        const conflictingElement = document.querySelector(problemSites[host].selector);
        if (conflictingElement) {
          return problemSites[host].rightAdjustment;
        }
        return defaultRightPosition;
      };

      const checkForDelay = () => new Promise((resolve) => {
        const host = window.location.hostname;
        if (!problemSites[host] || !problemSites[host].delay) {
          resolve(); // will use default, with no dealy
          return;
        }
        setTimeout(() => {
          resolve();
        }, problemSites[host].delay);
      });


      loadIconResources(baseShadow, async () => {
        setLangAndDirAttributes(overlayChildElement);
        await checkForDelay();
        const bottomPostion = determineOnPageIconBottomPostion();
        if (bottomPostion < 0) {
          return;
        }
        baseShadow.host.style.setProperty('--icon-bottom-position', `${bottomPostion}px`);
        const rightPosition = determineOnPageIconRightPostion();
        baseShadow.host.style.setProperty('--icon-right-position', `${rightPosition}px`);

        baseShadow.appendChild(overlayChildElement);
        (document.body || document.documentElement).appendChild(overlayElement);
        browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'onpagemessage_shown', additionalParams: { surveyId } });
      });
    }
  };

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'showonpageicon' && request.tabURL === document.location.href) {
      showOverlay(request.titlePrefixText,
        request.titleText,
        request.msgText,
        request.buttonText,
        request.ctaIconURL,
        request.buttonURL,
        request.surveyId);
      sendResponse({ ack: request.command });
    }
    if (request.command === 'removeIcon') {
      removeIcon();
      sendResponse({});
    }
  });
}());
