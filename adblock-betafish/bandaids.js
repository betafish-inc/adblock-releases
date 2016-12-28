// instartLogicBusterV1 & instartLogicBusterV2 in this file based on code from uBO-Extra GPLv3.
// https://github.com/gorhill/uBO-Extra/blob/master/contentscript.js
//
// PornHub - related code in this file based on code from uBlockOrigin GPLv3.
// and available at https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
// and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt


var scriptlets = [];
var isNotHTML = function() {
    'use strict';

    var doc = document;
    if ( doc instanceof HTMLDocument === false ) {
        if (
            doc instanceof XMLDocument === false ||
            doc.createElement('div') instanceof HTMLDivElement === false
        ) {
            return true;
        }
    }
    if ( (doc.contentType || '').lastIndexOf('image/', 0) === 0 ) {
        return true;
    }
    return false;
};

/*******************************************************************************
    Instart Logic buster v1
    https://github.com/uBlockOrigin/uAssets/issues/227
**/

var instartLogicBusterV1 = function() {
        var magic = String.fromCharCode(Date.now() % 26 + 97) +
                    Math.floor(Math.random() * 982451653 + 982451653).toString(36);
        Object.defineProperty(window, 'I10C', {
            set: function() {
                throw new Error(magic);
            }
        });
        var oe = window.error;
        window.onerror = function(msg, src, line, col, error) {
            if ( msg.indexOf(magic) !== -1 ) {
                return true;
            }
            if ( oe instanceof Function ) {
                return oe(msg, src, line, col, error);
            }
        }.bind();
};

/*******************************************************************************
    Instart Logic buster: v2
    https://github.com/uBlockOrigin/uAssets/issues/227#issuecomment-268409666
**/

var instartLogicBusterV2 = function() {
        var magic = String.fromCharCode(Date.now() % 26 + 97) +
                    Math.floor(Math.random() * 982451653 + 982451653).toString(36);
        window.I10C = new Proxy({}, {
            get: function(target, name) {
                switch ( name ) {
                case 'CanRun':
                    return function() {
                        return false;
                    };
                case 'HtmlStreaming':
                    return {
                        InsertTags: function(a, b) {
                            document.write(b);
                        },
                        InterceptNode: function() {
                        },
                        PatchBegin: function() {
                        },
                        PatchEnd: function() {
                        },
                        PatchInit: function() {
                        },
                        ReloadWithNoHtmlStreaming: function() {
                        },
                        RemoveTags: function() {
                        },
                        UpdateAttributes: function() {
                        }
                    };
                default:
                    if ( target[name] === undefined ) {
                        throw new Error(magic);
                    }
                    return target[name];
                }
            },
            set: function(target, name, value) {
                switch ( name ) {
                case 'CanRun':
                    break;
                default:
                    target[name] = value;
                }
            }
        });
        window.INSTART = new Proxy({}, {
            get: function(target, name) {
                switch ( name ) {
                case 'Init':
                    return function() {
                    };
                default:
                    if ( target[name] === undefined ) {
                        throw new Error(magic);
                    }
                    return target[name];
                }
            },
            set: function(target, name, value) {
                switch ( name ) {
                case 'Init':
                    break;
                default:
                    target[name] = value;
                }
            }
        });
        var oe = window.error;
        window.onerror = function(msg, src, line, col, error) {
            if ( msg.indexOf(magic) !== -1 ) {
                return true;
            }
            if ( oe instanceof Function ) {
                return oe(msg, src, line, col, error);
            }
        }.bind();
};

/*******************************************************************************
    Collate and add scriptlets to document.
**/

(function() {
    'use strict';
    var instartLogicBusterV1DomainsRegEx = new RegExp("(^|\.)(baltimoresun\.com|boston\.com|capitalgazette\.com|carrollcountytimes\.com|celebuzz\.com|chicagotribune\.com|courant\.com|dailypress\.com|deathandtaxesmag\.com|gamerevolution\.com|gofugyourself\.com|hearthhead\.com|infinitiev\.com|mcall\.com|nasdaq\.com|orlandosentinel\.com|ranker\.com|sandiegouniontribune\.com|saveur\.com|sherdog\.com|spin\.com|sporcle\.com|stereogum\.com|sun-sentinel\.com|thefrisky\.com|thesuperficial\.com|timeanddate\.com|tmn\.today|vancouversun\.com|vibe\.com|weather\.com|wowhead\.com)$");

    var instartLogicBusterV2DomainsRegEx = new RegExp("(^|\.)(calgaryherald\.com|edmontonjournal\.com|leaderpost\.com|montrealgazette\.com|ottawacitizen\.com|theprovince\.com|thestarphoenix\.com|windsorstar\.com)$");

    var scriptText = [];
    if (instartLogicBusterV1DomainsRegEx.test(window.location.hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV1.toString() + ')();');
    }
    if (instartLogicBusterV2DomainsRegEx.test(window.location.hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV2.toString() + ')();');
    }

    if ( scriptText.length === 0 ) { return; }

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };
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
  if (/facebook\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "facebook";
  }
  else if (/pornhub\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "pornhub";
  }
  else if (/mail\.live\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "hotmail";
  }
  else if (("getadblock.com" === document.location.hostname ||
            "dev.getadblock.com" === document.location.hostname) &&
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
  else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
  {
    apply_bandaid_for = "czech_sites";
  }
  else
  {
    var hosts = [/mastertoons\.com$/];
    hosts = hosts.filter(function(host)
    {
      return host.test(document.location.hostname);
    });
    if (hosts.length > 0)
    {
      apply_bandaid_for = "noblock";
    }
  }
  var bandaids = {
    noblock : function()
    {
      var styles = document.querySelectorAll("style");
      var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
      for (var i = 0; i < styles.length; i++)
      {
        var id = styles[i].innerText.match(re);
        if (id)
        {
          styles[i].innerText = '#' + id[1] + ' { display: none }';
        }
      }
    },
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
              BGcall("recordGeneralMessage", "disableacceptableads clicked", undefined, function()
              {
                BGcall("openTab", "options.html?tab=0&aadisabled=true");
              });
              // Rebuild the rules if running in Safari
              if (SAFARI)
              {
                // TODO: handle this background page call
                BGcall("update_subscriptions_now");
              }
            });
          }
        }
      }
    },
    czech_sites : function()
    {
      var player = document.getElementsByClassName("flowplayer");
      // Remove data-ad attribute from videoplayer
      if (player)
      {
        for (var i = 0; i < player.length; i++)
        {
          player[i].removeAttribute("data-ad");
        }
      }
    },
    pornhub: function() {
      (function() {
      	var w = window;
      	var count = Math.ceil(8+Math.random()*4);
      	var tomorrow = new Date(Date.now() + 86400);
      	var expire = tomorrow.toString();
      	document.cookie = 'FastPopSessionRequestNumber=' + count + '; expires=' + expire;
      	var db;
      	if ( (db = w.localStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      	if ( (db = w.sessionStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      })();
      (function() {
      	var removeAdFrames = function(aa) {
      		var el;
      		for ( var i = 0; i < aa.length; i++ ) {
      			el = document.getElementById(aa[i]);
      			if ( el !== null ) {
      				el.parentNode.removeChild(el);
      			}
      		}
      	};
      	Object.defineProperty(window, 'block_logic', {
      		get: function() { return removeAdFrames; },
      		set: function() {}
      	});
      })();
    },
    facebook: function() {
      // The following code is from :
      // https://greasyfork.org/en/scripts/22210-facebook-unsponsored
      var streamSelector = 'div[id^="topnews_main_stream"]';
      var storySelector = 'div[id^="hyperfeed_story_id"]';
      var sponsoredSelectors = [
          'a[href^="https://www.facebook.com/about/ads"]',
          'a[href^="https://www.facebook.com/ads/about"]',
          'a[href^="/about/ads"]',
          'a[href^="/ads/about"]'
      ];

      var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

      function block(story) {
          if(!story) {
              return;
          }

          var sponsored = false;
          for(var i = 0; i < sponsoredSelectors.length; i++) {
              if(story.querySelectorAll(sponsoredSelectors[i]).length) {
                  sponsored = true;
                  break;
              }
          }

          if(sponsored) {
              story.remove();
          }
      }

      function process() {
          // Locate the stream every iteration to allow for FB SPA navigation which
          // replaces the stream element
          var stream = document.querySelector(streamSelector);
          if(!stream) {
              return;
          }

          var stories = stream.querySelectorAll(storySelector);
          if(!stories.length) {
              return;
          }

          for(var i = 0; i < stories.length; i++) {
              block(stories[i]);
          }
      }

      var observer = new mutationObserver(process);
      observer.observe(document.querySelector('body'), {
          'childList': true,
          'subtree': true
      });
    }
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
