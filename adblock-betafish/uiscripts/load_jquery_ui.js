//Binds keypress enter to trigger click action on
//default button or trigger click action on focused
//button.
function bind_enter_click_to_default(){
  if (window.GLOBAL_ran_bind_enter_click_to_default)
    return;
  GLOBAL_ran_bind_enter_click_to_default = true;
  $('html').bind('keypress', function(e){
    if (e.keyCode === 13 && $('button:focus').size() <= 0){
      e.preventDefault();
      $('.adblock_default_button').filter(':visible').click();
    }
  });
}

function load_jquery_ui($base, callback) {
  let $target;  // Element to attach the CSS as children
  let done;     // Callback used when loading is complete
  let nextGenWizard = typeof $base !== 'function'; // true if the wizard uses the next-gen UI framework
  if (nextGenWizard) {
    $target = $base;
    done = callback;
  } else {
    $target = $(document.head || document.documentElement);
    done = $base;
  }
  function load_css(src) {
    const url = chrome.extension.getURL(src);
    const link = $('<link rel="stylesheet" type="text/css" />').
      attr('href', url).
      addClass("adblock-ui-stylesheet");
    $target.append(link);
  }

  function load_font(name, style, weight, unicodeRange) {
    return new FontFace('Lato', `url(${chrome.extension.getURL(`/fonts/${name}.woff`)}`,{style,weight,unicodeRange});
  }

  if (nextGenWizard) {
    load_css("adblock-uiscripts-adblock-wizard.css");
    // load fonts programmatically
    // Referencing the fonts in CSS do not load the fonts properly (reason unknown)
    // but programmatically loading them performs reliably.
    const fonts = [];
    fonts.push(load_font('lato-regular', 'normal', 'normal', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(load_font('lato-ext-regular', 'normal', 'normal', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(load_font('lato-ext-italic', 'italic','normal','U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(load_font('lato-italic','italic','normal', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(load_font('lato-ext-bolditalic', 'italic', 'bold', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(load_font('lato-bolditalic', 'italic', 'bold', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(load_font('lato-ext-bold', 'normal', 'bold', 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF'));
    fonts.push(load_font('lato-bold', 'normal', 'bold', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'));
    fonts.push(new FontFace('Material Icons', `url(${chrome.extension.getURL('/icons/MaterialIcons-Regular.woff2')}`, {style:'normal', weight:'normal'}));
    fonts.push(new FontFace('AdBlock Icons', `url(${chrome.extension.getURL('/icons/adblock-icons.woff2')}`, {style:'normal', weight:'normal'}));

    Promise.all(fonts).then(loaded => {
      for (let i = 0; i < loaded.length; i++) {
        document.fonts.add(loaded[i]);
      }
      done();
    }).catch(() => {
      done();
    });
  } else {
    load_css("adblock-jquery-ui.custom.css");
    load_css("adblock-jquery-ui.override-page.css");
    done();
  }
}

// Set RTL for Arabic and Hebrew users in blacklist and whitelist wizards
var text_direction = (function() {
 var language = navigator.language.match(/^[a-z]+/i)[0] ;
 return language === "ar" || language === "he" ? "rtl":"ltr";
})();
function changeTextDirection($selector) {
 $selector.attr("dir", text_direction);
  if (text_direction === "rtl") {
    $(".ui-dialog .ui-dialog-buttonpane .ui-dialog-buttonset").css("float", "left");
    $(".ui-dialog .ui-dialog-title").css("float", "right");
    $(".ui-dialog .ui-dialog-titlebar").css("background-position", "right center");
    $(".ui-dialog .ui-dialog-titlebar-close").css({left: "0.3em", right: "initial"});
}
}

//@ sourceURL=/uiscripts/load_jquery_ui.js
