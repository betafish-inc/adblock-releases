'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, adblock_installed, adblock_userid, adblock_version */

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

function receiveMessage(event) {
  if (
    event.data
    && event.origin === 'https://getadblock.com'
    && event.data.command === 'payment_success'
  ) {
    window.removeEventListener('message', receiveMessage);
    browser.runtime.sendMessage({ command: 'payment_success', version: 1 })
      .then((response) => {
        window.postMessage(response, '*');
      });
  }
}

(function onLoad() {
  if (abort) {
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

  if (
    (document.location.hostname === 'getadblock.com'
       || document.location.hostname === 'dev.getadblock.com'
       || document.location.hostname === 'dev1.getadblock.com'
       || document.location.hostname === 'dev2.getadblock.com')
      && window.top === window.self
  ) {
    window.addEventListener('message', receiveMessage, false);
    browser.storage.local.get('userid').then((response) => {
      let adblockUserId = response.userid;
      if (adblockUserId.match(invalidGUIDChars)) {
        adblockUserId = 'invalid';
      }
      const adblockVersion = browser.runtime.getManifest().version;
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
      browser.runtime.sendMessage({ command: 'addGABTabListeners' });
      const personalBtn = document.getElementById('personal-use');
      const enterpriseBtn = document.getElementById('enterprise-use');
      const buttonListener = function () {
        browser.runtime.sendMessage({ command: 'removeGABTabListeners', saveState: true });
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
      browser.storage.local.get('userid').then((response) => {
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
          browser.runtime.sendMessage({ command: 'setSetting', name: 'show_survey', isEnabled: !enableShowSurvey.checked });
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
            browser.runtime.sendMessage({ command: 'unsubscribe', id: 'acceptable_ads' }).then(() => {
              browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'disableacceptableads_clicked' }).then(() => {
                browser.runtime.sendMessage({ command: 'openTab', urlToOpen: 'options.html?aadisabled=true#general' });
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
            browser.runtime.sendMessage({ command: 'openTab', urlToOpen: 'options.html#mab' });
          };
        }
      }
    },

    // The following Twitch-related code inspired by:
    // https://greasyfork.org/en/scripts/371186-twitch-mute-ads-and-optionally-hide-them/code
    twitch() {
      const tmuteVars = {
        playerMuted: false,
        alreadyMuted: false,
        // Max time (in milliseconds) to mute/hide player
        adMaxTime: 150000,
        // Min time (in milliseconds) to mute/hide player
        adMinTime: 15000,
      };

      const unmuteLabels = ['Unmute (m)', 'Stummschalten aufheben (m)', 'Activar sonido (m)', "Réactiver l'audio (M)", 'Attiva audio (m)', '取消静音（m）', '取消靜音 (m)', 'ミュート解除（m）', 'Dempen opheffen (m)', 'Tirar do mudo (m)', 'Включить звук (m)', 'Slå på ljudet (m)'];
      let currentPlayer;
      let playerObserver;
      let maxTimeTimer;
      let titleObserver;
      let tmuteSelectors;

      // Toggle mute/hide status of player
      function mutePlayer() {
        const muteButton = document.querySelector(tmuteSelectors.muteButton);
        const playerVideo = document.querySelector(tmuteSelectors.playerVideo);
        const playerAd = document.querySelector(tmuteSelectors.playerAd);
        if (muteButton) {
          // if the player is muted before the ad started (by the user), don't mute/unmute
          if (tmuteVars.alreadyMuted === false) {
            muteButton.click();
          }
          tmuteVars.playerMuted = !tmuteVars.playerMuted;
          playerVideo.style.visibility = (tmuteVars.playerMuted === true) ? 'hidden' : 'visible';
          playerAd.style.visibility = (tmuteVars.playerMuted === true) ? 'hidden' : 'visible';
          return true;
        }
        return false;
      }

      function maxTimeElapsed() {
        const advert = document.querySelector(tmuteSelectors.adNotice);
        if (advert && advert.parentNode) {
          advert.parentNode.removeChild(advert);
        }
        mutePlayer();
      }

      function stopPlayerObserver() {
        playerObserver.disconnect();
      }

      function checkAd() {
        const advert = document.querySelector(tmuteSelectors.adNotice);
        if (advert && tmuteVars.playerMuted === false) {
          stopPlayerObserver();
          clearTimeout(maxTimeTimer);
          // eslint-disable-next-line no-use-before-define
          muteAndObservePlayer();
          return false;
        }
        if (!advert && tmuteVars.playerMuted === true) {
          clearTimeout(maxTimeTimer);
          mutePlayer();
        }
        return true;
      }

      function startPlayerObserver() {
        const overlayNode = document.querySelector(tmuteSelectors.overlay);
        const options = { childList: true };

        if (playerObserver === undefined) {
          playerObserver = new MutationObserver(checkAd);
        }
        playerObserver.observe(overlayNode, options);
      }

      function muteAndObservePlayer() {
        if (mutePlayer()) {
          setTimeout(() => {
            if (checkAd()) {
              startPlayerObserver();
            }
          }, tmuteVars.adMinTime);
          maxTimeTimer = setTimeout(maxTimeElapsed, tmuteVars.adMaxTime);
        }
      }

      function checkPlayer(retry = 0) {
        if (!currentPlayer) {
          currentPlayer = Boolean(document.querySelector(tmuteSelectors.player));

          if (!currentPlayer) {
            if (retry === 0) {
              setTimeout(() => {
                checkPlayer(1);
              }, 1000);
            }
            return;
          }
        } else if (!document.querySelector(tmuteSelectors.player)) {
          return;
        }

        // Check if player is already muted
        const muteButton = document.querySelector(tmuteSelectors.muteButton);
        tmuteVars.alreadyMuted = muteButton && unmuteLabels.includes(muteButton.getAttribute('aria-label'));
        if (tmuteVars.playerMuted === true) {
          tmuteVars.alreadyMuted = false;
        }

        const advert = document.querySelector(tmuteSelectors.adNotice);
        if (advert && tmuteVars.playerMuted === false) {
          muteAndObservePlayer();
        } else {
          startPlayerObserver();
        }
      }

      function startTitleObserver() {
        const titleNode = document.querySelector('title');
        const options = { childList: true };

        if (titleObserver === undefined) {
          titleObserver = new MutationObserver(checkPlayer);
        }
        titleObserver.observe(titleNode, options);
      }

      browser.runtime.sendMessage({ command: 'getTwitchSettings' }).then((settings) => {
        if (settings.twitchEnabled) {
          tmuteSelectors = settings.twitchSettings;
          checkPlayer();
          startTitleObserver();
        }
      });
    },
  }; // end bandaids

  if (applyBandaidFor) {
    bandaids[applyBandaidFor]();
  }
};
