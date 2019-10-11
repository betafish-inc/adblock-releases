'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome */

(function onScriptLoad() {
  const divID = '_ABoverlay';
  const iframeID = '_ABiframe';
  const styleID = '_ABstyle';

  const calculateWindowWidth = function () {
    if (!window || !window.document) {
      return 0;
    }

    const bestGuess = window.innerWidth;

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'left:0px; right:0px; top:0px; height:0px; visibility:hidden';
    document.body.appendChild(tempDiv);

    try {
      if (tempDiv.offsetWidth <= 0) {
        return bestGuess;
      }
      const theStyle = window.getComputedStyle(document.body);
      if (!theStyle) {
        return 0;
      }
      const marginLeft = parseInt(theStyle.marginLeft, 10);
      const marginRight = parseInt(theStyle.marginRight, 10);
      if (marginLeft > 0 || marginRight > 0) {
        return tempDiv.offsetWidth + marginRight + marginLeft;
      }
      return Math.max(tempDiv.offsetWidth, document.body.offsetWidth);
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const overlayResize = function () {
    const overlayElement = document.getElementById(divID);
    const frameElement = document.getElementById(iframeID);
    if (overlayElement
        && frameElement) {
      const a = calculateWindowWidth();
      overlayElement.style.width = `${a}px`;
      frameElement.style.width = `${a}px`;
    }
  };

  const receiveMessage = function (event) {
    // WARNING: We do not verify the sender of this message.
    // The sender of the message could be a website instead of AdBlock.
    // This isn't dangerous now because all we do is close an overlay,
    // but don't add any dangerous functionality without
    // addressing this issue.
    if (event.data === 'removethe_ABoverlay') {
      // Exception required since the error cannot be resolved by changing
      // the order of declaration of 'receiveMessage' and 'removeOverlay'
      // eslint-disable-next-line no-use-before-define
      removeOverlay();
    }
  };

  // create the DIV and IFRAME and insert them into the DOM
  const showOverlay = function (iframeURLsrc) {
    // if the DIV and IFRAME already exist, don't add another one, just return
    if (document.getElementById(divID)
        && document.getElementById(iframeID)) {
      return;
    }
    const urlPrefix = 'https://getadblock.com/';
    const mainBody = document.body;
    if (mainBody) {
      // create overlay DIV tag
      const overlayElement = document.createElement('div');
      overlayElement.id = divID;
      mainBody.insertBefore(overlayElement, mainBody.firstChild);
      window.addEventListener('resize', overlayResize);
      window.addEventListener('message', receiveMessage);

      // if the user decides to print the page create a
      // style element so that our DIV tag isn't printed
      const styleElement = document.createElement('style');
      styleElement.type = 'text/css';
      styleElement.id = styleID;
      (document.head || document.documentElement).insertBefore(styleElement, null);
      styleElement.sheet.insertRule('@media print { #_ABoverlay{ height: 0px; display:none } }', 0);
      styleElement.sheet.insertRule('#_ABoverlay { display:block; top:0px; left:0px; height: 0px; width:100%;position:fixed; z-index:2147483647 !important }', 0);
      styleElement.sheet.insertRule('#_ABiframe {border:0px }', 0);
      // create the iframe element, add it the DIV created above.
      const abFrame = document.createElement('iframe');
      abFrame.id = iframeID;
      const winWidth = calculateWindowWidth();
      abFrame.style.width = `${winWidth}px`;
      abFrame.scrolling = 'no';
      const setABElementsHeight = function () {
        abFrame.style.height = '27px';
        overlayElement.style.height = '27px';
      };
      overlayElement.appendChild(abFrame);
      abFrame.src = urlPrefix + iframeURLsrc;
      setABElementsHeight();
    }
  };

  const removeOverlay = function () {
    const removeById = function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.parentNode.removeChild(el);
      }
    };
    removeById(divID);
    removeById(styleID);
    window.removeEventListener('resize', overlayResize);
    window.removeEventListener('message', receiveMessage);
  };

  chrome.extension.onRequest.addListener((request, sender, sendResponse) => {
    if (request.command === 'showoverlay'
        && request.overlayURL
        && request.tabURL === document.location.href) {
      showOverlay(request.overlayURL);
      sendResponse({ ack: request.command });
    }
  });
}());
