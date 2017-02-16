// instartLogicBusterV1 & instartLogicBusterV2 in this file based on code from uBO-Extra GPLv3.
// https://github.com/gorhill/uBO-Extra/blob/master/contentscript.js
//
// PornHub - related code in this file based on code from uBlockOrigin GPLv3.
// and available at https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
// and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt


var scriptlets = [];

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

var instartLogicBusterV3 = function() {
  (function() {
    var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    var abCreateElement = document.createElement;
    document.createElement = function() {
      var args = Array.prototype.slice.call(arguments);
      if (args &&
          args.length &&
          typeof args[0] === "string" &&
          args[0].toUpperCase() === "IFRAME") {
        var result = abCreateElement.apply(this, args);
        var observer = new mutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.target.locat1on) {
              mutation.target.parentNode.removeChild(mutation.target);
            } else if (mutation.target &&
                       mutation.target.id &&
                       mutation.target.parentNode &&
                       (mutation.target.id.indexOf("ads") > -1 ||
                        mutation.target.id.indexOf("google") > -1 ||
                        mutation.target.id.indexOf("pfwidget") > -1 ||
                        mutation.target.id.indexOf("tead") > -1 ||
                        mutation.target.id.indexOf("express") > -1 ||
                        mutation.target.id.indexOf("zbi") > -1 ||
                        mutation.target.id.indexOf("fb_xdm_frame") > -1)) {
              mutation.target.parentNode.removeChild(mutation.target);
            } else if (mutation.target &&
                       mutation.target.parentNode &&
                       (mutation.target.class === "SYNAPIFR" ||
                        mutation.target.id === "SYNAPIFR")) {
              mutation.target.parentNode.removeChild(mutation.target);
            } else if (mutation.target &&
                       mutation.target.parentNode &&
                       mutation.target.parentNode.id &&
                       mutation.target.parentNode.id.indexOf("igloo") > -1) {
              mutation.target.parentNode.removeChild(mutation.target);
            }
          });
        });
        observer.observe(result, {
          'attributes': true
        });
        return result;
      } else {
        return abCreateElement.apply(this, args);
      }
    }
  })();
};


/*******************************************************************************
    Collate and add scriptlets to document.
**/

var instartLogicBusterV2DomainsRegEx = new RegExp("(^|\.)(calgaryherald\.com|edmontonjournal\.com|leaderpost\.com|montrealgazette\.com|ottawacitizen\.com|theprovince\.com|thestarphoenix\.com|windsorstar\.com)$");

var instartLogicBusterV3DomainsRegEx = new RegExp("(^|\.)(baltimoresun\.com|boston\.com|chicagotribune\.com|capitalgazette\.com|carrollcountytimes\.com|celebuzz\.com|chicagotribune\.com|courant\.com|dailypress\.com|deathandtaxesmag\.com|gamerevolution\.com|gofugyourself\.com|hearthhead\.com|mcall\.com|nasdaq\.com|orlandosentinel\.com|sandiegouniontribune\.com|saveur\.com|sherdog\.com|spin\.com|sporcle\.com|stereogum\.com|sun-sentinel\.com|thefrisky\.com|thesuperficial\.com|timeanddate\.com|tmn\.today|vancouversun\.com|vibe\.com|weather\.com|wowhead\.com)$");


(function() {
    'use strict';

    var scriptText = [];
    if (instartLogicBusterV2DomainsRegEx.test(window.location.hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV2.toString() + ')();');
    }
    if (instartLogicBusterV3DomainsRegEx.test(window.location.hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV3.toString() + ')();');
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
      var searchedNodes = [{
          'selector': '.fbUserContent div > span > a:not([title]):not([role]):not(.UFICommentActorName):not(.uiLinkSubtle):not(.profileLink)',
          'content': {
              'af':      ['Geborg'],
              'ar':      ['إعلان مُموَّل'],
              'as':      ['পৃষ্ঠপোষকতা কৰা'],
              'ay':      ['Yatiyanaka'],
              'az':      ['Sponsor dəstəkli'],
              'be':      ['Рэклама'],
              'br':      ['Paeroniet'],
              'bs':      ['Sponzorirano'],
              'bn':      ['সৌজন্যে'],
              'ca':      ['Patrocinat'],
              'co':      ['Spunsurizatu'],
              'cs':      ['Sponzorováno'],
              'cx':      ['Giisponsoran'],
              'cy':      ['Noddwyd'],
              'de':      ['Gesponsert'],
              'el':      ['Χορηγούμενη'],
              'en':      ['Sponsored'],
              'es':      ['Publicidad', 'Patrocinado'],
              'fr':      ['Commandité', 'Sponsorisé'],
              'gx':      ['Χορηγούμενον'],
              'hi':      ['प्रायोजित'],
              'id':      ['Bersponsor'],
              'it':      ['Sponsorizzata'],
              'ja':      ['広告'],
              'jv':      ['Disponsori'],
              'kk':      ['Демеушілік көрсеткен'],
              'km':      ['បានឧបត្ថម្ភ'],
              'lo':      ['ໄດ້ຮັບການສະໜັບສະໜູນ'],
              'ml':      ['സ്പോൺസർ ചെയ്തത്'],
              'mr':      ['प्रायोजित'],
              'ms':      ['Ditaja'],
              'ne':      ['प्रायोजित'],
              'or':      ['ପ୍ରଯୋଜିତ'],
              'pa':      ['ਸਰਪ੍ਰਸਤੀ ਪ੍ਰਾਪਤ'],
              'pl':      ['Sponsorowane'],
              'pt':      ['Patrocinado'],
              'ru':      ['Реклама'],
              'sa':      ['प्रायोजितः |'],
              'si':      ['අනුග්‍රහය දක්වන ලද'],
              'so':      ['La maalgeliyey'],
              'sv':      ['Sponsrad'],
              'te':      ['స్పాన్సర్ చేసినవి'],
              'tr':      ['Sponsorlu'],
              'zh-Hans': ['赞助内容'],
              'zh-Hant': ['贊助']
          }
      }, {
          'selector': '.fbUserContent > div > div > span',
          'content': {
              'af':        ['Voorgestelde Plasing'],
              'ar':        ['منشور مقترح'],
              'as':        ['পৰামৰ্শিত প\'ষ্ট'],
              'az':        ['Təklif edilən yazılar'],
              'be':        ['Прапанаваны допіс'],
              'bn':        ['প্রস্তাবিত পোস্ট'],
              'br':        ['Embannadenn aliet'],
              'bs':        ['Predloženi sadržaj'],
              'ca':        ['Publicació suggerida'],
              'co':        ['Posti cunsigliati'],
              'cs':        ['Navrhovaný příspěvek'],
              'cx':        ['Gisugyot nga Pagpatik'],
              'cy':        ['Neges a Awgrymir'],
              'de':        ['Vorgeschlagener Beitrag'],
              'el':        ['Προτεινόμενη δημοσίευση'],
              'en':        ['Suggested Post'],
              'es':        ['Publicación sugerida'],
              'fr':        ['Publication suggérée'],
              'gx':        ['Παϱαινουμένη Ἔκϑεσις'],
              'hi':        ['सुझाई गई पोस्ट'],
              'it':        ['Post consigliato'],
              'id':        ['Saran Kiriman'],
              'ja':        ['おすすめの投稿'],
              'jv':        ['Kiriman sing Disaranake'],
              'kk':        ['Ұсынылған жазба'],
              'km':        ['ការប្រកាសដែលបានណែនាំ'],
              'ko':        ['추천 게시물'],
              'lo':        ['ໂພສຕ໌ແນະນຳ'],
              'ml':        ['നിർദ്ദേശിച്ച പോ‌സ്റ്റ്'],
              'mr':        ['सुचवलेली पोस्ट'],
              'ms':        ['Kiriman Dicadangkan'],
              'ne':        ['सुझाव गरिएको पोस्ट'],
              'or':        ['ପ୍ରସ୍ତାବିତ ପୋଷ୍ଟ'],
              'pa':        ['ਸੁਝਾਈ ਗਈ ਪੋਸਟ'],
              'pl':        ['Proponowany post'],
              'pt':        ['Publicação sugerida'],
              'ru':        ['Рекомендуемая публикация'],
              'sa':        ['उपॆक्षित प्रकटनं'],
              'si':        ['යෝජිත පළ කිරීම'],
              'so':        ['Bandhig la soo jeediye'],
              'sv':        ['Föreslaget inlägg'],
              'te':        ['సూచింపబడిన పోస్ట్'],
              'tr':        ['Önerilen Gönderiler', 'Önerilen Gönderi'],
              'zh-Hans':   ['推荐帖子'],
              'zh-Hant':   ['推薦帖子', '推薦貼文']
          }
      }, {
          'selector': '.fbUserContent > div > div > div:not(.userContent)',
          'exclude': function(node) {
              if(!node) {
                  return true;
              }

              return (node.children && node.children.length);
          },
          'content': {
              'af':        ['Popular Live Video'],
              'ar':        ['مباشر رائج'],
              'as':        ['Popular Live Video'],
              'az':        ['Popular Live Video'],
              'bn':        ['জনপ্রিয় লাইভ ভিডিও'],
              'br':        ['Video Siaran Langsung Populer'],
              'bs':        ['Video Siaran Langsung Populer'],
              'ca':        ['Video Siaran Langsung Populer'],
              'cs':        ['Populární živé vysílání'],
              'de':        ['Beliebtes Live-Video'],
              'en':        ['Popular Live Video'],
              'es':        ['Vídeo en directo popular'],
              'fr':        ['Vidéo en direct populaire'],
              'hi':        ['लोकप्रिय लाइव वीडियो'],
              'it':        ['Video in diretta popolare'],
              'id':        ['Video Siaran Langsung Populer'],
              'ja':        ['人気ライブ動画'],
              'jv':        ['Video Siaran Langsung Populer'],
              'kk':        ['Popular Live Video'],
              'km':        ['Popular Live Video'],
              'ko':        ['인기 라이브 방송'],
              'lo':        ['Popular Live Video'],
              'ml':        ['ജനപ്രിയ Live വീഡിയോ'],
              'mr':        ['प्रसिद्ध थेट व्हिडिओ'],
              'ms':        ['Video Live Popular'],
              'ne':        ['Popular Live Video'],
              'or':        ['Popular Live Video'],
              'pa':        ['ਪ੍ਰਸਿੱਧ ਲਾਈਵ ਵੀਡੀਓਜ਼'],
              'pl':        ['Popularna transmisja wideo na żywo'],
              'pt':        ['Vídeo em direto popular', 'Vídeo ao vivo popular'],
              'ru':        ['Популярный прямой эфир'],
              'sa':        ['Popular Live Video'],
              'si':        ['Popular Live Video'],
              'so':        ['Popular Live Video'],
              'te':        ['ప్రసిద్ధ ప్రత్యక్ష ప్రసార వీడియో'],
              'tr':        ['Popular Live Video'],
              'zh-Hans':   ['热门直播视频'],
              'zh-Hant':   ['熱門直播視訊', '熱門直播視像']
          }
      }];

      var language = document.documentElement.lang;
      var nodeContentKey = (('innerText' in document.documentElement) ? 'innerText' : 'textContent');
      var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

      // Default to 'en' when the current language isn't yet supported
      var i;
      for(i = 0; i < searchedNodes.length; i++) {
          if(searchedNodes[i].content[language]) {
              searchedNodes[i].content = searchedNodes[i].content[language];
          }
          else {
              searchedNodes[i].content = searchedNodes[i].content.en;
          }
      }

      var body;
      var stream;
      var observer;

      function block(story) {
          if(!story) {
              return;
          }

          story.remove();
      }

      function isSponsored(story) {
          if(!story) {
              return false;
          }

          var nodes;
          var nodeContent;

          var h;
          var i;
          var j;
          for(h = 0; h < searchedNodes.length; h++) {
              nodes = story.querySelectorAll(searchedNodes[h].selector);
              for(i = 0; i < nodes.length; i++) {
                  nodeContent = nodes[i][nodeContentKey];
                  if(nodeContent) {
                      for(j = 0; j < searchedNodes[h].content.length; j++) {
                          if(searchedNodes[h].exclude && searchedNodes[h].exclude(nodes[i])) {
                             continue;
                          }

                          if(nodeContent.trim() == searchedNodes[h].content[j]) {
                              return true;
                          }
                      }
                  }
              }
          }

          return false;
      }

      function process() {
          // Locate the stream every iteration to allow for FB SPA navigation which
          // replaces the stream element
          stream = document.querySelector(streamSelector);
          if(!stream) {
              return;
          }

          var stories = stream.querySelectorAll(storySelector);
          if(!stories.length) {
              return;
          }

          var i;
          for(i = 0; i < stories.length; i++) {
              if(isSponsored(stories[i])) {
                  block(stories[i]);
              }
          }
      }

      if(mutationObserver) {
          body = document.querySelector('body');
          if(!body) {
              return;
          }

          observer = new mutationObserver(process);
          observer.observe(body, {
              'childList': true,
              'subtree': true
          });
      }
    },
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
