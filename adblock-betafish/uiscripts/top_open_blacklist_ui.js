'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, translate, BlacklistUi, bindEnterClickToDefault, mayOpenDialogUi:true,
   setLangAndDirAttributes, rightClickedItem:true, loadWizardResources, i18nJoin,
   processReplacementChildrenInContent */

// Global lock so we can't open more than once on a tab.
if (typeof window.mayOpenDialogUi === 'undefined') {
  window.mayOpenDialogUi = true;
}

// This script is injected each time the white list wizard is selected. Until we switch to ES6
// modules (aka import) we need to protect the code in a namespace so classes aren't declared
// multiple times.
function topOpenBlacklistUI(options) {
  // DragElement makes a given DOM element draggable. It assumes the element is positioned
  // absolutely and adjusts the element's `top` and `left` styles directly.
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
      this.activationElement = el;

      if (document.getElementById(`${el.d}header`)) {
        document.getElementById(`${el.id}header`).onmousedown = this.dragMouseDown.bind(this);
      } else {
        this.activationElement.onmousedown = this.dragMouseDown.bind(this);
      }
    }

    dragMouseDown(e) {
      const event = e || window.event;
      event.preventDefault();
      this.pos3 = event.clientX;
      this.pos4 = event.clientY;
      this.dragging = true;
      document.onmouseup = this.closeDragElement.bind(this);
      document.onmousemove = this.elementDrag.bind(this);
    }

    elementDrag(e) {
      const event = e || window.event;
      event.preventDefault();
      // calculate the new cursor position:
      this.pos1 = this.pos3 - event.clientX;
      this.pos2 = this.pos4 - event.clientY;
      this.pos3 = event.clientX;
      this.pos4 = event.clientY;
      // set the element's new position:
      this.el.style.top = `${this.el.offsetTop - this.pos2}px`;
      this.el.style.left = `${this.el.offsetLeft - this.pos1}px`;
    }

    closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
      this.dragging = false;
    }
  }

  if (!mayOpenDialogUi) {
    return;
  }

  mayOpenDialogUi = false;

  // Get Flash objects out of the way of our UI
  browser.runtime.sendMessage({ command: 'sendContentToBack' });

  // A empty base <div> is appended to the page's DOM and then a shadow is hosted in it.
  // The shadow protects our dialog from outside CSS 'leaking' in.
  // Existing page styles are reset in the shadow/base at the top of `adblock-wizard.css`
  // using `:host` to select our base and the CCS rule `all:initial;` to perform the reset.
  const base = document.createElement('div');
  const $base = $(base.attachShadow({ mode: 'open' }));

  loadWizardResources($base, () => {
    // If they chose 'Block an ad on this page...' ask them to click the ad
    if (options.nothingClicked) {
      rightClickedItem = null;
    }

    // If they right clicked in a frame in Chrome, use the frame instead
    if (options.info && options.info.frameUrl) {
      const frame = $('iframe').filter((i, el) => el.src === options.info.frameUrl);
      if (frame.length === 1) {
        rightClickedItem = frame.get(0);
      }
    }
    if (rightClickedItem && rightClickedItem.nodeName === 'BODY') {
      rightClickedItem = null;
    }

    // check if we're running on website with a frameset, if so, tell
    // the user we can't run on it.
    if ($('frameset').length >= 1) {
      // eslint-disable-next-line no-alert
      alert(translate('wizardcantrunonframesets'));
      mayOpenDialogUi = true;
      return;
    }
    const html = `
    <div id='wizard'>
      <div class='page' id='page_0'>
        <header>
          <img aria-hidden='true' src='${browser.runtime.getURL('/icons/icon24.png')}'>
          <h1>${translate('blockanadtitle')}</h1>
        </header>
        <section>
          <p>${translate('clickthead')}</p>
        </section>
        <footer>
          <button class='cancel'>${translate('buttoncancel')}</button>
        </footer>
      </div>
      <div class='page' id='page_1' style='display:none;'>
        <header>
          <img aria-hidden='true' src='${browser.runtime.getURL('/icons/icon24.png')}'>
          <h1>${translate('slidertitle')}</h1>
        </header>
        <section>
          <p>${translate('sliderexplanation')}</p>
          <input id='slider' type='range' min='0' value='0'/>
        </section>
        <section id='selected-data'>
          <b>${translate('blacklisterblockedelement')}</b>
          <br><br>
          <span>&lt;&nbsp;</span><i id='selected_node_name'></i>
          <i id='selected_closing_tag'>&nbsp;&gt;</i>
        </section>
        <footer>
          <button class='primary looks-good adblock-default-button'>${translate('buttonlooksgood')}</button>
          <button class='cancel'>${translate('buttoncancel')}</button>
        </footer>
      </div>
      <div class='page' id='page_2' style='display:none;'>
        <header>
          <img aria-hidden='true' src='${browser.runtime.getURL('/icons/icon24.png')}'>
          <h1>${translate('blacklisteroptionstitle')}</h1>
        </header>
        <section>
          <div>${translate('blacklisteroptions1')}</div>
          <div id='adblock-details'></div>
        </section>
        <center id='count'></center>
        <section>
          <div>${translate('blacklisternotsure')}</div>
          <div>${translate('blacklisterthefilter')}</div>
          <div>
            <div id='summary'></div><br/>
            <div id='filter-warning'></div>
          </div>
        </section>
        <footer>
          <button class='primary block-it adblock-default-button'>${translate('buttonblockit')}</button>
          <button class='edit advanced-user'>${translate('buttonedit')}</button>
          <button class='back'>${translate('buttonback')}</button>
          <button class='cancel'>${translate('buttoncancel')}</button>
        </footer>
      </div>
      <div class='page' id='page_3' style='display:none;'>
        <header>
          <img aria-hidden='true' src='${browser.runtime.getURL('/icons/icon24.png')}'>
          <h1>${translate('blacklisteroptionstitle')}</h1>
        </header>
        <section>
          <div class='messageWithLink' i18n_replacement_el='settings-link'>
            ${i18nJoin('successfully_blocked_ad', 'future_ads_blocked', 'change_behavior_settings')}
            <a id='settings-link' class='link' href='#'></a>
          </div>
        </section>
        <section>
          <div>${translate('rule_added_filters')}</div>
          <div>
            <div id='summary-pg-3'></div>
          </div>
        </section>
        <section class='body-button'>
          <button id="block_something_else_btn" class='primary remove-another adblock-default-button'>${translate('block_something_else')}</button>
          <button class='cancel'>${translate('done')}</button>
        </section>
        <footer id='blacklist-cta' style='display:none;'>
          <div id='dismissed-msg' class='messageWithLink' i18n_replacement_el='premium-link' style='display:none;'>
            ${i18nJoin('wont_show_again', 'check_out_premium')}
            <a id='premium-link' class='link' href='#'></a>
          </div>
          <div id='premium-cta'>
            <div id='cta-msg'>${i18nJoin('blocked_something', 'never_lose_settings')}</div>
            <div id='cta-buttons'>
              <button class='learn-more'>${translate('learn_more_without_period')}</button>
              <button class='close material-icons'>close</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
    `;
    const $dialog = $(html);
    $dialog.find('header').each((i, header) => {
      // eslint-disable-next-line no-new
      new DragElement(header, $dialog.get(0));
    });
    $dialog.find('button.cancel').on('click', () => {
      mayOpenDialogUi = true;
      (document.body || document.documentElement).removeChild(base);
    });

    $dialog.find('.messageWithLink').each(function replaceLinks() {
      processReplacementChildrenInContent($(this));
    });
    if (!options.isActiveLicense && options.showBlacklistCTA) {
      $dialog.find('#blacklist-cta').show();
    }
    setLangAndDirAttributes($dialog.get(0));
    bindEnterClickToDefault($dialog);

    $base.append($dialog);
    browser.runtime.sendMessage({ command: 'getSettings' }).then((settings) => {
      const advancedUser = settings.show_advanced_options;
      const blacklistUI = new BlacklistUi(rightClickedItem, advancedUser, $dialog);
      blacklistUI.cancel(() => {
        mayOpenDialogUi = true;
      });
      blacklistUI.block(() => {
        mayOpenDialogUi = true;
      });
      blacklistUI.show();
    });
  });
  (document.body || document.documentElement).appendChild(base);
}

// required return value for tabs.executeScript
/* eslint-disable-next-line no-unused-expressions */
'';

//# sourceURL=/uiscripts/top_open_blacklist_ui.js
