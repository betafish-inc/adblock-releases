
var hostname = window.location.hostname;
var minDimension = 60;
var cssRules = [];
var hideElements = [];
var hiddenElements = [];
browser.runtime.sendMessage({type: "getSelectors"}, response =>
{
  if (response.selectors && response.selectors) {
    cssRules = response.selectors;
  }
});

// hideElement may get call after the page has completed loading on certain sites that have infinite scroll for example.
// if the user is on on these infinite scroll sites, such as FB, then attempt to do a pic replacement
var checkElement = function(element) {
    if (document.readyState === 'complete' || window.top === window && hostname ==="www.facebook.com") {
      let mediatype = typeMap.get(element.localName);
      if (mediatype) {
        picreplacement.augmentIfAppropriate({el: element, elType: mediatype, blocked: true}, function(response) {
          if (response) {
            chrome.runtime.sendMessage({ message: 'recordOneAdReplaced' });
          }
        });
      } else  {
        picreplacement.augmentDivIfAppropriate({el: element}, function(response) {
          if (response) {
            chrome.runtime.sendMessage({ message: 'recordOneAdReplaced' });
          }
        });
      }
    } else {
      hideElements.push(element);
    }
};

var ElementTypes = {
  IMAGE: 2,
  'OBJECT': 4,
  SUBDOCUMENT: 8,
};

//
var onReady = function (callback) {
    if (document.readyState === 'complete')
        window.setTimeout(callback, 0);
    else
        window.addEventListener('load', callback, false);
};

// when the page has completed loading:
// 1) get the currently loaded CSS hiding rules
// 2) find any hidden elements using the hiding rules from #1 that meet the
//    minimum minimum dimensions required. if so, add them to an array
// 3) find any hidden elements that were captured from the hideElement() function that meet the
//    minimum minimum dimensions required. if so, add them to an array
// 4) sort the array by size and type - we want to replace the large elements first
// 5) process the sorted array, attempting to do a pic replacment for each element
onReady(function() {
  var elementObjArray = [];
  cssRules.
    forEach(function(selector) {
      var elems = document.querySelectorAll(selector);
      for (var i=0; i<elems.length; i++) {
        var elem = elems[i];
        var t = picreplacement._targetSize(elem);
        if (!t.x || !t.y || t.x < minDimension || t.y < minDimension) {
          return;
        }
        // save the size of this element,
        // it may be used later if we're attempty to do a pic replacment on it's hidding parent
        // and we may not be able to calculate the parent size, so we'll use this value instead.
        elem.dataset.adblockSize = JSON.stringify(t);
        elementObjArray.push({ elem: elem, size: (t.x * t.y), type: 2 });
      }
    });

    hideElements.forEach(function(elem) {
      var t = picreplacement._targetSize(elem);
      if (!t.x || !t.y || t.x < minDimension || t.y < minDimension) {
        return;
      }
      elementObjArray.push({ elem: elem, size: (t.x * t.y), type: 1});
    });
    if (!elementObjArray.length || elementObjArray.length === 0)  {
      return;
    }
    function compareElements(a, b) {
      // sort type '1' to the top,
      // then sort by size
      if (a.type === b.type) {
         if (b.size >= a.size) {
           return 1;
         } else {
           return -1;
         }
      } else {
         if (b.type >= a.type) {
           return 1;
         } else {
           return -1;
         }
      }
    }
    elementObjArray = elementObjArray.sort(compareElements);

    var uniqueElementObjArray = [];
    for (var inx = 0; (inx < elementObjArray.length); inx++) {
      var addElement = true;
      for (var jnx = 0; (jnx < elementObjArray.length && addElement); jnx++) {
        // add check to see the any of the objects are children of other elements in the array, if so, don't add it.
        if (jnx !== inx) {
          addElement = !elementObjArray[jnx].elem.contains(elementObjArray[inx].elem);
        }
      }
      if (addElement) {
        uniqueElementObjArray.push(elementObjArray[inx]);
      }
    }

    for (var inx = 0; (inx < uniqueElementObjArray.length); inx++) {
      var elem =  uniqueElementObjArray[inx].elem;
      if (uniqueElementObjArray[inx].type === 1) {
        let mediatype = typeMap.get(elem.localName);
        picreplacement.augmentIfAppropriate({el: elem, elType: mediatype, blocked: true}, function(response) {
          if (response) {
            // on some sites, such as freepik.com with absolute positioning,
            // the position of other elements is calculated before our pic replacement is injected.
            // a forced window resize event repaints the page to correctly lay it out
            window.dispatchEvent(new Event('resize'));
            chrome.runtime.sendMessage({ message: 'recordOneAdReplaced' });
          }
        });
      } else {
        picreplacement.augmentIfAppropriate({el: elem}, function(response) {
          if (response) {
            // on some sites, such as freepik.com with absolute positioning,
            // the position of other elements is calculated before our pic replacement is injected.
            // a forced window resize event repaints the page to correctly lay it out
            window.dispatchEvent(new Event('resize'));
            chrome.runtime.sendMessage({ message: 'recordOneAdReplaced' });
          }
        });
      }
    };
});
var picreplacement = {
  // data: {el, elType, blocked}
  augmentIfAppropriate: function(data, callback) {
    if (!picreplacement.enabled) {
      callback(false);
    }
    if (data.elType in ElementTypes) {
        this._forceToOriginalSizeAndAugment(data.el, callback);
    } else if (this._inHiddenSection(data.el)) {
      this._replaceHiddenSectionContaining(data.el, callback);
    }
  },
  augmentDivIfAppropriate: function(data, callback) {
    if (!picreplacement.enabled) {
      callback(false);
    }
    this._replaceNonHiddenSectionContaining(data.el, callback);
  },

  _forceToOriginalSizeAndAugment: function(el, callback) {

    // We may have already augmented this element...
    if (el.dataset.picinjectionaugmented) {
      return;
    }

    var oldCssText = el.style.cssText;
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("display", "block", "important");
    var size = el.style.backgroundPosition.match(/^(\w+) (\w+)$/);
    if (size) {
      // Restore el.width&el.height to whatever they were before AdBlock.
      var dims = { width: size[1], height: size[2] };
      for (var dim in dims) {
        if (dims[dim] === "-1px")
          el.removeAttribute(dim);
        else
          el.setAttribute(dim, dims[dim]);
      }
    }

    this._replace(el, function(replaced) {
      if (replaced) {
        el.style.cssText = oldCssText; // Re-hide the section
        var addedImgs = document.getElementsByClassName("picinjection-image");
        for (var i = 0; i < addedImgs.length; i++) {
          var displayVal = window.getComputedStyle(addedImgs[i])["display"];
          if (displayVal === 'none') {
              addedImgs[i].style.display = "";
          }
        }
      }
      callback(replaced);
    });
  },

  // Given details about a picture and a target rectangle, return details
  // about how to place the picture in the target.
  //
  // pic object contains
  //   x - width
  //   y - height
  //   left - max crop allowed from left
  //   right - max crop allowed from right
  //   top - max crop allowed from top
  //   bot - max crop allowed from bottom
  //
  // target object contains
  //   x - width
  //   y - height
  //
  // result object contains
  //   x - width of background image to use (before crop)
  //   y - height of background image to use (before crop)
  //   top  - amount to offset top of photo in target to cause a vertical crop
  //   left - amount to offset left of photo in target to cause a horizontal crop
  //   width - width of visible area of result image
  //   height - height of visible area of result image
  //   offsettop  - amount to pad with blank space above picture
  //   offsetleft - amount to pad with blank space to left of picture
  //                These are used to center a picture in a tall or wide target
  _fit: function (pic, target) {
    var p=pic, t=target;
    // Step 0: if t.ratio > p.ratio, rotate |p| and |t| about their NW<->SE axes.
    if (!p.x) {
      p.x = p.width;
    }
    if (!p.y) {
      p.y = p.height;
    }
    if (!t.x) {
      t.x = t.width;
    }
    if (!t.y) {
      t.y = t.height;
    }
    if (!p.left) {
      p.left = 0;
    }
    if (!p.right) {
      p.right = 0;
    }
    if (!t.left) {
      t.left = 0;
    }
    if (!t.right) {
      t.right = 0;
    }
    // Our math in Step 1 and beyond relies on |t| being skinner than |p|.  We
    // rotate |t| and |p| about their NW<->SE axis if needed to make that true.
    var t_ratio = t.x / t.y;
    var p_ratio = p.x / p.y;

    if (t_ratio > p_ratio) {
      var rotate = this._rotate;
      rotate(pic);
      rotate(target);
      var result = this._fit(pic, target);
      rotate(pic);
      rotate(target);
      rotate(result);
      return result;
    }

    // |t| is skinnier than |p|, so we need to crop the picture horizontally.
    // Step 1: Calculate |crop_x|: total horizontal crop needed.
    var crop_max = Math.max(p.left + p.right, .001);
    // Crop as much as we must, but not past the max allowed crop.
    var crop_x = Math.min(p.x - p.y * t_ratio, crop_max);

    // Step 2: Calculate how much of that crop should be done on the left side
    // of the picture versus the right.

    // We will execute the crop by giving a background-image a CSS left offset,
    // so we only have to calculate the left crop and the right crop will happen
    // naturally due to the size of the target area not fitting the entire image.

    var crop_left = p.left * (crop_x / crop_max);

    // Step 3: Calculate how much we must scale up or down the original picture.

    var scale = t.x / (p.x - crop_x);

    // Scale the original picture and crop amounts in order to determine the width
    // and height of the visible display area, the x and y dimensions of the image
    // to display in it, and the crop amount to offset the image.  The end result
    // is an image positioned to show the correct pixels in the target area.

    var result = {};
    result.x = Math.round(p.x * scale);
    result.y = Math.round(p.y * scale);
    result.left = Math.round(crop_left * scale);
    result.width = Math.round(t.x);
    result.height = Math.round(result.y);

    // Step 4: Add vertical padding if we weren't allowed to crop as much as we
    // liked, resulting in an image not tall enough to fill the target.
    result.offsettop = Math.round((t.y - result.height) / 2);

    // Done!
    result.top = 0;
    result.offsetleft = 0;
    return result;
  },

  // Rotate a picture/target about its NW<->SE axis.
  _rotate: function(o) {
    var pairs = [ ["x", "y"], ["top", "left"], ["bot", "right"],
                  ["offsettop", "offsetleft"], ["width", "height"] ];
    pairs.forEach(function(pair) {
      var a = pair[0], b = pair[1], tmp;
      if (o[a] || o[b]) {
        tmp = o[b]; o[b] = o[a]; o[a] = tmp; // swap
      }
    });
  },

  _dim: function(el, prop) {
    function intFor(val) {
      // Match two or more digits; treat < 10 as missing.  This lets us set
      // dims that look good for e.g. 1px tall ad holders (cnn.com footer.)
      var match = (val || "").match(/^([1-9][0-9]+)(px)?$/);
      if (!match) {
        return undefined;
      }
      return parseInt(match[1]);
    }
    // all of valid elements that we care about should have a tagName
    if (el.tagName === undefined) {
      return undefined;
    }
    if (typeof el.getAttribute === 'function') {
      return ( intFor(el.getAttribute(prop)) ||
               intFor(window.getComputedStyle(el)[prop]) );
    } else {
      return intFor(window.getComputedStyle(el)[prop]);
    }
  },

  _parentDim: function(el, prop) {
    if (/facebook/.test(document.location.href))
      return undefined;
    var result = undefined;
    while (!result && el.parentNode) {
      result = this._dim(el.parentNode, prop);
      el = el.parentNode;
    }
    return result;
  },

  _targetSize: function(el) {
    var t = { x: this._dim(el, "width"), y: this._dim(el, "height") };
    var el_style = window.getComputedStyle(el);
    var el_position = el_style.position;
    t.position = el_position;
    if (!t.x && !t.y && !typeMap.get(el.localName) && el.hasChildNodes()) {
      // Since we're now injecting a 'user' stylesheet to hide elements, temporarily
      // setting the display to block to unhide the element will not work, so..
      // attempt to determine the size of one of children
      for (var i = 0; i < el.children.length; i++) {
        t = picreplacement._targetSize(el.children[i]);
        if (t.x && t.y) {
          break;
        }
      }
    }

    // Make it rectangular if ratio is appropriate, or if we only know one dim
    // and it's so big that the 180k pixel max will force the pic to be skinny.
    if (t.x && !t.y && t.x > 400)
      t.type = imageSizesMap.get("wide");
    else if (t.y && !t.x && t.y > 400)
      t.type = imageSizesMap.get("tall");
    else if ((Math.max(t.x,t.y) / Math.min(t.x,t.y) >= 1.5)  && (Math.max(t.x,t.y) / Math.min(t.x,t.y) < 7)) // false unless (t.x && t.y)
      t.type = (t.x > t.y ? imageSizesMap.get("wide") : imageSizesMap.get("tall"));
    else if (Math.max(t.x,t.y) / Math.min(t.x,t.y) > 7) // false unless (t.x && t.y)
      t.type = (t.x > t.y ? imageSizesMap.get("skinnywide") : imageSizesMap.get("skinnytall"));

    if (!t.type) // we didn't choose wide/tall
      t.type = ((t.x || t.y) > 125 ? imageSizesMap.get("big") : imageSizesMap.get("small"));

    return t;
  },

  // Returns placement details to replace |el|, or null
  // if we do not have enough info to replace |el|.
  _placementFor: function(el, callback) {
    var t = this._targetSize(el);
    var that = this;
    // returns true if the elements size is to small or unknown
    var _checkSize = function(t) {
      return (!t.x || !t.y || t.x < minDimension || t.y < minDimension);
    }
    if (_checkSize(t)) {
        // if there's previously calculate size, use it
        if (el.dataset && el.dataset.adblockSize) {
          t = JSON.parse(el.dataset.adblockSize);
        }
        if (_checkSize(t)) {
          callback(false);
          return false; // unknown dims or too small to bother
        }
    }
    if (window.getComputedStyle(el.parentNode).display === "none") {
      callback(false);
      return false;
    }
    chrome.runtime.sendMessage({ message: 'get_random_listing', opts: { width:t.x, height:t.y, type:t.type, position:t.position } }, function (pic) {

      if (!pic || pic.disabledOnPage) {
        callback(false);
        return false;
      }
      if (typeof pic.height === "string") {
        pic.height = Number(pic.height);
      }
      if (typeof pic.width === "string") {
        pic.width = Number(pic.width);
      }

      // If we only have one dimension, we may choose to use the picture's ratio;
      // but don't go over 180k pixels (so e.g. 1000x__ doesn't insert a 1000x1000
      // picture (cnn.com)).  And if an ancestor has a size, don't exceed that.
      var max = 180000;
      if (t.x && !t.y) {
        var newY = Math.round(Math.min(pic.height * t.x / pic.width, max / t.x));
        var parentY = that._parentDim(el, "height");
        t.y = (parentY ? Math.min(newY, parentY) : newY);
      }
      if (t.y && !t.x) {
        var newX = Math.round(Math.min(pic.width * t.y / pic.height, max / t.y));
        var parentX = that._parentDim(el, "width");
        t.x = (parentX ? Math.min(newX, parentX) : newX);
      }

      var result = that._fit(pic, t);

      result.url = pic.url;
      result.attribution_url = pic.attribution_url;
      result.photo_title = pic.title;
      result.info_url =  pic.attribution_url;
      result.type = t.type;
      result.t = t;
      result.listingHeight = pic.listingHeight;
      result.listingWidth = pic.listingWidth;
      callback(result);
    });
  },

  // Given a target element, replace it with a picture.
  // Returns the replacement element if replacement works, or null if the target
  // element could not be replaced.
  _replace: function(el, callback) {
    var that = this;
    this._placementFor(el, function(placement) {
      if (!placement) {
        callback(false);
        return false; // don't know how to replace |el|
      }
      if (document.getElementsByClassName("picreplacement-image").length > 1 && !(window.top === window && hostname ==="www.facebook.com")) {
        callback(false);
        return false;//we only want to show 2 ad per page
      }

      var newPic = document.createElement("img");

      newPic.classList.add("picreplacement-image");
      var css = {
        width: placement.width + "px",
        height: placement.height + "px",
        backgroundPosition: "-" + placement.left + "px -" + placement.top + "px",
        backgroundSize: placement.x + "px " + placement.y + "px",
        margin: placement.offsettop + "px " + placement.offsetleft + "px",
        // nytimes.com float:right ad at top is on the left without this
        "float": (window.getComputedStyle(el)["float"] || undefined),
      };
      newPic.width = placement.width + "px";
      newPic.height = placement.height + "px";
      for (var k in css) {
        newPic.style[k] = css[k];
      }
      // hotmail ad is position:absolute; we must match its placement.
      // battefield.play4free.net imgs are absolute; ad is not img. match it.
      // reddit homepage sometimes gets a whole screenful of white if
      // inserted <img> is inline instead of block like what it replaces.
      for (var k in {position:1,left:1,top:1,bottom:1,right:1,display:1}) {
        newPic.style[k] = window.getComputedStyle(el)[k];
      }

      // Prevent clicking through to ad
      newPic.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, false);

      // if the image fails to load, remove it
      newPic.addEventListener("error", function(e) {
        if (newPic.infoCard) {
          newPic.removeChild(newPic.infoCard);
        }
        newPic.parentNode.removeChild(newPic);
        return false;
      }, false);

      newPic.addEventListener("abort", function(e) {
        if (newPic.infoCard) {
          newPic.removeChild(newPic.infoCard);
        }
        newPic.parentNode.removeChild(newPic);
        return false;
      }, false);

      that._addInfoCardTo(newPic, placement);

      // No need to hide the replaced element -- regular AdBlock will do that.
      el.dataset.picreplacementreplaced = "true";

      el.parentNode.insertBefore(newPic, el);
      newPic.src = placement.url;
      if (window.getComputedStyle(newPic).display === "none") {
        newPic.style.display = "inline-block";
      }
      callback(true);
    });
  },

  // Add an info card to |newPic| that appears on hover.
  _addInfoCardTo: function(newPic, placement) {
    if (newPic.infoCard) {
      return;
    }

    // Create the info card the first time the user mouseover's the replaced image.
    // Then we can use jQuery's mouseenter and mouseleave to control when the
    // card comes and goes.
    newPic.addEventListener("mouseover", function(e) {
      if (newPic.infoCard) {
        return; // already created card
      }
      function after_jquery_is_available() {
        var cardsize = {
          width: placement.width,
          height: placement.height
        };
        function position_card(card) {
          var pos = $(newPic).offset();
          pos.top += (placement.height - cardsize.height) / 2;
          pos.left += (placement.width - cardsize.width) / 2;
          // is this okay, could cause an issue if 'newPic' is render slightly off screen
          if (pos.top < 0)
            pos.top = 0;
          if (pos.left < 0)
            pos.left = 0;
          card.css(pos);
        };

        newPic.infoCard = $("<div>", {
          "class": "picinjection-infocard",
          css: {
            "position": "absolute",
            "min-width": cardsize.width,
            "min-height": cardsize.height,
            "z-index": 1000000,
            "padding": 3,
            "box-sizing": "border-box",
            "border": "2px solid rgb(128, 128, 128)",
            "font": "'Lato', Arial, sans-serif",
            "color": "black",
            "background-color": "rgba(0, 0, 0, 0.7)",
          } });
        newPic.infoCard.appendTo("body");

        var adblockImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-AdBlockLogoLarge.png");
        var adblockImageWidth = "114px";
        var adblockImageHeight = "29px";
        var viewImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-viewLarge.png");
        var viewWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-viewLarge.png");
        var viewImageWidth = "25px";
        var viewImageHeight = "15px";
        var settingsImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-settingsLarge.png");
        var settingsWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-settingsLarge.png");
        var settingsImageWidth = "18px";
        var settingsImageHeight = "18px";
        var closeImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-closeLarge.png");
        var closeWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-closeLarge.png");
        var closeImageWidth = "15px";
        var closeImageHeight = "14px";
        var wrapperHeight = "18px";
        var wrapperWidth = "90px";
        if (placement.type !== imageSizesMap.get("skinnywide") && window.devicePixelRatio >= 2) {
          adblockImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-AdBlockLogoLarge@2x.png");
          viewImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-viewLarge@2x.png");
          settingsImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-settingsLarge@2x.png");
          closeImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-closeLarge@2x.png");
          viewWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-viewLarge@2x.png");
          settingsWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-settingsLarge@2x.png");
          closeWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-closeLarge@2x.png");
        }
        else if (placement.type === imageSizesMap.get("skinnywide") && window.devicePixelRatio < 2) {
          adblockImageWidth = "81px";
          adblockImageHeight = "20px";
          viewImageWidth = "17px";
          viewImageHeight = "10px";
          settingsImageWidth = "14px";
          settingsImageHeight = "14px";
          closeImageWidth = "11px";
          closeImageHeight = "10px";
          adblockImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-AdBlockLogoSmall.png");
          viewImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-view.png");
          settingsImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-settings.png");
          closeImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-close.png");
          viewWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-view.png");
          settingsWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-settings.png");
          closeWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-close.png");
        }
        else if (placement.type === imageSizesMap.get("skinnywide") && window.devicePixelRatio >= 2) {
          adblockImageWidth = "81px";
          adblockImageHeight = "20px";
          viewImageWidth = "17px";
          viewImageHeight = "10px";
          settingsImageWidth = "14px";
          settingsImageHeight = "14px";
          closeImageWidth = "11px";
          closeImageHeight = "10px";
          adblockImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-AdBlockLogoSmall@2x.png");
          viewImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-view@2x.png");
          settingsImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-settings@2x.png");
          closeImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-close@2x.png");
          viewWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-view@2x.png");
          settingsWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-settings@2x.png");
          closeWhiteImageURL = chrome.extension.getURL("icons/adblock-picreplacement-images-whites-close@2x.png");
        }
        var linkWrapper = $("<div>", {
          css: {
            "margin-top": "0px",
            "margin-right": "0px",
            "vertical-align": "middle",
            "line-height" : adblockImageHeight,
            width: wrapperWidth,
            height: adblockImageHeight,
            float: "right",
            display: "inline",
          }
        });
        linkWrapper.append($("<img>", {
            css: {
              border: "none",
              "margin-right": "15px",
              "vertical-align": "middle",
              display: "inline",
            },
            height: viewImageHeight,
            width: viewImageWidth,
            src: viewImageURL,
            click: function() {
              BGcall("openTab", "adblock-picreplacement-imageview.html" + "?url=" + encodeURIComponent(placement.attribution_url) + "&width=" + placement.listingWidth + "&height=" + placement.listingHeight );
            },
            on: {
              mouseenter: function( event ) {
                $(this).attr("src",viewWhiteImageURL);
              },
              mouseleave: function( event ) {
                $(this).attr("src",viewImageURL);
              }
            }
          })).
          append($("<img>", {
            css: {
              border: "none",
              "margin-right": "15px",
              "vertical-align": "middle",
              display: "inline",
            },
            height: settingsImageHeight,
            width: settingsImageWidth,
            src: settingsImageURL,
            click: function() {
              BGcall("openTab", "options.html?tab=0" );
            },
            on: {
              mouseenter: function( event ) {
                $(this).attr("src",settingsWhiteImageURL);
              },
              mouseleave: function( event ) {
                $(this).attr("src",settingsImageURL);
              }
            }
          })).
          append($("<img>", {
            css: {
              border: "none",
              "vertical-align": "middle",
              display: "inline",
            },
            height: closeImageHeight,
            width: closeImageWidth,
            src: closeImageURL,
            click: function() {
              newPic.infoCard.remove();
              $(newPic).remove();
            },
            on: {
              mouseenter: function( event ) {
                $(this).attr("src",closeWhiteImageURL);
              },
              mouseleave: function( event ) {
                $(this).attr("src",closeImageURL);
              }
            }
          }));
        linkWrapper.appendTo(newPic.infoCard);
        if (placement.width > 240) {
          newPic.infoCard.append($("<img>", {
              css: {
                float: "left",
                // independent.co.uk borders all imgs
                border: "none",
                "margin-top": "0px",
                "margin-left": "0px",
              },
              height: adblockImageHeight,
              width: adblockImageWidth,
              src: adblockImageURL
            }));
         } else {
            newPic.infoCard.append($("<img>", {
                css: {
                  // independent.co.uk borders all imgs
                  border: "none",
                  left: "0px",
                  right: "0px",
                  position: "absolute",
                  bottom: "15px",
                  margin: "auto",
                },
                height: adblockImageHeight,
                width: adblockImageWidth,
                src: adblockImageURL
              }));
         }
        // Now that all the elements are on the card so it knows its height...
        position_card(newPic.infoCard);

        $(newPic).mouseover(function() {
          $(".picinjection-infocard:visible").hide();
          // newPic may have moved relative to the document, so recalculate
          // position before showing.
          position_card(newPic.infoCard);
          newPic.infoCard.show();
        });
        // Known bug: mouseleave is not called if you mouse over only 1 pixel
        // of newPic, then leave.  So infoCard is not removed.
        newPic.infoCard.mouseleave(function() {
          $(".picinjection-infocard:visible").hide();
        });
      }
      if (typeof jQuery !== "undefined") {
        after_jquery_is_available();
      }
      else {
        chrome.extension.sendRequest(
          { command:"picreplacement_inject_jquery", allFrames: (window !== window.top) }, function() {
            after_jquery_is_available();
          });
      }
    }, false);
  },

  // Returns true if |el| or an ancestor was hidden by an AdBlock hiding rule.
  _inHiddenSection: function(el) {
    for (var inx = 0; inx < cssRules.length; inx++) {
      if (el.matches(cssRules[inx])) {
        return true;
      }
    }
    return false;
  },

  // Find the ancestor of el that was hidden by AdBlock, and replace it
  // with a picture.  Assumes _inHiddenSection(el) is true.
  _replaceHiddenSectionContaining: function(el, callback) {
    // Find the top hidden node (the one AdBlock originally hid)
    while (this._inHiddenSection(el.parentNode)){
      el.parentNode.dataset.adblockSize = el.dataset.adblockSize;
      el = el.parentNode;
    }
    // We may have already replaced this section...
    if (el.dataset.picreplacementreplaced)
      return;

    var oldCssText = el.style.cssText;
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("display", "block", "important");

    this._replace(el, callback);

    el.style.cssText = oldCssText; // Re-hide the section
  },

  // For use when a Div is not yet hidden by the hideElement() function.
  // The dimensions for hidden DIV and other elements can not be determined, so
  // we calculate the size before hiding them.
  _replaceNonHiddenSectionContaining: function(el, callback) {
    // We may have already replaced this section...
    if (el.dataset.picreplacementreplaced) {
      return;
    }

    var oldCssText = el.style.cssText;
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("display", "block", "important");

    this._replace(el, callback);

    el.style.cssText = oldCssText; // Re-hide the section
  },

  translate: function(key) {
    return chrome.i18n.getMessage(key);
  },
}; // end picreplacement