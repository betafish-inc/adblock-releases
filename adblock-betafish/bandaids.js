
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

var instartLogicBusterV3 = function() {
  (function() {
    document.cookie = "morphi10c=1;max-age=86400";
    var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    DOMParser.prototype.parseFromString = function() { };
    document.createRange = function() { };
    var abCreateElement = document.createElement;
    var abCreateElementNS = document.createElementNS;
    var addEmptyAccessors = function(newElement, args) {
      var abAddEventListener = newElement.addEventListener;
      newElement.addEventListener = function() {
        var eventArgs = Array.prototype.slice.call(arguments);
        if (eventArgs &&
            eventArgs.length &&
            typeof eventArgs[0] === "string" &&
            (eventArgs[0].toUpperCase() !== "ERROR")) {
          abAddEventListener.apply(this, eventArgs);
        }
      };
    };
    var addObserver = function(newElement) {
        var observer = new mutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.target &&
                       mutation.target.id &&
                       mutation.target.parentNode &&
                       (mutation.target.id.indexOf("_ads") > -1 ||
                        mutation.target.id.indexOf("google") > -1 ||
                        mutation.target.id.indexOf("zbi") > -1 ||
                        mutation.target.id.indexOf("fb_xdm_frame") > -1)) {
              mutation.target.parentNode.removeChild(mutation.target);
            }
          });
        });
        observer.observe(newElement, {
          'attributes': true
        });
    };
    var checkIfFrame = function(newElement, args) {
      if (args &&
          args.length &&
          typeof args[0] === "string" &&
          (args[0].toUpperCase() === "IFRAME" ||
           args[0].toUpperCase() === "DIV")) {
        addObserver(newElement);
      }
      if (args &&
          args.length > 1 &&
          typeof args[1] === "string" &&
          (args[1].toUpperCase() === "IFRAME" ||
           args[1].toUpperCase() === "DIV")) {
        addObserver(newElement);
      }
    };
    document.createElement = function() {
      var args = Array.prototype.slice.call(arguments);
      var newElement = abCreateElement.apply(this, args);
      addEmptyAccessors(newElement, args);
      checkIfFrame(newElement, args);
      return newElement;
    };
    document.createElementNS = function() {
      var args = Array.prototype.slice.call(arguments);
      var newElement = abCreateElementNS.apply(this, args);
      addEmptyAccessors(newElement, args);
      checkIfFrame(newElement, args);
      return newElement;
    };
  })();
};

var instartLogicBusterV2DomainsRegEx = /(^|\.)(calgaryherald\.com|edmontonjournal\.com|edmunds\.com|financialpost\.com|leaderpost\.com|montrealgazette\.com|nationalpost\.com|ottawacitizen\.com|theprovince\.com|thestarphoenix\.com|windsorstar.com)$/;

var instartLogicBusterV1DomainsRegEx = /(^|\.)(baltimoresun\.com|boston\.com|capitalgazette\.com|carrollcountytimes\.com|celebuzz\.com|celebslam\.com|chicagotribune\.com|computershopper\.com|courant\.com|dailypress\.com|deathandtaxesmag\.com|extremetech\.com|gamerevolution\.com|geek\.com|gofugyourself\.com|hearthhead\.com|infinitiev\.com|lolking.net|mcall\.com|mmo-champion\.com|nasdaq\.com|orlandosentinel\.com|pcmag\.com|ranker\.com|sandiegouniontribune\.com|saveur\.com|sherdog\.com|\.spin\.com|sporcle\.com|stereogum\.com|sun-sentinel\.com|thefrisky\.com|thesuperficial\.com|timeanddate\.com|tmn\.today|twincities\.com|vancouversun\.com|vibe\.com|weather\.com)$/;

var getAdblockDomain = function() {
  adblock_installed = true;
};

var getAdblockDomainWithUserID = function(userid) {
  adblock_userid = userid;
};

(function() {
    'use strict';

    if ( abort ) {
      return;
    }

    // Only for dynamically created frames and http/https documents.
    if ( /^(https?:|about:)/.test(window.location.protocol) !== true ) {
      return;
    }

    // https://bugs.chromium.org/p/chromium/issues/detail?id=129353
    // Trap calls to WebSocket constructor, and expose websocket-based network
    // requests to AdBlock

    // Fix won't be applied on older versions of Chromium.
    if ( window.WebSocket instanceof Function === false ) {
      return;
    }

    var doc = document;
    var parent = doc.head || doc.documentElement;
    if ( parent === null ) {
      return;
    }

    var scriptText = [];

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };

    if (instartLogicBusterV2DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV3.toString() + ')();');
    }
    else if (instartLogicBusterV1DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV3.toString() + ')();');
    }
    else if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname) {
      scriptText.push('(' + getAdblockDomain.toString() + ')();');
      chrome.storage.local.get('userid', function (response) {
        var adblock_user_id = response['userid'];
        var elem = document.createElement('script');
        var scriptToInject = '(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
        '(' + cleanup.toString() + ')();';
        elem.appendChild(document.createTextNode(scriptToInject));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
      return;
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
      var storySelectors = [
          'div[id^="hyperfeed_story_id"]',
          'div[data-ownerid^="hyperfeed_story_id"]'
      ];
      var searchedNodes = [{
          // Sponsored
          'selector': [
              '.fbUserPost span > div > a:not([title]):not([role]):not(.UFICommentActorName):not(.uiLinkSubtle):not(.profileLink)',
              '.fbUserStory span > div > a:not([title]):not([role]):not(.UFICommentActorName):not(.uiLinkSubtle):not(.profileLink)',
              '.fbUserContent span > div > a:not([title]):not([role]):not(.UFICommentActorName):not(.uiLinkSubtle):not(.profileLink)'
          ],
          'content': {
              'af':      ['Geborg'],
              'am':      ['የተከፈለበት ማስታወቂያ'],
              'ar':      ['إعلان مُموَّل'],
              'as':      ['পৃষ্ঠপোষকতা কৰা'],
              'ay':      ['Yatiyanaka'],
              'az':      ['Sponsor dəstəkli'],
              'be':      ['Рэклама'],
              'bg':      ['Спонсорирано'],
              'br':      ['Paeroniet'],
              'bs':      ['Sponzorirano'],
              'bn':      ['সৌজন্যে'],
              'ca':      ['Patrocinat'],
              'cb':      ['پاڵپشتیکراو'],
              'co':      ['Spunsurizatu'],
              'cs':      ['Sponzorováno'],
              'cx':      ['Giisponsoran'],
              'cy':      ['Noddwyd'],
              'da':      ['Sponsoreret'],
              'de':      ['Gesponsert'],
              'el':      ['Χορηγούμενη'],
              'en':      ['Sponsored', 'Chartered'],
              'eo':      ['Reklamo'],
              'es':      ['Publicidad', 'Patrocinado'],
              'et':      ['Sponsitud'],
              'eu':      ['Babestua'],
              'fa':      ['دارای پشتیبانی مالی'],
              'fi':      ['Sponsoroitu'],
              'fo':      ['Stuðlað'],
              'fr':      ['Commandité', 'Sponsorisé'],
              'fy':      ['Sponsore'],
              'ga':      ['Urraithe'],
              'gl':      ['Patrocinado'],
              'gn':      ['Oñepatrosinapyre'],
              'gx':      ['Χορηγούμενον'],
              'hi':      ['प्रायोजित'],
              'hu':      ['Hirdetés'],
              'id':      ['Bersponsor'],
              'it':      ['Sponsorizzata'],
              'ja':      ['広告'],
              'jv':      ['Disponsori'],
              'kk':      ['Демеушілік көрсеткен'],
              'km':      ['បានឧបត្ថម្ភ'],
              'lo':      ['ໄດ້ຮັບການສະໜັບສະໜູນ'],
              'mk':      ['Спонзорирано'],
              'ml':      ['സ്പോൺസർ ചെയ്തത്'],
              'mn':      ['Ивээн тэтгэсэн'],
              'mr':      ['प्रायोजित'],
              'ms':      ['Ditaja'],
              'ne':      ['प्रायोजित'],
              'nl':      ['Gesponsord'],
              'or':      ['ପ୍ରଯୋଜିତ'],
              'pa':      ['ਸਰਪ੍ਰਸਤੀ ਪ੍ਰਾਪਤ'],
              'pl':      ['Sponsorowane'],
              'ps':      ['تمويل شوي'],
              'pt':      ['Patrocinado'],
              'ru':      ['Реклама'],
              'sa':      ['प्रायोजितः |'],
              'si':      ['අනුග්‍රහය දක්වන ලද'],
              'so':      ['La maalgeliyey'],
              'sv':      ['Sponsrad'],
              'te':      ['స్పాన్సర్ చేసినవి'],
              'th':      ['ได้รับการสนับสนุน'],
              'tl':      ['May Sponsor'],
              'tr':      ['Sponsorlu'],
              'tz':      ['ⵉⴷⵍ'],
              'uk':      ['Реклама'],
              'ur':      ['تعاون کردہ'],
              'vi':      ['Được tài trợ'],
              'zh-Hans': ['赞助内容'],
              'zh-Hant': ['贊助']
          }
      }, {
          // Suggested Post
          'selector': [
              '.fbUserPost div > div > span > span',
              '.fbUserStory div > div > span > span',
              '.fbUserContent div > div > span > span'
          ],
          'content': {
              'af':        ['Voorgestelde Plasing'],
              'am':        ['የሚመከር ልጥፍ'],
              'ar':        ['منشور مقترح'],
              'as':        ['পৰামৰ্শিত প\'ষ্ট'],
              'az':        ['Təklif edilən yazılar'],
              'be':        ['Прапанаваны допіс'],
              'bg':        ['Предложена публикация'],
              'bn':        ['প্রস্তাবিত পোস্ট'],
              'br':        ['Embannadenn aliet'],
              'bs':        ['Predloženi sadržaj'],
              'ca':        ['Publicació suggerida'],
              'cb':        ['بابەتی پێشنیارکراو'],
              'co':        ['Posti cunsigliati'],
              'cs':        ['Navrhovaný příspěvek'],
              'cx':        ['Gisugyot nga Pagpatik'],
              'cy':        ['Neges a Awgrymir'],
              'da':        ['Foreslået opslag'],
              'de':        ['Vorgeschlagener Beitrag'],
              'el':        ['Προτεινόμενη δημοσίευση'],
              'en':        ['Suggested Post', 'Recommended fer ye eye'],
              'eo':        ['Proponita afiŝo'],
              'es':        ['Publicación sugerida'],
              'et':        ['Soovitatud postitus'],
              'eu':        ['Iradokitako argitalpena'],
              'fa':        ['پست پیشنهادی'],
              'fi':        ['Ehdotettu julkaisu'],
              'fo':        ['Viðmælt uppslag'],
              'fr':        ['Publication suggérée'],
              'fy':        ['Oanrikkemandearre berjocht'],
              'ga':        ['Postáil Mholta'],
              'gl':        ['Publicación suxerida'],
              'gn':        ['Ojeikuaaukáva iporãva ojehecha'],
              'gx':        ['Παϱαινουμένη Ἔκϑεσις'],
              'hi':        ['सुझाई गई पोस्ट'],
              'hu':        ['Ajánlott bejegyzés'],
              'it':        ['Post consigliato'],
              'id':        ['Saran Kiriman'],
              'ja':        ['おすすめの投稿'],
              'jv':        ['Kiriman sing Disaranake'],
              'kk':        ['Ұсынылған жазба'],
              'km':        ['ការប្រកាសដែលបានណែនាំ'],
              'ko':        ['추천 게시물'],
              'lo':        ['ໂພສຕ໌ແນະນຳ', 'ຜູ້ສະໜັບສະໜູນ'],
              'mk':        ['Предложена објава'],
              'ml':        ['നിർദ്ദേശിച്ച പോ‌സ്റ്റ്'],
              'mn':        ['Санал болгосон нийтлэл'],
              'mr':        ['सुचवलेली पोस्ट'],
              'ms':        ['Kiriman Dicadangkan'],
              'ne':        ['सुझाव गरिएको पोस्ट'],
              'nl':        ['Voorgesteld bericht'],
              'or':        ['ପ୍ରସ୍ତାବିତ ପୋଷ୍ଟ'],
              'pa':        ['ਸੁਝਾਈ ਗਈ ਪੋਸਟ'],
              'pl':        ['Proponowany post'],
              'ps':        ['وړاندیز شوې ځړونه'],
              'pt':        ['Publicação sugerida'],
              'ru':        ['Рекомендуемая публикация'],
              'sa':        ['उपॆक्षित प्रकटनं'],
              'si':        ['යෝජිත පළ කිරීම'],
              'so':        ['Bandhig la soo jeediye'],
              'sv':        ['Föreslaget inlägg'],
              'te':        ['సూచింపబడిన పోస్ట్'],
              'th':        ['โพสต์ที่แนะนำ'],
              'tl':        ['Iminungkahing Post'],
              'tr':        ['Önerilen Gönderiler', 'Önerilen Gönderi'],
              'tz':        ['ⵜⴰⵥⵕⵉⴳⵜ ⵉⵜⵜⵓⵙⵓⵎⵔⵏ'],
              'uk':        ['Рекомендований допис'],
              'ur':        ['تجویز کردہ مراسلہ'],
              'vi':        ['Bài viết được đề xuất'],
              'zh-Hans':   ['推荐帖子'],
              'zh-Hant':   ['推薦帖子', '推薦貼文']
          }
      }, {
          // Popular Live Video                                                      // A Video You May Like
          'selector': [
              '.fbUserPost div > div > div:not(.userContent)',
              '.fbUserStory div > div > div:not(.userContent)',
              '.fbUserContent div > div > div:not(.userContent)'
          ],
          'exclude': function(node) {
              if(!node) {
                  return true;
              }

              return (node.children && node.children.length);
          },
          'content': {
              'af':        ['Popular Live Video', 'Gewilde Live Video',              '\'n Video waarvan jy dalk sal hou'],
              'ar':        ['مباشر رائج'                                            ,'فيديو قد يعجبك'],
              'as':        ['Popular Live Video',                                    'আপুনি ভাল পাব পৰা এটা ভিডিঅ\''],
              'az':        ['Popular Live Video',                                    'Bu video sənin xoşuna gələ bilər'],
              'bg':        ['Популярно видео на живо',                               'Видео, което е възможно да харесате'],
              'bn':        ['জনপ্রিয় লাইভ ভিডিও',                                     'আপনার পছন্দ হতে পারে এমন একটি ভিডিও'],
              'br':        ['Video Siaran Langsung Populer',                         'Sebuah Video yang Mungkin Anda Suka'],
              'bs':        ['Video Siaran Langsung Populer',                         'Sebuah Video yang Mungkin Anda Suka'],
              'ca':        ['Video Siaran Langsung Populer',                         'Sebuah Video yang Mungkin Anda Suka'],
              'cs':        ['Populární živé vysílání',                               'Video, které by se vám mohlo líbit'],
              'cx':        ['Popular Live Video',                                    'Usa ka Video nga Mahimong Ganahan Ka'],
              'da':        ['Populær livevideo',                                     'En video, du måske vil synes godt om'],
              'de':        ['Beliebtes Live-Video',                                  'Ein Video, das dir gefallen könnte'],
              'en':        ['Popular Live Video',                                    'A Video You May Like'],
              'es':        ['Vídeo en directo popular', 'Video en vivo popular',     'Un video que te puede gustar', 'Un vídeo que te puede gustar'],
              'fi':        ['Suosittu live-video'],
              'fr':        ['Vidéo en direct populaire',                             'Une vidéo que vous pourriez aimer'],
              'hi':        ['लोकप्रिय लाइव वीडियो',                                     'वह वीडियो जो आपको पसंद हो सकता है'],
              'hu':        ['Népszerű élő videó',                                    'Egy videó, amely esetleg tetszik neked'],
              'it':        ['Video in diretta popolare',                             'Un video che potrebbe piacerti'],
              'id':        ['Video Siaran Langsung Populer',                         'Sebuah Video yang Mungkin Anda Suka'],
              'ja':        ['人気ライブ動画',                                         'おすすめの動画'],
              'jv':        ['Video Siaran Langsung Populer',                         'Video sing Menawa Sampeyan Seneng'],
              'kk':        ['Popular Live Video',                                    'A Video You May Like'],
              'km':        ['Popular Live Video',                                    'វីដេអូ​ដែល​អ្នក​ប្រហែល​ជាចូលចិត្ត'],
              'ko':        ['인기 라이브 방송',                                       '회원님이 좋아할 만한 동영상'],
              'lo':        ['Popular Live Video',                                    'A Video You May Like'],
              'mk':        ['Popular Live Video',                                    'Видео кое можеби ќе ти се допадне'],
              'ml':        ['ജനപ്രിയ Live വീഡിയോ',                             'നിങ്ങൾക്ക് ഇഷ്‌ടമാകാനിടയുള്ള ‌വീഡിയോ'],
              'mn':        ['Popular Live Video',                                    'Танд таалагдаж магадгүй бичлэг'],
              'mr':        ['प्रसिद्ध थेट व्हिडिओ',                                        'एक व्हिडिओ जो कदाचित आपल्याला आवडू शकतो'],
              'ms':        ['Video Live Popular',                                    'Video Yang Anda Mungkin Suka'],
              'ne':        ['Popular Live Video',                                    'तपाईंले मन पराउन सक्ने भिडियो'],
              'nl':        ['Populaire livevideo',                                   'Een video die je misschien leuk vindt', 'Een video die je wellicht leuk vindt'],
              'or':        ['Popular Live Video',                                    'ଏକ ଭିଡିଓ ଆପଣ ହୁଏତ ଲାଇକ୍ କରିପାରନ୍ତି'],
              'pa':        ['ਪ੍ਰਸਿੱਧ ਲਾਈਵ ਵੀਡੀਓਜ਼',                                      'ਕੋਈ ਵੀਡੀਓ ਜੋ ਸ਼ਾਇਦ ਤੁਹਾਨੂੰ ਪਸੰਦ ਹੋਵੇ'],
              'pl':        ['Popularna transmisja wideo na żywo',                    'Film, który może Ci się spodobać'],
              'pt':        ['Vídeo em direto popular', 'Vídeo ao vivo popular',      'Um vídeo de que talvez gostes', 'Um vídeo que você talvez curta'],
              'ru':        ['Популярный прямой эфир',                                'Вам может понравиться это видео'],
              'sa':        ['Popular Live Video',                                    'A Video You May Like'],
              'si':        ['Popular Live Video',                                    'ඔබ කැමති විය හැකි වීඩියෝවක්'],
              'so':        ['Popular Live Video',                                    'A Video You May Like'],
              'te':        ['ప్రసిద్ధ ప్రత్యక్ష ప్రసార వీడియో',                            'మీకు నచ్చే వీడియో'],
              'th':        ['Popular Live Video',                                    'วิดีโอที่คุณอาจจะถูกใจ'],
              'tr':        ['Popular Live Video',                                    'Hoşuna Gidebilecek Bir Video'],
              'uk':        ['Popular Live Video',                                    'Відео, яке може вам сподобатися'],
              'ur':        ['Popular Live Video',                                    'ویڈیو جو شائد آپ کو پسند آئے'],
              'vi':        ['Video trực tiếp phổ biến',                              'Một video bạn có thể thích'],
              'zh-Hans':   ['热门直播视频',                                           '猜你喜欢'],
              'zh-Hant':   ['熱門直播視訊', '熱門直播視像',                            '你可能會喜歡的影片', '你可能會喜歡的影片']
          }
      }, {
        // Popular Across Facebook
          'selector': [
              '.fbUserPost > div > div > div',
              '.fbUserStory > div > div > div',
              '.fbUserContent > div > div > div'
          ],
          'content': {
              'af':        ['Oral op Facebook gewild'],
              'ar':        ['رائج على فيسبوك'],
              'az':        ['Feysbukda məşhur'],
              'bs':        ['Populer Lintas Facebook'],
              'ca':        ['Populer Lintas Facebook'],
              'cb':        ['Popular Across Facebook', '‎Popular Across Facebook‎'],
              'cs':        ['Populární na Facebooku'],
              'cx':        ['Sikat sa Kinatibuk-an sa Facebook'],
              'da':        ['Populært på Facebook'],
              'de':        ['Beliebt auf Facebook'],
              'en':        ['Popular Across Facebook'],
              'eo':        ['Popular Across Facebook'],
              'es':        ['Popular en Facebook'],
              'et':        ['Popular Across Facebook'],
              'eu':        ['Popular Across Facebook'],
              'fa':        ['داستان پرطرفدار در فیس‌بوک'],
              'fi':        ['Suosittua Facebookissa'],
              'fo':        ['Popular Across Facebook'],
              'fr':        ['Populaire sur Facebook'],
              'fy':        ['Popular Across Facebook'],
              'ga':        ['Popular Across Facebook'],
              'gl':        ['Popular Across Facebook'],
              'gn':        ['Ojehechavéva Facebook-pe'],
              'id':        ['Populer Lintas Facebook'],
              'it':        ['Popolare su Facebook'],
              'ja':        ['Facebookで人気'],
              'jv':        ['Populer Ing Facebook'],
              'ko':        ['Facebook에서 인기 있는 콘텐츠'],
              'ms':        ['Terkenal Diseluruh Facebook'],
              'pl':        ['Popularne na Facebooku'],
              'ps':        ['Popular Across Facebook', '‎Popular Across Facebook‎'],
              'pt':        ['Populares em todo o Facebook', 'Conteúdos populares no Facebook'],
              'nl':        ['Populair op Facebook'],
              'ru':        ['Популярно на Facebook'],
              'sv':        ['Populärt på Facebook'],
              'tl':        ['Sikat sa Facebook'],
              'ur':        ['پورے Facebook میں مقبول'],
              'vi':        ['Phổ biến trên Facebook'],
              'zh-Hans':   ['Facebook 大热门'],
              'zh-Hant':   ['廣受 Facebook 用戶歡迎']
          }
      }, {
          // Page Stories You May Like
          'selector': [
              'div[title] > div > div > div > div'
          ],
          'content': {
              'ar':        ['أحداث الصفحات التي قد تعجبك'],
              'cb':        ['سەرهاتەکانی پەڕە کە ڕەنگە بەدڵت بن'],
              'de':        ['Seitenmeldungen, die dir gefallen könnten'],
              'en':        ['Page Stories You May Like'],
              'es':        ['Historias de páginas que te pueden gustar'],
              'fa':        ['داستان‌های صفحه‌ای که شاید بپسندید'],
              'fr':        ['Actualités de Pages à voir'],
              'it':        ['Notizie interessanti delle Pagine che ti piacciono'],
              'ja':        ['おすすめのページストーリー'],
              'ko':        ['회원님이 좋아할 만한 페이지 소식'],
              'pl':        ['Zdarzenia stron, które mogą Ci się spodobać'],
              'pt':        ['Histórias da Página que você talvez curta'],
              'ru':        ['Новости Страниц, которые могут вам понравиться'],
              'tr':        ['Beğenebileceğin Sayfa Haberleri'],
              'ur':        ['صفحہ کی کہانیاں جو شاید آپ کو پسند آئیں'],
              'vi':        ['Tin bài bạn có thể thích'],
              'zh-Hans':   ['猜你喜欢'],
              'zh-Hant':   ['你可能會喜歡的粉絲專頁動態', '你可能會喜歡的專頁動態']
          }
      }, {
          // Suggestions From Related Pages
          'selector': [
              'div > div > span'
          ],
          'content': {
            'en':          ['Suggestions From Related Pages'],
            'vi':          ['Thêm đề xuất từ các Trang liên quan']
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

          var typeIterator;
          var selectorIterator;
          var nodeIterator;
          var targetIterator;
          for(typeIterator = 0; typeIterator < searchedNodes.length; typeIterator++) {
              for(selectorIterator = 0; selectorIterator < searchedNodes[typeIterator].selector.length; selectorIterator++) {
                  nodes = story.querySelectorAll(searchedNodes[typeIterator].selector[selectorIterator]);
                  for(nodeIterator = 0; nodeIterator < nodes.length; nodeIterator++) {
                      nodeContent = nodes[nodeIterator][nodeContentKey];
                      if(nodeContent) {
                          for(targetIterator = 0; targetIterator < searchedNodes[typeIterator].content.length; targetIterator++) {
                              if(searchedNodes[typeIterator].exclude && searchedNodes[typeIterator].exclude(nodes[nodeIterator])) {
                                  continue;
                              }

                              if(nodeContent.trim() == searchedNodes[typeIterator].content[targetIterator]) {
                                  return true;
                              }
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

          var i;
          var j;
          var stories;
          for(i = 0; i < storySelectors.length; i++) {
              stories = stream.querySelectorAll(storySelectors[i]);
              if(!stories.length) {
                  return;
              }

              for(j = 0; j < stories.length; j++) {
                  if(isSponsored(stories[j])) {
                      block(stories[j]);
                  }
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
