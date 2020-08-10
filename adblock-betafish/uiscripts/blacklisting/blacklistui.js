'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global ClickWatcher, ElementChain, translate, browser, DOMPurify */

// Requires clickwatcher.js and elementchain.js and jQuery

// Create a selector that matches an element.
function selectorFromElm(el) {
  const attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  const result = [el.prop('nodeName')];
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const val = el.attr(attr);
    if (val) {
      result.push(`[${attr}=${JSON.stringify(val)}]`);
    }
  }
  return result.join('');
}

// Wizard that walks the user through selecting an element and choosing
// properties to block.
// clickedItem: the element that was right clicked, if any.
// advancedUser:bool
function BlacklistUi(clickedItem, advancedUser, $base) {
  // If a dialog is ever closed without setting this to false, the
  // object fires a cancel event.
  this.cancelled = true;

  // steps through dialog - see preview()
  this.currentStep = 0;

  this.callbacks = { cancel: [], block: [] };

  this.clickedItem = clickedItem;
  this.advancedUser = advancedUser;
  this.$dialog = $base;
  this.clickWatcher = null;
}

BlacklistUi.prototype.reset = function reset() {
  this.cancelled = true;
  this.currentStep = 0;
  this.clickedItem = null;
};

// TODO: same event framework as ClickWatcher
BlacklistUi.prototype.cancel = function cancel(callback) {
  this.callbacks.cancel.push(callback);
};
BlacklistUi.prototype.block = function block(callback) {
  this.callbacks.block.push(callback);
};
BlacklistUi.prototype.fire = function fire(eventName, arg) {
  const callbacks = this.callbacks[eventName];
  for (let i = 0; i < callbacks.length; i++) {
    callbacks[i](arg);
  }
};
BlacklistUi.prototype.onClose = function onClose() {
  if (this.cancelled === true) {
    $('.adblock-ui-stylesheet').remove();
    this.chain.current().show();
    this.fire('cancel');
  }
};
BlacklistUi.prototype.handleChange = function handleChange() {
  this.last.show();
  this.chain.current().hide();
  this.last = this.chain.current();
  this.redrawPage1();
  this.redrawPage2();
  this.preview(selectorFromElm(this.chain.current()));
};
// Add style rules hiding the given list of selectors.
BlacklistUi.prototype.blockListViaCSS = function blockListViaCSS(selectors) {
  if (!selectors.length) {
    return;
  }
  const cssChunk = document.createElement('style');
  cssChunk.type = 'text/css';
  // Documents may not have a head
  (document.head || document.documentElement).insertBefore(cssChunk, null);

  function fillInCSSchunk() {
    if (!cssChunk.sheet) {
      window.setTimeout(fillInCSSchunk, 0);
      return;
    }
    for (let i = 0; i < selectors.length; i++) {
      const rule = `${selectors[i]} { display:none !important; visibility: hidden !important; orphans: 4321 !important; }`;
      cssChunk.sheet.insertRule(rule, 0);
    }
  }
  fillInCSSchunk();
};

BlacklistUi.prototype.show = function show() {
  const that = this;

  // If we don't know the clicked element, we must find it first.
  if (!that.clickedItem) {
    if (!that.clickWatcher) {
      that.clickWatcher = new ClickWatcher();
      that.clickWatcher.cancel(() => {
        that.preview(null);
        that.fire('cancel');
      });
      that.clickWatcher.click((element) => {
        that.clickedItem = element;
        that.show();
      });
    }
    that.preview('*');
    that.clickWatcher.enable();

    that.$dialog.children('.page')
      .on('mouseenter', () => {
        that.clickWatcher.highlighter.disable();
      })
      .on('mouseleave', () => {
        that.clickWatcher.highlighter.enable();
      });
    that.$dialog.children('.page').hide();
    that.$dialog.children('#page_0').show();
    return;
  }

  // If we do know the clicked element, go straight to the slider.

  that.chain = new ElementChain(that.clickedItem);
  that.buildPage1();
  that.last = that.chain.current();
  that.chain.change(that, that.handleChange);
  that.chain.change();
  that.redrawPage1();
};

BlacklistUi.prototype.buildPage1 = function buildPage1() {
  const that = this;
  let depth = 0;
  let $element = this.chain.current();
  const $pageOne = that.$dialog.children('#page_1');
  const $pageOneSlider = $pageOne.find('#slider');
  const $pageOneOkBtn = $pageOne.find('button.looks-good');
  const $pageOneCancelBtn = $pageOne.find('button.cancel');

  // Reset and hide all wizard pages
  that.$dialog.children('.page').hide();

  // Add events to page 1 and its components
  $pageOneCancelBtn.on('click', () => {
    that.preview(null);
    that.onClose();
  });
  $pageOneOkBtn.on('click', () => {
    that.cancelled = false;
    that.buildPage2();
    that.cancelled = true;
    that.redrawPage2();
  });

  $pageOne.show();
  that.currentStep = 1;
  that.preview(selectorFromElm(that.chain.current()));

  while ($element.length > 0 && $element[0].nodeName !== 'BODY') {
    $element = $element.parent();
    depth += 1;
  }
  $pageOneSlider
    .attr('max', Math.max(depth - 1, 1))
    .on('input change', function sliderInputChange() {
      that.chain.moveTo(this.valueAsNumber);
    });
};

BlacklistUi.prototype.buildPage2 = function buildPage2() {
  const that = this;
  const $pageTwo = that.$dialog.children('#page_2');
  const $pageTwoBlockItBtn = $pageTwo.find('button.block-it');
  const $pageTwoEditBtn = $pageTwo.find('button.edit'); // advanced user only
  const $pageTwoBackBtn = $pageTwo.find('button.back');
  const $pageTwoCancelBtn = $pageTwo.find('button.cancel');
  const $summary = $pageTwo.find('#summary');

  // Reset and hide all wizard pages
  that.$dialog.children('.page').hide();

  if (that.advancedUser) {
    $pageTwoEditBtn.show();
    $pageTwoEditBtn.on('click', () => {
      let customFilter = `${document.location.hostname}##${$summary.data('filter-text')}`;
      // eslint-disable-next-line no-alert
      customFilter = prompt(translate('blacklistereditfilter'), customFilter);
      if (customFilter) { // null => user clicked cancel
        if (!/##/.test(customFilter)) {
          customFilter = `##${customFilter}`;
        }
        browser.runtime.sendMessage({ command: 'parseFilter', filterTextToParse: customFilter }).then((parseResult) => {
          if (parseResult && parseResult.filter && !parseResult.error) {
            browser.runtime.sendMessage({ command: 'addCustomFilter', filterTextToAdd: parseResult.filter.text }).then((response) => {
              if (!response.error) {
                that.blockListViaCSS([customFilter.substr(customFilter.indexOf('##') + 2)]);
                that.fire('block');
                $pageTwoCancelBtn.trigger('click');
              } else {
                // eslint-disable-next-line no-alert
                alert(translate('blacklistereditinvalid1', response.error));
              }
            });
          } else if (parseResult.error) {
            // eslint-disable-next-line no-alert
            alert(translate('blacklistereditinvalid1', translate(parseResult.error.reason || parseResult.error.type)));
          }
        });
      }
    });
  }

  $pageTwoBlockItBtn.on('click', () => {
    if ($summary.text().length > 0) {
      const filter = `${document.location.hostname}##${$summary.text()}`;
      browser.runtime.sendMessage({ command: 'addCustomFilter', filterTextToAdd: filter }).then((response) => {
        if (!response.error) {
          that.blockListViaCSS([$summary.text()]);
          that.fire('block');
          that.blockedText = $summary.text();
          that.buildPage3();
        } else {
          // eslint-disable-next-line no-alert
          alert(translate('blacklistereditinvalid1', response.error));
        }
      });
    } else {
      // eslint-disable-next-line no-alert
      alert(translate('blacklisternofilter'));
    }
  });
  $pageTwoBackBtn.on('click', () => {
    that.$dialog.children('.page').hide();
    that.$dialog.children('#page_1').show();
  });
  $pageTwoCancelBtn.on('click', () => {
    that.preview(null);
    that.onClose();
  });

  // Show page 2
  $pageTwo.show();
  that.currentStep = 2;
  that.preview($summary.text());
};

BlacklistUi.prototype.buildPage3 = function buildPage3() {
  const that = this;
  const $pageThree = that.$dialog.children('#page_3');
  const $pageThreeDoneBtn = $pageThree.find('button.cancel');
  const $pageThreeLearnMoreBtn = $pageThree.find('button.learn-more');
  const $pageThreeCloseBtn = $pageThree.find('button.close');
  const $pageThreeContinueBtn = $pageThree.find('button.remove-another');
  const $summary = $pageThree.find('#summary-pg-3');
  const $settingsLink = $pageThree.find('#settings-link');
  const $premiumLink = $pageThree.find('#premium-link');
  const $dismissedMsg = $pageThree.find('#dismissed-msg');
  const $premiumCTA = $pageThree.find('#premium-cta');

  $summary.text(that.blockedText);

  // Reset and hide all wizard pages
  that.$dialog.children('.page').hide();

  $pageThreeContinueBtn.off('click');
  $pageThreeContinueBtn.on('click', () => {
    // Reset and hide all wizard pages
    that.$dialog.children('.page').hide();
    that.reset();
    that.show();
  });

  $pageThreeDoneBtn.on('click', () => {
    that.preview(null);
    that.onClose();
  });
  $pageThreeLearnMoreBtn.on('click', () => {
    browser.runtime.sendMessage({ command: 'openPremiumPayURL' });
    browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'blacklist_cta_clicked' });
  });
  $pageThreeCloseBtn.on('click', () => {
    browser.runtime.sendMessage({ command: 'setBlacklistCTAStatus', isEnabled: false });
    browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'blacklist_cta_closed' });
    $premiumCTA.hide();
    $dismissedMsg.show();
  });
  $settingsLink.on('click', () => {
    browser.runtime.sendMessage({ command: 'openTab', urlToOpen: 'options.html#customize' });
  });
  $premiumLink.on('click', () => {
    browser.runtime.sendMessage({ command: 'openTab', urlToOpen: 'options.html#mab' });
  });

  // Show page 3
  $pageThree.show();
  that.currentStep = 3;
  that.preview($summary.text());

  // Check whether CTA is shown
  if ($pageThree.find('#blacklist-cta').is(':visible')) {
    browser.runtime.sendMessage({ command: 'recordGeneralMessage', msg: 'blacklist_cta_seen' });
  }
};

BlacklistUi.prototype.redrawPage1 = function redrawPage1() {
  const element = this.chain.current();
  const elementTag = element[0].nodeName;
  const attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  const $selectedData = this.$dialog.children('.page').find('#selected-data');
  const $selectedNodeName = $selectedData.find('#selected_node_name');
  const $closingTag = $selectedData.find('#selected_closing_tag');

  // Set selected element tag name
  $selectedNodeName.text(elementTag);

  // Empty all previous HTML for name value pairs of attributes
  $selectedData.find('.node_attr').each((i, nodeAttrElement) => {
    $(nodeAttrElement).prev('br').remove();
    $(nodeAttrElement).remove();
  });

  // Add new HTML for name value pairs of attributes
  for (const i in attrs) {
    const attrName = attrs[i];
    const attrValue = BlacklistUi.ellipsis(element.attr(attrName));
    if (attrValue) {
      const $attrHTML = $(`
        <br/>
        <i class="node_attr">${attrName}="${attrValue}"</i>`);
      $attrHTML.insertBefore($closingTag);
    }
  }
};

// Return the CSS selector generated by the blacklister.  If the
// user has not yet gotten far enough through the wizard to
// determine the selector, return an empty string.
BlacklistUi.prototype.makeFilter = function makeFilter() {
  const result = [];
  const el = this.chain.current();
  const $pageTwo = this.$dialog.children('#page_2');
  const $pageTwoDetails = $pageTwo.find('#adblock-details');
  const $pageTwoWarning = $pageTwo.find('#filter-warning');

  if ($("input[type='checkbox']#cknodeName", $pageTwoDetails).is(':checked')) {
    result.push(el.prop('nodeName'));
    // Some iframed ads are in a bland iframe.  If so, at least try to
    // be more specific by walking the chain from the body to the iframe
    // in the CSS selector.
    if (el.prop('nodeName') === 'IFRAME' && el.attr('id') === '') {
      let cur = el.parent();
      while (cur.prop('nodeName') !== 'BODY') {
        result.unshift(`${cur.prop('nodeName')} `);
        cur = cur.parent();
      }
    }
  }
  const attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  for (const i in attrs) {
    if ($(`input[type='checkbox']#ck${attrs[i]}`, $pageTwoDetails).is(':checked')) {
      result.push(`[${attrs[i]}=${JSON.stringify(el.attr(attrs[i]))}]`);
    }
  }

  let warningMessage;
  if (result.length === 0) {
    warningMessage = translate('blacklisterwarningnofilter');
  } else if (
    result.length === 1
    && $("input[type='checkbox']#cknodeName", $pageTwoDetails).is(':checked')
  ) {
    warningMessage = translate('blacklisterblocksalloftype', [result[0]]);
  }

  $pageTwoWarning
    .css('display', (warningMessage ? 'block' : 'none'))
    .text(warningMessage);
  return result.join('');
};

BlacklistUi.prototype.redrawPage2 = function redrawPage2() {
  const el = this.chain.current();
  const that = this;
  const attrs = ['nodeName', 'id', 'class', 'name', 'src', 'href', 'data'];
  const $pageTwo = that.$dialog.children('#page_2');
  const $pageTwoDetails = $pageTwo.find('#adblock-details');
  const $pageTwoSummary = $pageTwo.find('#summary');
  const $pageTwoCount = $pageTwo.find('#count');

  function updateFilter() {
    const theFilter = that.makeFilter();
    $pageTwoSummary.text(BlacklistUi.ellipsis(theFilter, 250));
    $pageTwoSummary.data('filter-text', theFilter);
    const matchCount = $(theFilter).not('.dialog').length;

    if (matchCount === 1) {
      $pageTwoCount.text(translate('blacklistersinglematch'));
    } else {
      $pageTwoCount.html(DOMPurify.sanitize(translate('blacklistermatches', [`<b>${matchCount}</b>`]), { SAFE_FOR_JQUERY: true }));
    }
  }

  $pageTwoDetails.empty();

  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const longVal = (attr === 'nodeName' ? el.prop('nodeName') : el.attr(attr));
    const val = BlacklistUi.ellipsis(longVal);
    const attrName = attr === 'nodeName' ? translate('blacklistertype') : attr;

    if (val) {
      // Check src, data and href only by default if no other identifiers are
      // present except for the nodeName selector.
      let checked = true;
      if (attr === 'src' || attr === 'href' || attr === 'data') {
        checked = $('input', $pageTwoDetails).length === 1;
      }

      // Create <label> tag
      const nameHTML = `<b>${attrName}</b>`;
      const valueHTML = `<i>${val}</i>`;
      const $checkboxlabel = $('<label></label>')
        .addClass('adblock')
        .attr('for', `ck${attr}`)
        .html(DOMPurify.sanitize(translate('blacklisterattrwillbe', [nameHTML, valueHTML]), { SAFE_FOR_JQUERY: true }));

      // Create <input> tag
      const $checkboxInput = $('<input></input')
        .addClass('adblock')
        .attr('type', 'checkbox')
        .attr('checked', checked)
        .attr('id', `ck${attr}`)
        .on('change', () => {
          updateFilter();
          that.preview($pageTwoSummary.data('filter-text'));
        });

      // Aggregate <input> and <label> within a <div>
      const $checkbox = $('<div></div>')
        .addClass('adblock')
        .addClass('check-box')
        .addClass('small')
        .append($checkboxInput)
        .append($checkboxlabel);

      $pageTwoDetails.append($checkbox);
    }
  }

  updateFilter();
};

// Change the appearance of a CSS selector on the page, or if null, undo the change.
// Inputs: selector:string - the selector generated by the blacklist wizard
BlacklistUi.prototype.preview = function preview(selector) {
  $('#adblock_blacklistpreview_css').remove();
  if (!selector) {
    return;
  }

  const csspreview = document.createElement('style');
  csspreview.type = 'text/css';
  csspreview.id = 'adblock_blacklistpreview_css';

  if (this.currentStep === 0) {
    // Raise highlight.
    csspreview.innerText = 'body .adblock-highlight-node,';
  } else if (this.currentStep === 1) {
    // Show ui_page1.
    csspreview.innerText = 'body, body * {opacity:1!important;} ';
  } else if (this.currentStep === 2) {
    // Fade the selector, while skipping any matching children.
    csspreview.innerText += `
    ${selector} {
      opacity:.1!important;
    }
    ${selector} ${selector} {
      opacity:1!important;
    }`;
  }

  document.documentElement.appendChild(csspreview);
};

// Return a copy of value that has been truncated with an ellipsis in
// the middle if it is too long.
// Inputs: valueToTruncate:string - value to truncate
//         maxSize?:int - max size above which to truncate, defaults to 50
BlacklistUi.ellipsis = function ellipsis(valueToTruncate, maxSize) {
  let value = valueToTruncate;
  let size = maxSize;

  if (!value) {
    return value;
  }

  if (!size) {
    size = 50;
  }

  const half = size / 2 - 2; // With ellipsis, the total length will be ~= size
  if (value.length > size) {
    value = (`${value.substring(0, half)}...${
      value.substring(value.length - half)}`);
  }

  return value;
};

// required return value for tabs.executeScript
/* eslint-disable-next-line no-unused-expressions */
'';

//# sourceURL=/uiscripts/blacklisting/blacklistui.js
