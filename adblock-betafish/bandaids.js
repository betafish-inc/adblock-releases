var hostname = window.location.hostname;

var abort = (function() {
    'use strict';

    var doc = document;
    if (doc instanceof HTMLDocument === false) {
        if (doc instanceof XMLDocument === false ||
            doc.createElement('div') instanceof HTMLDivElement === false) {
            return true;
        }
    }
    if ((doc.contentType || '').lastIndexOf('image/', 0) === 0 ) {
        return true;
    }
    return false;
})();


if ( !abort ) {
    if (hostname === '') {
        hostname = (function() {
            var win = window, hn = '', max = 10;
            try {
                for (;;) {
                    hn = win.location.hostname;
                    if ( hn !== '' ) { return hn; }
                    if ( win.parent === win ) { break; }
                    win = win.parent;
                    if ( !win ) { break; }
                    if ( (max -= 1) === 0 ) { break; }
                }
            } catch(ex) {
            }
            return hn;
        })();
    }
    // Don't inject if document is from local network.
    abort = /^192\.168\.\d+\.\d+$/.test(hostname);
}

var getAdblockDomain = function() {
  adblock_installed = true;
};

var getAdblockDomainWithUserID = function(userid) {
  adblock_userid = userid;
};

var getAdblockVersion = function(version) {
  adblock_version = version;
};


(function() {
    'use strict';

    if ( abort ) {
      return;
    }

    // https://bugs.chromium.org/p/chromium/issues/detail?id=129353
    // Trap calls to WebSocket constructor, and expose websocket-based network
    // requests to AdBlock

    // Fix won't be applied on older versions of Chromium.
    if ( window.WebSocket instanceof Function === false ) {
      return;
    }

    // Only for dynamically created frames and http/https documents.
    if ( /^(https?:|about:)/.test(window.location.protocol) !== true ) {
      return;
    }

    var doc = document;
    var parent = doc.head || doc.documentElement;
    if ( parent === null ) {
      return;
    }

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };

    if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname ||
        'dev1.getadblock.com' === document.location.hostname ||
        'dev2.getadblock.com' === document.location.hostname) {
      chrome.storage.local.get('userid', function (response) {
        var adblock_user_id = response['userid'];
        var adblock_version = chrome.runtime.getManifest().version;
        var elem = document.createElement('script');
        var scriptToInject = '(' + getAdblockDomain.toString() + ')();' +
            '(' + cleanup.toString() + ')();' +
            '(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
            '(' + getAdblockVersion.toString() + ')(\'' + adblock_version + '\');';
        elem.appendChild(document.createTextNode(scriptToInject));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
    } 
})();

var run_bandaids = function()
{
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/mail\.live\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "hotmail";
  }
  else if (('getadblock.com' === document.location.hostname ||
            'dev.getadblock.com' === document.location.hostname ||
            'dev1.getadblock.com' === document.location.hostname ||
            'dev2.getadblock.com' === document.location.hostname) &&
           (window.top === window.self))
  {
    if (/\/question\/$/.test(document.location.pathname))
    {
      apply_bandaid_for = "getadblockquestion";
    }
    else
    {
      apply_bandaid_for = "getadblock";
    }
  }
  else if (/(^|\.)twitch\.tv$/.test(hostname) === true)
  {
    apply_bandaid_for = "twitch";
  }

  var bandaids = {
    hotmail : function()
    {
      // removing the space remaining in Hotmail/WLMail
      var css_chunk = document.createElement("style");
      css_chunk.type = "text/css";
      (document.head || document.documentElement).insertBefore(css_chunk, null);
      css_chunk.sheet.insertRule(".WithRightRail { right:0px !important; }", 0);
      css_chunk.sheet.insertRule("#RightRailContainer  { display:none !important; visibility: none !important; orphans: 4321 !important; }", 0);
    },
    getadblockquestion : function()
    {
      BGcall('addGABTabListeners');
      var personalBtn = document.getElementById("personal-use");
      var enterpriseBtn = document.getElementById("enterprise-use");
      var buttonListener = function(event)
      {
        BGcall('removeGABTabListeners', true);
        if (enterpriseBtn)
        {
          enterpriseBtn.removeEventListener("click", buttonListener);
        }
        if (personalBtn)
        {
          personalBtn.removeEventListener("click", buttonListener);
        }
      };
      if (personalBtn)
      {
        personalBtn.addEventListener("click", buttonListener);
      }
      if (enterpriseBtn)
      {
        enterpriseBtn.addEventListener("click", buttonListener);
      }
    },
    getadblock : function()
    {
      window.addEventListener("message", receiveMessage, false);
      function receiveMessage(event)
      {
        if (event.data &&
            event.data.command === "payment_success") {
          window.removeEventListener("message", receiveMessage);
          chrome.runtime.sendMessage(event.data, function (response) {
            window.postMessage(response, "*");
          });
        }
      }

      window.addEventListener("message", receiveMagicCodeMessage, false);
      function receiveMagicCodeMessage(event)
      {
        if (event.data &&
          typeof event.data.magicCode === "string") {
          chrome.runtime.sendMessage(event.data, function (response) {
            // hookup options page link
            let link = document.getElementById('open-options-page');
            if (link) {
              link.onclick = (event) => {
                if (event.isTrusted === false) {
                  return;
                }
                event.stopImmediatePropagation();
                event.preventDefault();
                BGcall('openTab', "options.html");
              }
            }
            window.postMessage(response, "*");
          });
        }
      }

      chrome.storage.local.get("userid", function(response)
      {
        if (response.userid)
        {
          var elemDiv = document.createElement("div");
          elemDiv.id = "adblock_user_id";
          elemDiv.innerText = response.userid;
          elemDiv.style.display = "none";
          document.body.appendChild(elemDiv);
        }
      });
      if (document.getElementById("enable_show_survey"))
      {
        document.getElementById("enable_show_survey").onclick = function(event)
        {
          BGcall("setSetting", "show_survey", !document.getElementById("enable_show_survey").checked, true);
        };
      }
      var aaElements = document.querySelectorAll("#disableacceptableads");
      if (aaElements &&
          aaElements.length)
      {
        for (i = 0; i < aaElements.length; ++i)
        {
          aaElements[i].onclick = function(event)
          {
            if (event.isTrusted === false) {
              return;
            }
            event.preventDefault();
            BGcall("unsubscribe", {
              id : "acceptable_ads",
              del : false
            }, function()
            {
              BGcall("recordGeneralMessage", "disableacceptableads_clicked", undefined, undefined, function()
              {
                BGcall("openTab", "options.html?aadisabled=true#general");
              });
            });
          }
        }
      }
    },
    // The following Twitch-related code is used under the terms of the MIT license
    // from https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them
    twitch : function()
    {
      var _tmuteVars = { "timerCheck": 1000, // Checking rate of ad in progress (in ms ; EDITABLE)
                          "playerMuted": false, // Player muted or not
                          "adsDisplayed": 0, // Number of ads displayed
                          "disableDisplay": true, // Disable the player display during an ad (true = yes, false = no (default) ; EDITABLE)
                          "alreadyMuted": false, // Used to check if the player is muted at the start of an ad
                          "adElapsedTime": undefined, // Used to check if Twitch forgot to remove the ad notice
                          "adUnlockAt": 150, // Unlock the player if this amount of seconds elapsed during an ad (EDITABLE)
                          "adMinTime": 15, // Minimum amount of seconds the player will be muted/hidden since an ad started (EDITABLE ; Recommended to really avoid any ad: 30 to 45)
                          "squadPage": false, // Either the current page is a squad page or not
                          "playerIdAds": 0, // Player ID where ads may be displayed (on squads page it's the last id instead of 0)
                          "displayingOptions": false // Either ads options are currently displayed or not
                         };
      
      // Check if there's an ad
      function checkAd()
      { 
        var isViewing = Boolean(document.getElementsByClassName("player-video").length);
        if (isViewing === false) return;
        
        // Initialize the ads options if necessary.
        var optionsInitialized = (document.getElementById("_tmads_options") === null) ? false : true;
        if (optionsInitialized === false) adsOptions("init");
        
        var advert = document.getElementsByClassName("player-ad-notice");
        
        if (_tmuteVars.adElapsedTime !== undefined)
        {
          _tmuteVars.adElapsedTime++;
          if (_tmuteVars.adElapsedTime >= _tmuteVars.adUnlockAt && advert[0] !== undefined) 
          {
            advert[0].parentNode.removeChild(advert[0]);
          }
        }
        
        if ((advert.length >= 1 && _tmuteVars.playerMuted === false) || (_tmuteVars.playerMuted === true && advert.length === 0)) 
        {
          // Update at the start of an ad if the player is already muted or not
          if (advert.length >= 1) _tmuteVars.alreadyMuted = Boolean(document.getElementsByClassName("player-button--volume")[_tmuteVars.playerIdAds].childNodes[0].className === "unmute-button"); 
          
          // Keep the player muted/hidden for the minimum ad time set (Twitch started to remove the ad notice before the end of some ads)
          if (advert.length === 0 && _tmuteVars.adElapsedTime !== undefined && _tmuteVars.adElapsedTime < _tmuteVars.adMinTime) return;

          mutePlayer();
        }
      }

      // (un)Mute Player
      function mutePlayer()
      {
        if (document.getElementsByClassName("player-button--volume").length >= 1)
        {
          if (_tmuteVars.alreadyMuted === false) document.getElementsByClassName("player-button--volume")[_tmuteVars.playerIdAds].click(); // If the player is already muted before an ad, we avoid to unmute it.
          _tmuteVars.playerMuted = !(_tmuteVars.playerMuted);

          if (_tmuteVars.playerMuted === true)
          {
            _tmuteVars.adsDisplayed++;
            _tmuteVars.adElapsedTime = 1;
            if (_tmuteVars.disableDisplay === true) document.getElementsByClassName("player-video")[_tmuteVars.playerIdAds].style.visibility = "hidden";
          } else {
            _tmuteVars.adElapsedTime = undefined;
            if (_tmuteVars.disableDisplay === true) document.getElementsByClassName("player-video")[_tmuteVars.playerIdAds].style.visibility = "visible";
          }
        }
      }
      
      // Manage ads options
      function adsOptions(changeType = "show")
      {
        switch(changeType) {
          // Manage player display during an ad (either hiding the ads or still showing them)
          case "display":
            _tmuteVars.disableDisplay = !(_tmuteVars.disableDisplay);
            // Update the player display if an ad is supposedly in progress
            if (_tmuteVars.playerMuted === true) document.getElementsByClassName("player-video")[_tmuteVars.playerIdAds].style.visibility = (_tmuteVars.disableDisplay === true) ? "hidden" : "visible";
            document.getElementById("_tmads_display").innerText = (_tmuteVars.disableDisplay === true ? "Show" : "Hide") + " player during ads";
            break;
          // Force a player unlock if Twitch didn't remove the ad notice properly instead of waiting the auto unlock
          case "unlock":
            var advert = document.getElementsByClassName('player-ad-notice');
            if (_tmuteVars.adElapsedTime !== undefined || advert[0] !== undefined)
            {
              // We set the elapsed time to the unlock timer to trigger it during the next check.
              _tmuteVars.adElapsedTime = _tmuteVars.adUnlockAt;
            }
            break;
          // Display the ads options button
          case "init":
            if (document.getElementsByClassName("channel-info-bar__viewers-wrapper")[0] === undefined && document.getElementsByClassName("squad-stream-top-bar__container")[0] === undefined) break;
            
            // Append ads options and events related
            var optionsTemplate = document.createElement("div");
            optionsTemplate.id = "_tmads_options-wrapper";
            optionsTemplate.className = "tw-mg-r-1";
            optionsTemplate.innerHTML = `
            <span id="_tmads_options" style="display: none;">
              <button type="button" id="_tmads_unlock" style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;" class="tw-interactive tw-button-icon tw-button-icon--hollow">Unlock player</button>
              <button type="button" id="_tmads_display" style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;" class="tw-interactive tw-button-icon tw-button-icon--hollow">` + (_tmuteVars.disableDisplay === true ? "Show" : "Hide") + ` player during ads</button>
            </span>
            <button type="button" id="_tmads_showoptions" style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;" class="tw-interactive tw-button-icon tw-button-icon--hollow">Ads Options</button>`;
            
            // Normal player page
            if (document.getElementsByClassName("channel-info-bar__viewers-wrapper")[0] !== undefined)
            {
              _tmuteVars.squadPage = false;
              _tmuteVars.playerIdAds = 0;
              document.getElementsByClassName("channel-info-bar__viewers-wrapper")[0].parentNode.parentNode.appendChild(optionsTemplate);
            // Squad page
            } else if (document.getElementsByClassName("squad-stream-top-bar__container")[0] !== undefined)
            {
              _tmuteVars.squadPage = true;
              _tmuteVars.playerIdAds = 0;
              // Since the primary player is never at the same place, we've to find it.
              for (var i = 0; i < parseInt(document.getElementsByClassName("player-video").length); i++)
              {
                if (document.getElementsByClassName("multi-stream-player-layout__player-container")[0].childNodes[i].classList.contains("multi-stream-player-layout__player-primary"))
                {
                  _tmuteVars.playerIdAds = i;
                  break;
                }
              }
              document.getElementsByClassName("squad-stream-top-bar__container")[0].appendChild(optionsTemplate);
            }
            
            document.getElementById("_tmads_showoptions").addEventListener("click", adsOptions, false);
            document.getElementById("_tmads_display").addEventListener("click", function() { adsOptions("display"); }, false);
            document.getElementById("_tmads_unlock").addEventListener("click", function() { adsOptions("unlock"); }, false);
            
            break;
          // Display/Hide the ads options
          case "show":
          default:
            _tmuteVars.displayingOptions = !(_tmuteVars.displayingOptions);
            document.getElementById("_tmads_options").style.display = (_tmuteVars.displayingOptions === false) ? "none" : "inline-block";
        } 
      }
      
      BGcall("getSettings", function(settings) {
        if (settings.twitch_hiding) {
          // Start the background check
          _tmuteVars.autoCheck = setInterval(checkAd, _tmuteVars.timerCheck);
        }
      });
    }
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
