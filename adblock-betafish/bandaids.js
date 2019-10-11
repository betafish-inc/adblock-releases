'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, BGcall, adblock_installed, adblock_userid, adblock_version */

const invalidGUIDChars = /[^a-z0-9]/g;

let abort = (function shouldAbort() {
  if (document instanceof HTMLDocument === false) {
    if (document instanceof XMLDocument === false
            || document.createElement('div') instanceof HTMLDivElement === false) {
      return true;
    }
  }
  if ((document.contentType || '').lastIndexOf('image/', 0) === 0) {
    return true;
  }
  return false;
}());

if (!abort) {
  let { hostname } = window.location;

  if (hostname === '') {
    hostname = (function getHostname() {
      let win = window;
      let hn = '';
      let max = 10;
      try {
        for (;;) {
          hn = win.location.hostname;
          if (hn !== '') {
            return hn;
          }
          if (win.parent === win) {
            break;
          }
          win = win.parent;
          if (!win) {
            break;
          }
          if ((max -= 1) === 0) {
            break;
          }
        }
      } catch (ex) {
        // emtpy
      }
      return hn;
    }());
  }
  // Don't inject if document is from local network.
  abort = /^192\.168\.\d+\.\d+$/.test(hostname);
}

const getAdblockDomain = function () {
  // eslint-disable-next-line no-global-assign
  adblock_installed = true;
};

const getAdblockDomainWithUserID = function (userid) {
  // eslint-disable-next-line no-global-assign
  adblock_userid = userid;
};

const getAdblockVersion = function (version) {
  // eslint-disable-next-line no-global-assign
  adblock_version = version;
};

(function onLoad() {
  if (abort) {
    return;
  }

  // https://bugs.chromium.org/p/chromium/issues/detail?id=129353
  // Trap calls to WebSocket constructor, and expose websocket-based network
  // requests to AdBlock

  // Fix won't be applied on older versions of Chromium.
  if (window.WebSocket instanceof Function === false) {
    return;
  }

  // Only for dynamically created frames and http/https documents.
  if (/^(https?:|about:)/.test(window.location.protocol) !== true) {
    return;
  }

  const doc = document;
  const parent = doc.head || doc.documentElement;
  if (parent === null) {
    return;
  }

  // Have the script tag remove itself once executed (leave a clean
  // DOM behind).
  const cleanup = function () {
    const c = document.currentScript;
    const p = c && c.parentNode;
    if (p) {
      p.removeChild(c);
    }
  };

  if (document.location.hostname === 'getadblock.com'
        || document.location.hostname === 'dev.getadblock.com'
        || document.location.hostname === 'dev1.getadblock.com'
        || document.location.hostname === 'dev2.getadblock.com') {
    chrome.storage.local.get('userid').then((response) => {
      let adblockUserId = response.userid;
      if (adblockUserId.match(invalidGUIDChars)) {
        adblockUserId = 'invalid';
      }
      const adblockVersion = chrome.runtime.getManifest().version;
      const elem = document.createElement('script');
      const scriptToInject = `(${getAdblockDomain.toString()})();`
            + `(${cleanup.toString()})();`
            + `(${getAdblockDomainWithUserID.toString()})('${adblockUserId}');`
            + `(${getAdblockVersion.toString()})('${adblockVersion}');`;
      elem.appendChild(document.createTextNode(scriptToInject));
      try {
        (document.head || document.documentElement).appendChild(elem);
      } catch (ex) {
        // empty
      }
    });
  }
}());

const runBandaids = function () {
  const { hostname } = window.location;
  // Tests to determine whether a particular bandaid should be applied
  let applyBandaidFor = '';
  if (/mail\.live\.com/.test(document.location.hostname)) {
    applyBandaidFor = 'hotmail';
  } else if ((document.location.hostname === 'getadblock.com'
            || document.location.hostname === 'dev.getadblock.com'
            || document.location.hostname === 'dev1.getadblock.com'
            || document.location.hostname === 'dev2.getadblock.com')
            && (window.top === window.self)) {
    if (/\/question\/$/.test(document.location.pathname)) {
      applyBandaidFor = 'getadblockquestion';
    } else {
      applyBandaidFor = 'getadblock';
    }
  } else if (/(^|\.)twitch\.tv$/.test(hostname) === true) {
    applyBandaidFor = 'twitch';
  }

  const bandaids = {
    hotmail() {
      // removing the space remaining in Hotmail/WLMail
      const cssChunk = document.createElement('style');
      cssChunk.type = 'text/css';
      (document.head || document.documentElement).insertBefore(cssChunk, null);
      cssChunk.sheet.insertRule('.WithRightRail { right:0px !important; }', 0);
      cssChunk.sheet.insertRule(`#RightRailContainer
      {
        display: none !important;
        visibility: none !important;
        orphans: 4321 !important;
      }`, 0);
    },
    getadblockquestion() {
      BGcall('addGABTabListeners');
      const personalBtn = document.getElementById('personal-use');
      const enterpriseBtn = document.getElementById('enterprise-use');
      const buttonListener = function () {
        BGcall('removeGABTabListeners', true);
        if (enterpriseBtn) {
          enterpriseBtn.removeEventListener('click', buttonListener);
        }
        if (personalBtn) {
          personalBtn.removeEventListener('click', buttonListener);
        }
      };
      if (personalBtn) {
        personalBtn.addEventListener('click', buttonListener);
      }
      if (enterpriseBtn) {
        enterpriseBtn.addEventListener('click', buttonListener);
      }
    },
    getadblock() {
      function receiveMessage(event) {
        if (
          event.data
          && event.origin === 'https://getadblock.com'
          && event.data.command === 'payment_success'
        ) {
          window.removeEventListener('message', receiveMessage);
          chrome.runtime.sendMessage({ command: 'payment_success', version: 1 })
            .then((response) => {
              window.postMessage(response, '*');
            });
        }
      }

      window.addEventListener('message', receiveMessage, false);

      function receiveMagicCodeMessage(event) {
        if (event.data
            && event.origin === 'https://getadblock.com'
            && typeof event.data.magicCode === 'string') {
          chrome.runtime.sendMessage({ magicCode: event.data.magicCode }).then((response) => {
            // hookup options page link
            const link = document.getElementById('open-options-page');
            if (link) {
              link.onclick = (clickEvent) => {
                if (clickEvent.isTrusted === false) {
                  return;
                }
                clickEvent.stopImmediatePropagation();
                clickEvent.preventDefault();
                BGcall('openTab', 'options.html');
              };
            }
            window.postMessage(response, '*');
          });
        }
      }
      window.addEventListener('message', receiveMagicCodeMessage, false);

      chrome.storage.local.get('userid').then((response) => {
        if (response.userid) {
          const elemDiv = document.createElement('div');
          elemDiv.id = 'adblockUserId';
          elemDiv.innerText = response.userid;
          elemDiv.style.display = 'none';
          document.body.appendChild(elemDiv);
        }
      });
      const enableShowSurvey = document.getElementById('enable_show_survey');
      if (enableShowSurvey) {
        enableShowSurvey.onclick = function showSurvey() {
          BGcall('setSetting', 'show_survey', !enableShowSurvey.checked, true);
        };
      }
      const aaElements = document.querySelectorAll('#disableacceptableads');
      if (aaElements && aaElements.length) {
        for (let i = 0; i < aaElements.length; ++i) {
          aaElements[i].onclick = function unsubscribeAcceptableAds(event) {
            if (event.isTrusted === false) {
              return;
            }
            event.preventDefault();
            BGcall('unsubscribe', {
              id: 'acceptable_ads',
              del: false,
            }, () => {
              BGcall('recordGeneralMessage', 'disableacceptableads_clicked', undefined, undefined, () => {
                BGcall('openTab', 'options.html?aadisabled=true#general');
              });
            });
          };
        }
      }

      // Listen to clicks on 'Get Started With MyAdBlock' on v4 payment page
      const getStartedElements = document.querySelectorAll('.get-started-with-myadblock');
      if (getStartedElements && getStartedElements.length) {
        for (let i = 0; i < getStartedElements.length; ++i) {
          getStartedElements[i].onclick = function getStartedWithMyAdBlock(event) {
            if (event.isTrusted === false) {
              return;
            }
            event.stopImmediatePropagation();
            event.preventDefault();
            BGcall('openTab', 'options.html#mab');
          };
        }
      }
    },

    // The following Twitch-related code is used under the terms of the MIT license
    // from https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them
    twitch() {
      const tmuteVars = {
        // Checking rate of ad in progress (in ms ; EDITABLE)
        timerCheck: 1000,
        // Player muted or not
        playerMuted: false,
        // Number of ads displayed
        adsDisplayed: 0,
        // Disable the player display during an ad (true = yes, false = no (default) ; EDITABLE)
        disableDisplay: true,
        // Used to check if the player is muted at the start of an ad
        alreadyMuted: false,
        // Used to check if Twitch forgot to remove the ad notice
        adElapsedTime: undefined,
        // Unlock the player if this amount of seconds elapsed during an ad (EDITABLE)
        adUnlockAt: 150,
        // Minimum amount of seconds the player will be muted/hidden since an ad started
        // (EDITABLE ; Recommended to really avoid any ad: 30 to 45)
        adMinTime: 15,
        // Either the current page is a squad page or not
        squadPage: false,
        // Player ID where ads may be displayed (on squads page it's the last id instead of 0)
        playerIdAds: 0,
        // Either ads options are currently displayed or not
        displayingOptions: false,
      };

      // (un)Mute Player
      function mutePlayer() {
        const buttonVolume = document.getElementsByClassName('player-button--volume');
        const playerVideo = document.getElementsByClassName('player-video');
        if (buttonVolume.length >= 1) {
          if (tmuteVars.alreadyMuted === false) {
            buttonVolume[tmuteVars.playerIdAds].click();
          } // If the player is already muted before an ad, we avoid to unmute it.
          tmuteVars.playerMuted = !(tmuteVars.playerMuted);

          if (tmuteVars.playerMuted === true) {
            tmuteVars.adsDisplayed += 1;
            tmuteVars.adElapsedTime = 1;
            if (tmuteVars.disableDisplay === true) {
              playerVideo[tmuteVars.playerIdAds].style.visibility = 'hidden';
            }
          } else {
            tmuteVars.adElapsedTime = undefined;
            if (tmuteVars.disableDisplay === true) {
              playerVideo[tmuteVars.playerIdAds].style.visibility = 'visible';
            }
          }
        }
      }

      // Manage ads options
      function adsOptions(changeType = 'show') {
        const optionsTemplate = document.createElement('div');
        const advert = document.getElementsByClassName('player-ad-notice');
        const tmadsDisplay = document.getElementById('_tmads_display');
        const tmadsShowOptions = document.getElementById('_tmads_showoptions');
        const tmadsUnlock = document.getElementById('_tmads_unlock');
        const tmadsDisplayText = tmuteVars.disableDisplay === true ? 'Show' : 'Hide';
        const viewerWrappers = document.getElementsByClassName('channel-info-bar__viewers-wrapper');
        const channelContainer = document.getElementsByClassName('squad-stream-top-bar__container');
        const tmuteDisplayCSS = (tmuteVars.displayingOptions === false) ? 'none' : 'inline-block';

        switch (changeType) {
          // Manage player display during an ad (either hiding the ads or still showing them)
          case 'display':
            tmuteVars.disableDisplay = !(tmuteVars.disableDisplay);
            // Update the player display if an ad is supposedly in progress
            if (tmuteVars.playerMuted === true) {
              const playerVideos = document.getElementsByClassName('player-video');
              const cssDisplayRule = (tmuteVars.disableDisplay === true) ? 'hidden' : 'visible';
              playerVideos[tmuteVars.playerIdAds].style.visibility = cssDisplayRule;
            }
            tmadsDisplay.innerText = `${tmadsDisplayText} player during ads`;
            break;
          // Force a player unlock if Twitch didn't remove the ad notice properly
          // instead of waiting the auto unlock
          case 'unlock':
            if (tmuteVars.adElapsedTime !== undefined || advert[0] !== undefined) {
              // We set the elapsed time to the unlock timer to trigger it during the next check.
              tmuteVars.adElapsedTime = tmuteVars.adUnlockAt;
            }
            break;
          // Display the ads options button
          case 'init':
            if (viewerWrappers[0] === undefined && channelContainer[0] === undefined) {
              break;
            }

            // Append ads options and events related
            optionsTemplate.id = '_tmads_options-wrapper';
            optionsTemplate.className = 'tw-mg-r-1';
            // eslint-disable-next-line no-unsanitized/property
            optionsTemplate.innerHTML = `
            <span id="_tmads_options" style="display: none;">
              <button type="button" id="_tmads_unlock"
                style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;"
                class="tw-interactive tw-button-icon tw-button-icon--hollow">
                  Unlock player
              </button>
              <button type="button" id="_tmads_display"
                style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;"
                class="tw-interactive tw-button-icon tw-button-icon--hollow">
                  ${tmadsDisplayText} player during ads
              </button>
            </span>
            <button type="button" id="_tmads_showoptions"
              style="padding: 0 2px 0 2px; margin-left: 2px; height: 30px;"
              class="tw-interactive tw-button-icon tw-button-icon--hollow">
                Ads Options
            </button>`;

            // Normal player page
            if (viewerWrappers[0] !== undefined) {
              tmuteVars.squadPage = false;
              tmuteVars.playerIdAds = 0;
              viewerWrappers[0].parentNode.parentNode.appendChild(optionsTemplate);
            // Squad page
            } else if (channelContainer[0] !== undefined) {
              tmuteVars.squadPage = true;
              tmuteVars.playerIdAds = 0;
              const totalPlayerVideos = document.getElementsByClassName('player-video').length;
              // Since the primary player is never at the same place, we've to find it.
              for (let i = 0; i < parseInt(totalPlayerVideos, 10); i++) {
                const containerClass = 'multi-stream-player-layout__player-container';
                const primaryClass = 'multi-stream-player-layout__player-primary';
                const multiStream = document.getElementsByClassName(containerClass);
                if (multiStream[0].childNodes[i].classList.contains(primaryClass)) {
                  tmuteVars.playerIdAds = i;
                  break;
                }
              }
              channelContainer[0].appendChild(optionsTemplate);
            }

            tmadsShowOptions.addEventListener('click', adsOptions, false);
            tmadsDisplay.addEventListener('click', () => {
              adsOptions('display');
            }, false);
            tmadsUnlock.addEventListener('click', () => {
              adsOptions('unlock');
            }, false);

            break;
          // Display/Hide the ads options
          case 'show':
          default:
            tmuteVars.displayingOptions = !(tmuteVars.displayingOptions);
            document.getElementById('_tmads_options').style.display = tmuteDisplayCSS;
        }
      }

      // Check if there's an ad
      function checkAd() {
        const isViewing = Boolean(document.getElementsByClassName('player-video').length);
        if (isViewing === false) {
          return;
        }

        // Initialize the ads options if necessary.
        const optionsInitialized = document.getElementById('_tmads_options') !== null;
        if (optionsInitialized === false) {
          adsOptions('init');
        }

        const advert = document.getElementsByClassName('player-ad-notice');

        if (tmuteVars.adElapsedTime !== undefined) {
          tmuteVars.adElapsedTime += 1;
          if (tmuteVars.adElapsedTime >= tmuteVars.adUnlockAt && advert[0] !== undefined) {
            advert[0].parentNode.removeChild(advert[0]);
          }
        }

        if ((advert.length >= 1 && tmuteVars.playerMuted === false)
          || (tmuteVars.playerMuted === true && advert.length === 0)) {
          // Update at the start of an ad if the player is already muted or not
          if (advert.length >= 1) {
            const playerVolume = document.getElementsByClassName('player-button--volume');
            const playerVolumeFirstChild = playerVolume[tmuteVars.playerIdAds].childNodes[0];
            tmuteVars.alreadyMuted = Boolean(playerVolumeFirstChild.className === 'unmute-button');
          }

          // Keep the player muted/hidden for the minimum ad time set
          // (Twitch started to remove the ad notice before the end of some ads)
          if (advert.length === 0 && tmuteVars.adElapsedTime !== undefined
            && tmuteVars.adElapsedTime < tmuteVars.adMinTime) {
            return;
          }

          mutePlayer();
        }
      }

      BGcall('getSettings', (settings) => {
        if (settings.twitch_hiding) {
          // Start the background check
          tmuteVars.autoCheck = setInterval(checkAd, tmuteVars.timerCheck);
        }
      });
    },
  }; // end bandaids

  if (applyBandaidFor) {
    bandaids[applyBandaidFor]();
  }
};
