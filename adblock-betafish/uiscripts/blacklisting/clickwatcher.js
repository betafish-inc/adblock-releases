// Requires overlay.js and jquery

// Highlight DOM elements with an overlayed box, similar to Webkit's inspector.
// Creates an absolute-positioned div that is translated & scaled following
// mousemove events. Holds a pointer to target DOM element.
function Highlighter() {
  var target = null;
  var enabled = false;
  var then = Date.now();
  var box = $("<div id='overlay-box' class='adblock-highlight-node'></div>");
  box.css({
    'background-color': 'rgba(130, 180, 230, 0.5)',
    'outline': 'solid 1px #0F4D9A',
    'box-sizing': 'border-box',
    'position': 'absolute'
  });
  box.appendTo($(document.body));

  function handler(e) {
    var offset, el = e.target;
    var now = Date.now();
    if (now - then < 25) {
      return;
    }
    then = now;
    if (el === box[0]) {
      box.hide();
      el = document.elementFromPoint(e.clientX, e.clientY);
    }
    if (el === target) {
      box.show();
      return;
    }
    if (el === document.body || el.className === "adblock-killme-overlay") {
      box.hide();
      return;
    }
    el = $(el);
    target = el[0];
    offset = el.offset();
    box.css({
      height: el.outerHeight(),
      width: el.outerWidth(),
      left: offset.left,
      top: offset.top
    });
    box.show();
  }

  this.getCurrentNode = function(el) {
    return el === box[0] ? target : el;
  };
  this.enable = function() {
    if (box && !enabled) {
      $("body").bind("mousemove", handler);
    }
    enabled = true;
  };
  this.disable = function() {
    if (box && enabled) {
      box.hide();
      $("body").unbind("mousemove", handler);
    }
    enabled = false;
  };
  this.destroy = function() {
    this.disable();
    if (box) {
      box.remove();
      box = null;
    }
  };
}

// Class that watches the whole page for a click, including iframes and
// objects.  Shows a modal while doing so.
function ClickWatcher() {
  this._callbacks = { 'cancel': [], 'click': [] };
  this._clicked_element = null;
  this._highlighter = new Highlighter();
}
ClickWatcher.prototype.cancel = function(callback) {
  this._callbacks.cancel.push(callback);
}
ClickWatcher.prototype.click = function(callback) {
  this._callbacks.click.push(callback);
}
ClickWatcher.prototype._fire = function(eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
}

ClickWatcher.prototype.enable = function() {
  var that = this;
  that._highlighter.enable();
  that._eventsListener();
}

// Called externally to close ClickWatcher.  Doesn't cause any events to
// fire.
ClickWatcher.prototype.close = function() {
  // Delete our event listeners so we don't fire any cancel events
  this._callbacks.cancel = [];
}

// The dialog is closing, either because the user clicked cancel, or the
// close button, or because they clicked an item.
ClickWatcher.prototype._onClose = function() {
  if (this._clicked_element == null) {
    // User clicked Cancel button or X
    this._fire('cancel');
  } else {
    // User clicked a page item
    this._fire('click', this._clicked_element);
  }
  this._highlighter.destroy();
}

// Catches clicks on elements and mouse hover on the wizard
// when element is clicked we stored the element in _clicked_element
// and close all ClickWatcher processes
ClickWatcher.prototype._eventsListener = function() {
  var that = this;

  function click_catch_this() {
    return click_catch(this);
  }

  function click_catch(element) {
    that._clicked_element = that._highlighter.getCurrentNode(element);
    $("body").off("click",
    ".adblock-killme-overlay, .adblock-highlight-node", click_catch_this);
    Overlay.removeAll();
    that._onClose();
    return false;
  }

  // Most things can be blacklisted with a simple click handler.
  $("body").on("click", ".adblock-killme-overlay, .adblock-highlight-node", click_catch_this);

  // Since iframes that will get clicked will almost always be an entire
  // ad, and I *really* don't want to figure out inter-frame communication
  // so that the blacklist UI's slider works between multiple layers of
  // iframes... just overlay iframes and treat them as a giant object.
  $("object,embed,iframe,[onclick]:empty").
      each(function(i, el) {
        // Don't add overlay's for hidden elements
        if (el.style && el.style.display === "none") {
          return;
        }
        var killme_overlay = new Overlay({
          dom_element: el,
          click_handler: click_catch
        });
        killme_overlay.display();
  });
}

//@ sourceURL=/uiscripts/blacklisting/clickwatcher.js
