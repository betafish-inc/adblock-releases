// Global lock so we can't open more than once on a tab.
if (typeof may_open_dialog_ui === 'undefined')
  may_open_dialog_ui = true;

// This script is injected each time the white list wizard is selected. Until we switch to ES6 modules (aka import)
// we need to protect the code in a namespace so classes aren't declared multiple times.
var top_open_blacklist_ui = (function() {

  // DragElement makes a given DOM element draggable. It assumes the element is positioned absolutely
  // and adjusts the element's `top` and `left` styles directly.
  // Inputs:
  //    - el : DOM element that activates dragging on mousedown (e.g. wizard header)
  //    - elementToDrag : DOM element that should drag while dragging (e.g. entire wizard)
  class DragElement {
    constructor(el, elementToDrag) {
      this.pos1 = 0;
      this.pos2 = 0;
      this.pos3 = 0;
      this.pos4 = 0;
      this.el = elementToDrag;
      this.dragging = false;

      if (document.getElementById(el.d + 'header')) {
        document.getElementById(el.id + 'header').onmousedown = this.dragMouseDown.bind(this);
      } else {
        el.onmousedown = this.dragMouseDown.bind(this);
      }
    }

    dragMouseDown(e) {
      let event = e || window.event;
      event.preventDefault();
      this.pos3 = event.clientX;
      this.pos4 = event.clientY;
      this.dragging = true;
      document.onmouseup = this.closeDragElement.bind(this);
      document.onmousemove = this.elementDrag.bind(this);
    }

    elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      this.pos1 = this.pos3 - e.clientX;
      this.pos2 = this.pos4 - e.clientY;
      this.pos3 = e.clientX;
      this.pos4 = e.clientY;
      // set the element's new position:
      this.el.style.top = (this.el.offsetTop - this.pos2) + 'px';
      this.el.style.left = (this.el.offsetLeft - this.pos1) + 'px';
    }

    closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
      this.dragging = false;
    }
  }

  function top_open_blacklist_ui(options) {
    if (!may_open_dialog_ui)
      return;

    may_open_dialog_ui = false;

    // Get Flash objects out of the way of our UI
    BGcall('emitPageBroadcast', {fn:'send_content_to_back', options:{}});

    // A empty base <div> is appended to the page's DOM and then a shadow is hosted in it.
    // The shadow protects our dialog from outside CSS 'leaking' in.
    // Existing page styles are reset in the shadow/base at the top of `adblock-wizard.css`
    // using `:host` to select our base and the CCS rule `all:initial;` to perform the reset.
    const base = document.createElement('div');
    base.setAttribute('id', 'adblock-host');
    let $base;
    if ('attachShadow' in base) {
      // allow forcing the fallback using feature flag
      if (sessionStorage.getItem("adblock.wizard.shadow") === 'ignore') {
        $base = $(base);
      } else {
        $base = $(base.attachShadow({mode: 'open'}));
      }
    } else {
      // fallback to using the host node as a poor man's shadow
      $base = $(base);
    }
    load_wizard_resources($base, () => {

      // If they chose 'Block an ad on this page...' ask them to click the ad
      if (options.nothing_clicked)
        rightclicked_item = null;

      // If they right clicked in a frame in Chrome, use the frame instead
      if (options.info && options.info.frameUrl) {
        var frame = $('iframe').filter(function(i, el) {
          return el.src == options.info.frameUrl;
        });
        if (frame.length == 1)
          rightclicked_item = frame[0];
      }
      if (rightclicked_item && rightclicked_item.nodeName == 'BODY')
        rightclicked_item = null;

      //check if we're running on website with a frameset, if so, tell
      //the user we can't run on it.
      if ($('frameset').length >= 1) {
          alert(translate('wizardcantrunonframesets'));
          may_open_dialog_ui = true;
          return;
      }

      let html = `
      <div id='adblock-dialog'>

        <div class='adblock page' id='page_0'>
          <header class='adblock'>
            <img class='adblock' aria-hidden='true' src='${chrome.extension.getURL('/icons/icon24.png')}'>
            <h1 class='adblock'>${translate('blockanadtitle')}</h1>
          </header>
          <section class='adblock'>
            <p class='adblock'>${translate('clickthead')}</p>
          </section>
          <footer class='adblock'>
            <button class='adblock cancel'>${translate('buttoncancel')}</button>
          </footer>
        </div>

        <div class='adblock page' id='page_1' style='display:none;'>
          <header class='adblock'>
            <img class='adblock' aria-hidden='true' src='${chrome.extension.getURL('/icons/icon24.png')}'>
            <h1 class='adblock'>${translate('slidertitle')}</h1>
          </header>
          <section class='adblock'>
            <p class='adblock'>${translate('sliderexplanation')}</p>
            <input class='adblock' id='slider' type='range' min='0' value='0'/>
          </section>
          <section class='adblock' id='selected_data'>
            <b class='adblock'>${translate('blacklisterblockedelement')}</b>
            <br><br>
            <span class='adblock'>&lt;&nbsp;</span><i class='adblock' id='selected_node_name'></i>
            <iclass='adblock' id='selected_closing_tag'>&nbsp;&gt;</i>
          </section>
          <footer class='adblock'>
            <button class='adblock primary looks-good adblock-default-button'>${translate('buttonlooksgood')}</button>
            <button class='adblock cancel'>${translate('buttoncancel')}</button>
          </footer>
        </div>

        <div class='adblock page' id='page_2' style='display:none;'>
          <header class='adblock'>
            <img class='adblock' aria-hidden='true' src='${chrome.extension.getURL('/icons/icon24.png')}'>
            <h1 class='adblock'>${translate('blacklisteroptionstitle')}</h1>
          </header>
          <section class='adblock'>
            <div>${translate('blacklisteroptions1')}</div>
            <div id='adblock-details'></div>
          </section>
          <center class='adblock' id='count'></center>
          <section class='adblock'>
            <div>${translate('blacklisternotsure')}</div>
            <div>${translate('blacklisterthefilter')}</div>
            <div>
              <div id='summary'></div><br/>
              <div id='filter_warning'></div>
            </div>
          </section>
          <footer class='adblock'>
            <button class='adblock primary block-it adblock-default-button'>${translate('buttonblockit')}</button>
            <button class='adblock edit advanced-user'>${translate("buttonedit")}</button>
            <button class='adblock back'>${translate("buttonback")}</button>
            <button class='adblock cancel'>${translate('buttoncancel')}</button>
          </footer>
        </div>

      </div>
      `;
      let $dialog = $(html);
      $dialog.find('header').each((i, header) => {
        new DragElement(header, $dialog.get(0));
      });
      $dialog.find('button.cancel').click(() => {
        may_open_dialog_ui = true;
        (document.body || document.documentElement).removeChild(base);
      });

      setTextDirection($dialog);
      bindEnterClickToDefault($dialog);

      $base.append($dialog);

      BGcall('getSettings', function(settings) {
        var advanced_user = settings.show_advanced_options;
        var blacklist_ui = new BlacklistUi(rightclicked_item, advanced_user, $dialog);
        blacklist_ui.cancel(function() {
          may_open_dialog_ui = true;
        });
        blacklist_ui.block(function() {
          may_open_dialog_ui = true;
          // In case of frames, reload, as the frame might contain matches too.
          if ($('iframe, frameset, frame').filter(':visible').length > 0)
            document.location.reload();
        });
        blacklist_ui.show();
      });
    });
    (document.body || document.documentElement).appendChild(base);
  }

return top_open_blacklist_ui;
})();

//@ sourceURL=/uiscripts/top_open_blacklist_ui.js