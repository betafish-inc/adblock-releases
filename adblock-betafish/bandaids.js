
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

// instartLogicBusterV1 consists of code borrowed from
// https://github.com/gorhill/uBO-Extra which is licensed
// under the GNU General Public License v3.0
var instartLogicBusterV1 = function() {
  (function() {
    var magic = String.fromCharCode(Date.now() % 26 + 97) +
                Math.floor(Math.random() * 982451653 + 982451653).toString(36),
        targets = [ 'atob', 'console.error', 'INSTART', 'INSTART_TARGET_NAME', 'performance', 'require' ],
        reScriptText = /\b(?:Instart-|I10C|IXC_|INSTART)/,
        reScriptSrc = /\babd.*?\/instart.js/;
    var validate = function() {
        var script = document.currentScript;
        if ( script instanceof HTMLScriptElement === false ) { return; }
        if ( script.src === '' ) {
            if ( reScriptText.test(script.textContent) ) {
                throw new ReferenceError(magic);
            }
        } else if ( reScriptSrc.test(script.src) ) {
            throw new ReferenceError(magic);
        }
    };
    var makeGetterSetter = function(owner, prop) {
        var value = owner[prop];
        return {
            get: function() {
                validate();
                return value;
            },
            set: function(a) {
                validate();
                value = a;
            }
        };
    };
    var i = targets.length,
        owner, target, chain, prop;
    while ( i-- ) {
        owner = window;
        target = targets[i];
        chain = target.split('.');
        for (;;) {
            prop = chain.shift();
            if ( chain.length === 0 ) { break; }
            owner = owner[prop];
        }
        Object.defineProperty(owner, prop, makeGetterSetter(owner, prop));
    }
    var oe = window.onerror;
    window.onerror = function(msg) {
        if ( typeof msg === 'string' && msg.indexOf(magic) !== -1 ) {
            return true;
        }
        if ( oe instanceof Function ) {
            return oe.apply(this, arguments);
        }
    }.bind();
  })();
};

// instartLogicBusterV2 consists of code borrowed from
// https://github.com/gorhill/uBO-Extra which is licensed
// under the GNU General Public License v3.0
var instartLogicBusterV2 = function() {
  (function(){
    var magic = String.fromCharCode(Date.now() % 26 + 97) +
                Math.floor(Math.random() * 982451653 + 982451653).toString(36);
    var makeNanovisorProxy = function() {
        return new Proxy({}, {
            get: function(target, name) {
                switch ( name ) {
                case 'HtmlStreaming':
                    return {
                        InsertTags: function(a, b) {
                            document.write(b); // jshint ignore:line
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
                            window.location.reload(true);
                        },
                        RemoveTags: function() {
                        },
                        UpdateAttributes: function() {
                        }
                    };
                default:
                    return target[name];
                }
            },
            set: function(target, name, value) {
                switch ( name ) {
                case 'CanRun':
                    target.CanRun = function() {
                        return false;
                    };
                    break;
                default:
                    target[name] = value;
                }
            }
        });
    };
    var instartInit;
    window.I10C = window.I11C = makeNanovisorProxy();
    window.INSTART = new Proxy({}, {
        get: function(target, name) {
            switch ( name ) {
            case 'Init':
                return function(a) {
                    if (
                        a instanceof Object &&
                        typeof a.nanovisorGlobalNameSpace === 'string' &&
                        a.nanovisorGlobalNameSpace !== ''
                    ) {
                        window[a.nanovisorGlobalNameSpace] = makeNanovisorProxy();
                    }
                    a.enableHtmlStreaming = false;
                    a.enableQSCallDiffComputationConfig = false;
                    a.enableQuerySelectorMonitoring = false;
                    a.serveNanovisorSameDomain = false;
                    a.virtualDomains = 0;
                    a.virtualizeDomains = [];
                    instartInit(a);
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
                instartInit = value;
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
  })();
};

/*******************************************************************************
    Collate and add scriptlets to document.
**/

var instartLogicBusterV2DomainsRegEx = /(^|\.)(calgaryherald\.com|edmontonjournal\.com|edmunds\.com|financialpost\.com|leaderpost\.com|montrealgazette\.com|nationalpost\.com|ottawacitizen\.com|theprovince\.com|thestarphoenix\.com|windsorstar\.com)$/;

var instartLogicBusterV1DomainsRegEx = /(^|\.)(afterellen\.com|baltimoresun\.com|boston\.com|calgaryherald\.com|calgarysun\.com|capitalgazette\.com|carrollcountytimes\.com|cattime\.com|chicagotribune\.com|chowhound\.com|chroniclelive\.co\.uk|citypaper\.com|cnet\.com|comingsoon\.net|computershopper\.com|courant\.com|craveonline\.com|csgoutpost\.com|ctnow\.com|cycleworld\.com|dailydot\.com|dailypress\.com|dayzdb\.com|deathandtaxesmag\.com|delmartimes\.net|dogtime\.com|dotaoutpost\.com|download\.cnet\.com|edmontonjournal\.com|edmontonsun\.com|edmunds\.com|esohead\.com|everydayhealth\.com|everquest\.allakhazam\.com|extremetech\.com|fieldandstream\.com|financialpost\.com|focus\.de|gamerevolution\.com|geek\.com|gofugyourself\.com|growthspotter\.com|hearthhead\.com|hockeysfuture\.com|hoylosangeles\.com|ibtimes\.com|infinitiev\.com|lajollalight\.com|laptopmag\.com|leaderpost\.com|legacy\.com|lifewire\.com|livescience\.com|lolking\.net|mcall\.com|mamaslatinas\.com|metacritic\.com|metrolyrics\.com|mmo-champion\.com|momtastic\.com|montrealgazette\.com|msn\.com|musicfeeds\.com\.au|mustangandfords\.com|nasdaq\.com|nationalpost\.com|newsarama\.com|orlandosentinel\.com|ottawacitizen\.com|ottawasun\.com|pcmag\.com|playstationlifestyle\.net|popphoto\.com|popsci\.com|ranchosantafereview\.com|ranker\.com|realclearpolitics\.com|realitytea\.com|redeyechicago\.com|salon\.com|sandiegouniontribune\.com|saveur\.com|seattlepi\.com|sfgate\.com|sherdog\.com|slate\.com|slickdeals\.net|southflorida\.com|space\.com|spin\.com|sporcle\.com|sportingnews\.com|stereogum\.com|sun-sentinel\.com|superherohype\.com|tf2outpost\.com|thebalance\.com|thefashionspot\.com|theprovince\.com|thespruce\.com|thestarphoenix\.com|thoughtco\.com|timeanddate\.com|tomsguide\.com|tomsguide\.fr|tomshardware\.co\.uk|tomshardware\.com|tomshardware\.de|tomshardware\.fr|torontosun\.com|totalbeauty\.com|trustedreviews\.com|tv\.com|twincities\.com|vancouversun\.com|vibe\.com|washingtonpost\.com|wikia\.com|windsorstar\.com|winnipegsun\.com|wowhead\.com|wrestlezone\.com|zam\.com)$/;

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
    if (instartLogicBusterV2DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV2.toString() + ')();');
    }
    if (instartLogicBusterV1DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV1.toString() + ')();');
    }
    if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname) {
      chrome.storage.local.get('userid', function (response) {
        var adblock_user_id = response['userid'];
        var elem = document.createElement('script');
        var scriptToInject = '(' + getAdblockDomain.toString() + ')();' +
            '(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
            '(' + cleanup.toString() + ')();';
        elem.appendChild(document.createTextNode(scriptToInject));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
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
  if (/pornhub\.com/.test(document.location.hostname))
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
              BGcall("recordGeneralMessage", "disableacceptableads_clicked", undefined, undefined, function()
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
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
