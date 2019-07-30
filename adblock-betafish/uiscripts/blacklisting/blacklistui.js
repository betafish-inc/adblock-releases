// Requires clickwatcher.js and elementchain.js and jQuery

// Create a selector that matches an element.
function selector_from_elm(el) {
  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  var result = [el.prop('nodeName')];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var val = el.attr(attr);
    if (val)
      result.push('[' + attr + '=' + JSON.stringify(val) + ']');
  }
  return result.join('');
}

// Wizard that walks the user through selecting an element and choosing
// properties to block.
// clicked_item: the element that was right clicked, if any.
// advanced_user:bool
function BlacklistUi(clicked_item, advanced_user, $base) {
  // If a dialog is ever closed without setting this to false, the
  // object fires a cancel event.
  this._cancelled = true;

  // steps through dialog - see _preview()
  this._current_step = 0;

  this._callbacks = { 'cancel': [], 'block': [] };

  this._clicked_item = clicked_item;
  this._advanced_user = advanced_user;
  this._$dialog = $base;
}

// TODO: same event framework as ClickWatcher
BlacklistUi.prototype.cancel = function(callback) {
  this._callbacks.cancel.push(callback);
}
BlacklistUi.prototype.block = function(callback) {
  this._callbacks.block.push(callback);
}
BlacklistUi.prototype._fire = function(eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
}
BlacklistUi.prototype._onClose = function() {
  if (this._cancelled == true) {
    $(".adblock-ui-stylesheet").remove();
    this._chain.current().show();
    this._fire('cancel');
  }
}
BlacklistUi.prototype.handle_change = function() {
  this._last.show();
  this._chain.current().hide();
  this._last = this._chain.current();
  this._redrawPage1();
  this._redrawPage2();
  this._preview(selector_from_elm(this._chain.current()));
}
// Add style rules hiding the given list of selectors.
BlacklistUi.prototype.block_list_via_css = function(selectors) {
  if (!selectors.length)
    return;
  var css_chunk = document.createElement('style');
  css_chunk.type = 'text/css';
  // Documents may not have a head
  (document.head || document.documentElement).insertBefore(css_chunk, null);

  function fill_in_css_chunk() {
    if (!css_chunk.sheet) {
      window.setTimeout(fill_in_css_chunk, 0);
      return;
    }
    for (var i = 0; i < selectors.length; i++) {
      var rule = selectors[i] + ' { display:none !important; visibility: hidden !important; orphans: 4321 !important; }';
      css_chunk.sheet.insertRule(rule, 0);
    }
  }
  fill_in_css_chunk();
}

BlacklistUi.prototype.show = function() {
  var that = this;

  // If we don't know the clicked element, we must find it first.
  if (that._clicked_item == null) {
    var clickWatcher = new ClickWatcher();
    clickWatcher.cancel(function() {
      that._preview(null);
      that._fire('cancel');
    });
    clickWatcher.click(function(element) {
      that._clicked_item = element;
      that.show();
    });
    that._preview("*");
    clickWatcher.enable();
    that._$dialog.children('.page')
      .bind("mouseenter",function() { clickWatcher._highlighter.disable() })
      .bind("mouseleave",function() { clickWatcher._highlighter.enable() });
    that._$dialog.children('.page').hide();
    that._$dialog.children('#page_0').show();
    return;
  }

  // If we do know the clicked element, go straight to the slider.
  else {
    that._chain = new ElementChain(that._clicked_item);
    that._build_page1();
    that._last = that._chain.current();
    that._chain.change(that, that.handle_change);
    that._chain.change();
    that._redrawPage1();
  }
}

BlacklistUi.prototype._build_page1 = function() {
  var that = this;
  var depth = 0;
  var $element = this._chain.current();
  var $pageOne = that._$dialog.children('#page_1');
  var $pageOneSlider = $pageOne.find('#slider');
  var $pageOneOkBtn = $pageOne.find('button.looks-good');
  var $pageOneCancelBtn = $pageOne.find('button.cancel');

  // Reset and hide all wizard pages
  that._$dialog.children('.page').hide();

  // Add events to page 1 and its components
  $pageOneCancelBtn.click(() => {
    that._preview(null);
    that._onClose();
  });
  $pageOneOkBtn.click(() => {
    that._cancelled = false;
    that._build_page2();
    that._cancelled = true;
    that._redrawPage2();
  });

  $pageOne.show();
  that._current_step = 1;
  that._preview(selector_from_elm(that._chain.current()));

  while ($element.length > 0 && $element[0].nodeName != "BODY") {
    $element = $element.parent();
    depth++;
  }
  $pageOneSlider
    .attr("max", Math.max(depth - 1, 1))
    .on("input change", function() {
      that._chain.moveTo(this.valueAsNumber);
    });
}

BlacklistUi.prototype._build_page2 = function() {
  var that = this;
  var $pageTwo = that._$dialog.children('#page_2');
  var $pageTwoBlockItBtn = $pageTwo.find('button.block-it');
  var $pageTwoEditBtn = $pageTwo.find('button.edit'); // advanced user only
  var $pageTwoBackBtn = $pageTwo.find('button.back');
  var $pageTwoCancelBtn = $pageTwo.find('button.cancel');
  var $summary = $pageTwo.find('#summary');

  // Reset and hide all wizard pages
  that._$dialog.children('.page').hide();

  if (that._advanced_user) {
    $pageTwoEditBtn.show();
    $pageTwoEditBtn.click(() => {
      var customFilter = `${ document.location.hostname }##${ $summary.text() }`;
      customFilter = prompt(translate("blacklistereditfilter"), customFilter);
      if (customFilter) {//null => user clicked cancel
        if (!/\#\#/.test(customFilter)) {
          customFilter = `##${ customFilter }`;
        }
        BGcall('parseFilter', customFilter, function(result) {
          if (result.filter) {
            BGcall('addCustomFilter', result.filter.text, function(ex) {
              if (!ex) {
                that.block_list_via_css([customFilter.substr(customFilter.indexOf('##') + 2)]);
                that._fire('block');
                $pageTwoCancelBtn.click();
              } else {
                alert(translate("blacklistereditinvalid1", ex));
              }
            });
          } else if (result.error && result.error.type) {
            alert(translate("blacklistereditinvalid1", result.error.type));
          }
        });
      }
    });

  }

  $pageTwoBlockItBtn.click(() => {
    if ($summary.text().length > 0) {
      var filter = document.location.hostname + "##" + $summary.text();
      BGcall('addCustomFilter', filter, function() {
        that.block_list_via_css([$summary.text()]);
        that._fire('block');
        $pageTwoCancelBtn.click();
      });
    } else {
      alert(translate("blacklisternofilter"));
    }
  });
  $pageTwoBackBtn.click(() => {
    that._$dialog.children('.page').hide();
    that._$dialog.children('#page_1').show();
  });
  $pageTwoCancelBtn.click(() => {
    that._preview(null);
    that._onClose();
  });

  // Show page 2
  $pageTwo.show();
  that._current_step = 2;
  that._preview($summary.text());
}

BlacklistUi.prototype._redrawPage1 = function() {
  var element = this._chain.current();
  var elementTag = element[0].nodeName;
  var attrs = ["id", "class", "name", "src", "href", "data"];
  var $selectedData = this._$dialog.children('.page').find('#selected_data');
  var $selectedNodeName = $selectedData.find('#selected_node_name');
  var $closingTag = $selectedData.find('#selected_closing_tag');

  // Set selected element tag name
  $selectedNodeName.text(elementTag);

  // Empty all previous HTML for name value pairs of attributes
  $selectedData.find('.node_attr').each((i, nodeAttrElement) => {
    $(nodeAttrElement).prev('br').remove();
    $(nodeAttrElement).remove();
  });

  // Add new HTML for name value pairs of attributes
  for (var i in attrs) {
    var attrName = attrs[i];
    var attrValue = BlacklistUi._ellipsis(element.attr(attrName));
    if (attrValue) {
      var $attrHTML = $(`
        <br/>
        <i class="node_attr">${ attrName }="${ attrValue }"</i>`
      );
      $attrHTML.insertBefore($closingTag);
    }
  }
}

// Return the CSS selector generated by the blacklister.  If the
// user has not yet gotten far enough through the wizard to
// determine the selector, return an empty string.
BlacklistUi.prototype._makeFilter = function() {
  var result = [];
  var el = this._chain.current();
  var $pageTwo = this._$dialog.children('#page_2');
  var $pageTwoDetails = $pageTwo.find('#adblock-details');
  var $pageTwoWarning = $pageTwo.find('#filter_warning');

  if ($("input[type='checkbox']#cknodeName", $pageTwoDetails).is(':checked')) {
    result.push(el.prop('nodeName'));
    // Some iframed ads are in a bland iframe.  If so, at least try to
    // be more specific by walking the chain from the body to the iframe
    // in the CSS selector.
    if (el.prop('nodeName') == 'IFRAME' && el.attr('id') == '') {
      var cur = el.parent();
      while (cur.prop('nodeName') != 'BODY') {
        result.unshift(cur.prop('nodeName') + " ");
        cur = cur.parent();
      }
    }
  }
  var attrs = ['id', 'class', 'name', 'src', 'href', 'data'];
  for (var i in attrs) {
    if ($("input[type='checkbox']#ck" + attrs[i], $pageTwoDetails).is(':checked'))
      result.push('[' + attrs[i] + '=' + JSON.stringify(el.attr(attrs[i])) + ']');
  }

  var warningMessage;
  if (result.length == 0)
    warningMessage = translate("blacklisterwarningnofilter");
  else if (result.length == 1 && $("input[type='checkbox']#cknodeName", $pageTwoDetails).is(':checked'))
    warningMessage = translate("blacklisterblocksalloftype", [result[0]]);
  
  $pageTwoWarning
    .css("display", (warningMessage ? "block" : "none"))
    .text(warningMessage);
  return result.join('');
}

BlacklistUi.prototype._redrawPage2 = function() {
  var el = this._chain.current();
  var that = this;
  var attrs = ['nodeName', 'id', 'class', 'name', 'src', 'href', 'data'];
  var $pageTwo = that._$dialog.children('#page_2');
  var $pageTwoDetails = $pageTwo.find('#adblock-details');
  var $pageTwoSummary = $pageTwo.find('#summary');
  var $pageTwoCount = $pageTwo.find('#count');

  function updateFilter() {
    var theFilter = that._makeFilter();
    $pageTwoSummary.text(theFilter);
    var matchCount = $(theFilter).not('.dialog').length;
    
    if (matchCount == 1)
      $pageTwoCount.text(translate("blacklistersinglematch"));
    else
      $pageTwoCount.html(translate("blacklistermatches", [`<b>${matchCount}</b>`]));
  }

  $pageTwoDetails.empty();
  
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var longVal = (attr == "nodeName" ? el.prop("nodeName") : el.attr(attr));
    var val = BlacklistUi._ellipsis(longVal);
    var attrName = attr == 'nodeName' ? translate("blacklistertype") : attr;

    if (!val)
      continue;

    // Check src, data and href only by default if no other identifiers are
    // present except for the nodeName selector.
    var checked = true;
    if (attr == 'src' || attr == 'href' || attr == 'data')
      checked = $("input", $pageTwoDetails).length == 1;

    // Create <label> tag
    var nameHTML = `<b>${attrName}</b>`;
    var valueHTML = `<i>${val}</i>`;
    var $checkboxlabel = $("<label></label>")
      .addClass('adblock')
      .attr("for", "ck" + attr)
      .html(translate("blacklisterattrwillbe", [nameHTML, valueHTML]));

    // Create <input> tag
    var $checkboxInput = $("<input></input")
      .addClass('adblock')
      .attr('type', 'checkbox')
      .attr('checked', checked)
      .attr('id', `ck${attr}`)
      .change(function() {
        updateFilter();
        that._preview($pageTwoSummary.text());
      });

    // Aggregate <input> and <label> within a <div>
    var $checkbox = $("<div></div>")
      .addClass('adblock')
      .addClass('check-box')
      .addClass('small')
      .append($checkboxInput)
      .append($checkboxlabel);

    $pageTwoDetails.append($checkbox);
  }

  updateFilter();
}

// Change the appearance of a CSS selector on the page, or if null, undo the change.
// Inputs: selector:string - the selector generated by the blacklist wizard
BlacklistUi.prototype._preview = function(selector) {
  $("#adblock_blacklist_preview_css").remove();
  if (!selector) return;

  var css_preview = document.createElement("style");
  css_preview.type = "text/css";
  css_preview.id = "adblock_blacklist_preview_css";

  var d = "body #adblock-host";

  switch (this._current_step) {
  case 0:
    // Raise highlight.
    css_preview.innerText = "body .adblock-highlight-node,";
    break;
  case 1:
    // Show ui_page1.
    css_preview.innerText = d + ", " + d + " * {opacity:1!important;} ";
    // Fade the selector, while skipping any matching children.
    css_preview.innerText += selector + " {opacity:.1!important;} " +
      selector + " " + selector + " {opacity:1!important;}";
    break;
  case 2:
    // Show ui_page2.
    css_preview.innerText += selector + ":not(#adblock-host) {display:none!important;}";
  }
  document.documentElement.appendChild(css_preview);
}

// Return a copy of value that has been truncated with an ellipsis in
// the middle if it is too long.
// Inputs: value:string - value to truncate
//         size?:int - max size above which to truncate, defaults to 50
BlacklistUi._ellipsis = function(value, size) {
  if (value == null)
    return value;

  if (size == undefined)
    size = 50;

  var half = size / 2 - 2; // With ellipsis, the total length will be ~= size

  if (value.length > size)
    value = (value.substring(0, half) + "..." +
             value.substring(value.length - half));

  return value;
}

//@ sourceURL=/uiscripts/blacklisting/blacklistui.js
