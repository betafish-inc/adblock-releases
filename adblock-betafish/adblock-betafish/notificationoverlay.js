//only run this if the top / main page.
//we need this check because Safari currently does not allow us to control
//which documents this file is inject in, where Chrome does.
if (window.top === window) {
  (function() {
    var divID = "_ABoverlay";
    var iframeID = "_ABiframe";
    var styleID = "_ABstyle";

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      if (request.command === 'showoverlay' &&
          request.overlayURL &&
          request.tabURL === document.location.href) {
          showOverlay(request.overlayURL);
          sendResponse({ ack: request.command });
      }
    });
    //create the DIV and IFRAME and insert them into the DOM
    var showOverlay = function(iframeURLsrc) {
      //if the DIV and IFRAME already exist, don't add another one, just return
      if (document.getElementById(divID) &&
          document.getElementById(iframeID)) {
        return;
      }
      var urlPrefix = 'https://getadblock.com/';
      var mainBody = document.body;
      if (mainBody) {
        //create overlay DIV tag
        var overlayElement = document.createElement("div");
        overlayElement.id = divID;
        mainBody.insertBefore(overlayElement, mainBody.firstChild);
        window.addEventListener("resize", overlayResize);
        window.addEventListener("message", receiveMessage);
        //create style element, so that our DIV tag isn't printed, if the user decides to print the page.
        var styleElement = document.createElement("style");
        styleElement.type = "text/css";
        styleElement.id = styleID;
        (document.head || document.documentElement).insertBefore(styleElement, null);
        styleElement.sheet.insertRule("@media print { #_ABoverlay{ height: 0px; display:none } }", 0);
        styleElement.sheet.insertRule("#_ABoverlay { display:block; top:0px; left:0px; height: 0px; width:100%;position:fixed; z-index:2147483647 !important }", 0);
        styleElement.sheet.insertRule("#_ABiframe {border:0px }", 0);
        //create the iframe element, add it the DIV created above.
        var abFrame = document.createElement("iframe");
        abFrame.id = iframeID;
        var winWidth = calculateWindowWidth();
        abFrame.style.width = winWidth + "px";
        abFrame.scrolling = "no";
        var setABElementsHeight = function() {
          abFrame.style.height = "27px";
          overlayElement.style.height = "27px";
        };
        if (SAFARI) {
          overlayElement.appendChild(abFrame);
          abFrame.src = urlPrefix + iframeURLsrc;
          setABElementsHeight();
        } else {
          //CHROME browser allow us to load via AJAX
          //so we'll try loading the contents of the iframe using an AJAX request first,
          //this way we can capture the response code.
          var frameRequest = new XMLHttpRequest();
          frameRequest.onload = function() {
            if (200 === frameRequest.status && frameRequest.response) {
              overlayElement.appendChild(abFrame);
              abFrame.contentWindow.document.write(frameRequest.response);
              setABElementsHeight();
            } else {
              removeOverlay();
            }
          }
          frameRequest.onerror = function() {
            removeOverlay();
          };
          frameRequest.open('get', urlPrefix + iframeURLsrc);
          frameRequest.send();
        }
      }
    };

    var removeOverlay = function() {
      var removeById = function(id) {
        var el = document.getElementById(id);
        if (el) {
          el.parentNode.removeChild(el);
        }
      };
      removeById(divID);
      removeById(styleID);
      window.removeEventListener("resize", overlayResize);
      window.removeEventListener("message", receiveMessage);
    };

    var receiveMessage = function(event){
      //WARNING: We do not verify the sender of this message.
      //The sender of the message could be a website instead of AdBlock.
      //This isn't dangerous now because all we do is close an overlay,
      //but don't add any dangerous functionality without
      //addressing this issue.
       if (event.data=="removethe_ABoverlay"){
          removeOverlay();
       }
    };

    var overlayResize = function() {
      var overlayElement = document.getElementById(divID);
      var frameElement = document.getElementById(iframeID);
      if (overlayElement &&
          frameElement) {
        var a = calculateWindowWidth();
        overlayElement.style.width = a + "px";
        frameElement.style.width = a + "px";
      }
    };

    var calculateWindowWidth = function() {
      if (!window || !window.document) {
        return 0;
      }

      var bestGuess = window.innerWidth;

      var tempDiv = document.createElement("div");
      tempDiv.style.cssText = "left:0px; right:0px; top:0px; height:0px; visibility:hidden";
      document.body.appendChild(tempDiv);

      try {
        if (tempDiv.offsetWidth <= 0) {
          return bestGuess;
        }
        var theStyle = window.getComputedStyle(document.body);
        if (!theStyle) {
          return 0;
        }
        var marginLeft = parseInt(theStyle.marginLeft);
        var marginRight = parseInt(theStyle.marginRight);
        if (0 < marginLeft || 0 < marginRight) {
          return tempDiv.offsetWidth + marginRight + marginLeft;
        } else {
          return Math.max(tempDiv.offsetWidth, document.body.offsetWidth);
        }
      } finally {
        document.body.removeChild(tempDiv);
      }
    };
  })();
}
