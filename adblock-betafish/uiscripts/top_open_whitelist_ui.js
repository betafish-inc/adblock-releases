// Global lock so we can't open more than once on a tab.
if (typeof may_open_dialog_ui === "undefined") {
  may_open_dialog_ui = true;
}

// This script is injected each time the white list wizard is selected. Until we switch to ES6 modules (aka import)
// we need to protect the code in a namespace so classes aren't declared multiple times.
var top_open_whitelist_ui = (function() {

  // DragElement makes a given DOM element draggable. It assumes the element is positioned absolutely
  // and adjusts the element's `top` and `left` styles directly.
  // Inputs:
  //    - el : DOM element that activates dragging on mousedown (e.g. wizard header)
  //    - elementToDrag : DOM element that drags if dragging is active (e.g. entire wizard)
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
      this.el.style.top = (this.el.offsetTop - this.pos2) + "px";
      this.el.style.left = (this.el.offsetLeft - this.pos1) + "px";
    }

    closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
      this.dragging = false;
    }
  }

  // ExceptionFilterEditor maintains the data model for a modifiable domain filter.
  class ExceptionFilterEditor {

    constructor(location) {
      this.domain = location.host;
      this.pathname = location.pathname;
      this.location = location.pathname.match(/(.*?)(\/?)(\?|$)/)

      let fixedDomainPart = parseUri.secondLevelDomainOnly(this.domain, true);
      this.domainParts = this.domain.substr(0, this.domain.lastIndexOf(fixedDomainPart)).split('.');
      this.domainParts.splice(this.domainParts.length-1, 1, fixedDomainPart);

      let path = this.pathname.match(/(.*?)(\/?)(\?|$)/);
      this.pathParts = path[1].split('/');
      this.pathParts.shift(); // first item is always empty

      // Don't show the domain slider on
      // - sites without a third level domain name (e.g. foo.com)
      // - sites with an ip domain (e.g. 1.2.3.4)
      // Don't show the location slider on domain-only locations
      let noThirdLevelDomain = (this.domainParts.length === 1);
      let domainIsIp = /^(\d+\.){3}\d+$/.test(this.domain);
      this.showDomain = !(noThirdLevelDomain || domainIsIp);
      this.showPath = !!(path[1]);
      this.showSliders = this.showDomain || this.showPath;
      this.maxDomainParts = Math.max(this.domainParts.length - 1, 1);
      this.maxPathParts = Math.max(this.pathParts.length, 1);
    }

    // Generate the URL. If forDisplay is true, then it will truncate long URLs
    generateUrl(forDisplay, domainSliderValue, pathSliderValue) {
      let result = "";

      // Make clear that it includes subdomains
      if (forDisplay && domainSliderValue !== 0) {
        result = "*.";
      }

      // Append the chosen parts of a domain
      for (let i = domainSliderValue; i <= (this.domainParts.length - 2); i++) {
        result += this.domainParts[i] + '.';
      }
      result += this.domainParts[this.domainParts.length - 1];
      for (let i = 0; i < pathSliderValue; i++) {
        result += '/' + this.pathParts[i];
      }

      // Append a final slash for for example filehippo.com/download_dropbox/
      if (this.pathParts.length !== pathSliderValue || !this.location[1]) {
        result += "/";
        if (forDisplay) {
          result += "*";
        }
      } else {
        if (this.location[2]) {
          result += this.location[2];
        }
      }

      if (forDisplay) {
        result = result.replace(/(\/[^\/]{6})[^\/]{3,}([^\/]{6})/g, '$1...$2');
        if (result.indexOf("/") > 30 && result.length >=60) {
          result = result.replace(/^([^\/]{20})[^\/]+([^\/]{6}\/)/, '$1...$2')
        }
        while (result.length >= 60) {
          result = result.replace(/(\/.{4}).*?\/.*?(.{4})(?:\/|$)/, '$1...$2/');
        }
        this.domainPart = result.match(/^[^\/]+/)[0];
        this.pathPart = result.match(/\/.*$/)[0];
      } else {
        return result;
      }
    }
  }

  // top_open_whitelist_ui displays the whitelist wizard if it's not already open. See README for
  // details.
  function top_open_whitelist_ui() {
    if (!may_open_dialog_ui) {
      return;
    }

    may_open_dialog_ui = false;

    // Get Flash objects out of the way of our UI
    BGcall('emitPageBroadcast', {fn:'send_content_to_back', options:{}});

    // A empty base <div> is appended to the page's DOM and then a shadow is hosted in it.
    // The shadow protects our dialog from outside CSS "leaking" in.
    // Existing page styles are reset in the shadow at the top of `adblock-wizard.css`
    // using `:host` to select our base and the CCS rule `all:initial;` to perform the reset.
    const base = document.createElement('div');
    base.setAttribute("id", "adblock-host");
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

      //check if we're running on website with a frameset, if so, tell
      //the user we can't run on it.
      if ($("frameset").length >= 1) {
        alert(translate('wizardcantrunonframesets'));
        may_open_dialog_ui = true;
        return;
      }

      let html = `
<div id="adblock-dialog">
  <header class="adblock">
    <img class="adblock" aria-hidden="true" height="24px" width="24px" src="${chrome.extension.getURL('/icons/icon24.png')}">
    <h1 class="adblock">${translate('whitelistertitle2')}</h1>
  </header>
  <section class="adblock">
    <p class="adblock">${translate('adblock_wont_run_on_pages_matching')}</p>
    <ul class="adblock" id="adblock-parts">
        <li class="adblock adblock-part-item" id="adblock-domain-part"></li>
        <li class="adblock adblock-part-item" id="adblock-path-part"></li>
    </ul>
    <p class="adblock" id="slider-directions">${translate('you_can_slide_to_change')}</p>
    <form class="adblock" id="adblock-wizard-form">
        <fieldset class="adblock" id="adblock-sliders">
          <div id="modifydomain">
            <label class="adblock" for="adblock-domain-slider">${translate('modifydomain')}</label>
            <input class="adblock" id="adblock-domain-slider" type="range" min="0" value="0"/>
          </div>
          <div id="modifypath">
            <label class="adblock" for="adblock-path-slider">${translate('modifypath')}</label>
            <input class="adblock" id="adblock-path-slider" type="range" min="0" value="0"/>
          </div>
        </fieldset>
        <fieldset class="adblock">
          <input class="adblock" type="checkbox" id="adblock-reload-page" checked/>
          <label class="adblock" for="adblock-reload-page">${translate('reloadpageafterwhitelist')}</label>
        </fieldset>
    </form>
  </section>
  <footer class="adblock">
    <button class="adblock primary adblock-default-button">${translate('buttonexclude')}</button>
    <button class="adblock cancel">${translate('buttoncancel')}</button>
  </footer>
</div>
`;
      let $dialog = $(html)
      new DragElement(
        $dialog.find('header').get(0),
        $dialog.get(0)
      );
      const domainFilter = new ExceptionFilterEditor(document.location);

      const $domainPart = $dialog.find("#adblock-domain-part");
      const $pathPart = $dialog.find("#adblock-path-part");
      const $domainSlider = $dialog.find("#adblock-domain-slider")[0];
      const $pathSlider = $dialog.find("#adblock-path-slider")[0];

      domainFilter.generateUrl(true, $domainSlider.valueAsNumber, $pathSlider.valueAsNumber);

      if (!domainFilter.showDomain) { $dialog.find("#modifydomain").hide(); }
      if (!domainFilter.showPath) { $dialog.find("#modifypath").hide(); }
      if (!domainFilter.showSliders) { $dialog.find("#slider-directions").hide(); }

      $dialog.find("#adblock-domain-slider").attr("max", domainFilter.maxDomainParts);
      $dialog.find("#adblock-path-slider").attr("max", domainFilter.maxPathParts);
      $dialog.find("#adblock-path-slider, #adblock-domain-slider").on("input change", () => {
        domainFilter.generateUrl(true, $domainSlider.valueAsNumber, $pathSlider.valueAsNumber);
        $domainPart.text(domainFilter.domainPart);
        $pathPart.text(domainFilter.pathPart);
      });

      $domainPart.text(domainFilter.domainPart);
      $pathPart.text(domainFilter.pathPart);

      $dialog.find('button.primary').click(() => {
        const filter = '@@||' + domainFilter.generateUrl(false, $domainSlider.valueAsNumber, $pathSlider.valueAsNumber) + '$document';
        BGcall('addCustomFilter', filter, function() {
          if ($dialog.find('#adblock-reload-page').is(':checked')) {
            document.location.reload();
          } else {
            may_open_dialog_ui = true;
            (document.body || document.documentElement).removeChild(base);
          }
        });
      });

      $dialog.find('button.cancel').click(() => {
        may_open_dialog_ui = true;
        (document.body || document.documentElement).removeChild(base);
      });

      setTextDirection($dialog);
      bindEnterClickToDefault($dialog);

      $base.append($dialog);
    });
    (document.body || document.documentElement).appendChild(base);
  }

  return top_open_whitelist_ui;
})();

//@ sourceURL=/uiscripts/top_open_whitelist_ui.js
