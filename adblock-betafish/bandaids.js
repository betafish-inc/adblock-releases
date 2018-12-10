
// PornHub - related code in this file based on code from uBlockOrigin GPLv3.
// and available at https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
// and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt

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

    var scriptText = [];
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
    // Twitch - related code below is based on code from uBlockOrigin GPLv3.
    // and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt
    // and https://gist.githubusercontent.com/gorhill/a47fe36d5f3da185f8c4d44d18ee022d/raw/911466e5d255a081c7126392186bf1a08ee85d4c/gistfile1.txt
    //
    } else if ( /(^|\.)twitch\.tv$/.test(hostname) === true) {
          var ourMediaPlayer;
      	Object.defineProperty(window, 'MediaPlayer', {
      		set: function(newMediaPlayer) {
      			if ( ourMediaPlayer !== undefined ) { return; }
      			var oldLoad = newMediaPlayer.MediaPlayer.prototype.load;
      			newMediaPlayer.MediaPlayer.prototype.load = function(e) {
      				try {
      					if ( e.startsWith('https://usher.ttvnw.net/api/channel/hls/') ) {
      						var url = new URL(e);
      						url.searchParams.delete('baking_bread');
      						url.searchParams.delete('baking_brownies');
      						url.searchParams.delete('baking_brownies_timeout');
      						e = url.href;
      					}
      				} catch (err) {
      					//console.error('Failed to bypass Twitch livestream ad');
      				}
      				return oldLoad.call(this, e);
      			};
      			ourMediaPlayer = newMediaPlayer;
      		},
      		get: function() {
      			return ourMediaPlayer;
      		}
      	});
      	var realFetch = window.fetch;
      	window.fetch = function(input, init) {
      		if (arguments.length >= 2 && typeof input === "string" && input.includes("/access_token"))
      		{
      			var url = new URL(arguments[0]);
      			url.searchParams.delete('player_type');
      			arguments[0] = url.href;
      		}
      		return realFetch.apply(this, arguments);
      	};
    }
    if ( scriptText.length === 0 ) { return; }

    scriptText.push('(' + cleanup.toString() + ')();');
    var elem = document.createElement('script');
    elem.appendChild(document.createTextNode(scriptText.join('\n')));
    try {
        (document.head || document.documentElement).appendChild(elem);
    } catch(ex) {
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
                BGcall("openTab", "options.html?tab=0&aadisabled=true");
              });
            });
          }
        }
      }
    }
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
