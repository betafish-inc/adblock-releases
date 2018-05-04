
var subscription1 = Subscription.fromURL(getUrlFromId("antisocial"));
var subscription2 = Subscription.fromURL(getUrlFromId("annoyances"));
// Inputs: width:int, height:int, url:url, title:string, attribution_url:url
function Listing(data) {
  this.width = data.width;
  this.height = data.height;
  this.url = data.url;
  this.title = data.title;
  this.attribution_url = data.attribution_url;
  if (data.name) {
    this.name = data.name;
  }
  if (data.thumbURL) {
    this.thumbURL = data.thumbURL;
  }
  if (data.userLink) {
    this.userLink = data.userLink
  }
  if (data.anySize) {
    this.anySize = data.anySize;
  }
  if (data.type) {
    this.type = data.type;
  }
  if (data.ratio) {
    this.ratio = data.ratio;
  }
};

// Contains and provides access to all the photo channels.
function Channels() {
  var that = this;
  this._channelGuide = undefined; // maps channel ids to channels and metadata
  this._loadFromStorage();
}
Channels.prototype = {
  // Inputs:
  //   name:string - a Channel class name.
  //   param:object - the single ctor parameter to the Channel class.
  //   enabled:bool - true if this channel is to be used for pictures.
  // Returns:
  //   id of newly created channel, or undefined if the channel already existed.
  add: function(data) {
    var klass = window[data.name];
    if (!klass)
      return;
    var dataParam = JSON.stringify(data.param);
    for (var id in this._channelGuide) {
      var c = this._channelGuide[id];
      if (c.name === data.name && JSON.stringify(c.param) === dataParam)
        return;
    }
    var id = Math.floor(Math.random() * Date.now());
    var channel = new klass(data.param);
    this._channelGuide[id] = {
      name: data.name,
      param: data.param,
      enabled: data.enabled,
      channel: channel
    };
    this._saveToStorage();
    var that = this;
    $(channel).bind("updated", function(event) {
      chrome.extension.sendRequest({command: "channel-updated", id: id});
      if (that._channelGuide[id].enabled)
        that._channelGuide[id].channel.prefetch();
    });
    channel.refresh();
    return id;
  },

  remove: function(channelId) {
    delete this._channelGuide[channelId];
    this._saveToStorage();
  },

  // Return read-only map from each channel ID to
  // { name, param, enabled }.
  getGuide: function() {
    var results = {};
    for (var id in this._channelGuide) {
      var c = this._channelGuide[id];
      results[id] = {
        name: c.name,
        param: c.param,
        enabled: c.enabled,
      };
    }

    return results;
  },

  getListings: function(id) {
    return this._channelGuide[id].channel.getListings();
  },
  setEnabled: function(id, enabled) {
    this._channelGuide[id].enabled = enabled;
    this._saveToStorage();
  },

  refreshAllEnabled: function() {
    for (var id in this._channelGuide) {
      var data = this._channelGuide[id];
      if (data.enabled)
        data.channel.refresh();
    }
  },

  // Returns a random Listing from all enabled channels or from channel
  // |channelId| if specified, trying to match the ratio of |width| and
  // |height| decently.  Returns undefined if there are no enabled channels.
  randomListing: function(opts) {
    if (!getSettings().picreplacement) {
      return undefined;
    }
    // if the element to be replace is 'fixed' in position, it may make for bad pic replacement element.
    if (opts.position === "fixed") {
      for (var inx = 0; inx < FilterStorage.subscriptions.length; inx++) {
        var sub = FilterStorage.subscriptions[inx];
        if (sub.url === subscription1.url || sub.url === subscription2.url) {
          return undefined;
        }
      }
    }

    var heightLowRange = opts.height;
    var widthLowRange = opts.width;
    var heightHighRange = (opts.height * 1.25);
    var widthHighRange = (opts.width * 1.25);
    var targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
    var typeMatchListings = [];
    var rangeLimitedListings = [];

    for (var id in this._channelGuide) {
      var data = this._channelGuide[id];
      if (opts.channelId === id || (data.enabled && !opts.channelId)) {
        data.channel.getListings().forEach(function(element) {
            if ((opts.type === WIDE || opts.type === SKINNYWIDE) &&
                 (element.type !== SKINNYTALL) &&
                 (element.width <= widthHighRange) &&
                 (element.height >= heightLowRange) &&
                 (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            } else if ((opts.type === TALL || opts.type === SKINNYTALL) &&
                (element.type !== SKINNYWIDE) &&
                (element.width >= widthLowRange) &&
                (element.width <= widthHighRange) &&
                (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            } else if ((opts.type !== WIDE) &&
                (opts.type !== TALL) &&
                (opts.type !== SKINNYTALL) &&
                (opts.type !== SKINNYWIDE) &&
                (element.width >= widthLowRange) &&
                (element.width <= widthHighRange) &&
                (element.height >= heightLowRange) &&
                (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            }
            if (opts.type === element.type &&
                element.width >= widthLowRange &&
                element.height >= heightLowRange) {
              typeMatchListings.push(element);
            }
        });
      }
    }
    var exactTypeMatchListings = [];
    if (rangeLimitedListings.length > 0) {
      var randomIndex = Math.floor(Math.random() * rangeLimitedListings.length);
      var theListing = Object.assign({}, rangeLimitedListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      if (opts.height !== theListing.height && opts.width !== theListing.width) {
        theListing.height = (theListing.height * opts.width) / theListing.width;
        theListing.width = opts.width;
      }
      return theListing;
    } else {
      var bestMatch = null;
      var bestMatchRatio = 0;
      var targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
      typeMatchListings.forEach(function(listing) {
        if (Math.abs(listing.ratio - targetRatio) < Math.abs(bestMatchRatio - targetRatio)) {
          exactTypeMatchListings = []; // remove previous matches
          exactTypeMatchListings.push(listing);
          bestMatch = listing;
          bestMatchRatio = listing.ratio;
        } else if (listing.ratio === bestMatchRatio) {
          exactTypeMatchListings.push(listing);
        }
      });
      if (exactTypeMatchListings.length > 0) {
        var randomIndex = Math.floor(Math.random() * exactTypeMatchListings.length);
        var theListing = Object.assign({}, exactTypeMatchListings[randomIndex]);
        theListing.listingHeight = theListing.height;
        theListing.listingWidth = theListing.width;
        return theListing;
      }
    }
    return undefined;
  },

  _loadFromStorage: function() {
    this._channelGuide = {};

    var entries = storage_get("channels");
    if (!entries || (entries.length > 0 && !entries[0].name)) {
      this.add({name: "DogsChannel", param: undefined,
                enabled: true});
      this.add({name: "CatsChannel", param: undefined,
                enabled: true});
      this.add({name: "LandscapesChannel", param: undefined,
                enabled: true});
    }
    else {
      for (var i=0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
  },

  _saveToStorage: function() {
    var toStore = [];
    var guide = this.getGuide();
    for (var id in guide)
      toStore.push(guide[id]);
    storage_set("channels", toStore);
  },

};


// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
function Channel() {
  this.__listings = [];
};
Channel.prototype = {
  getListings: function() {
    return this.__listings.slice(0); // shallow copy
  },

  // Update the channel's listings and trigger an 'updated' event.
  refresh: function() {
    var that = this;
    this._getLatestListings(function(listings) {
      that.__listings = listings;
      $(that).trigger("updated");
    });
  },

  // Load all photos so that they're in the cache.
  prefetch: function() {
    //current - noop, since all of the URLs are hard coded.
  },

  _getLatestListings: function(callback) {
    throw "Implemented by subclass. Call callback with up-to-date listings.";
  },

  _calculateType: function(w, h) {
    if (typeof w === "string") {
      w = parseInt(w, 10);
    }
    if (typeof h === "string") {
      h = parseInt(h, 10);
    }
    var type = "";
    var ratio = Math.max(w,h) / Math.min(w, h);
    if (ratio >= 1.5 && ratio < 7) {
      type = (w > h ? imageSizesMap.get("wide") : imageSizesMap.get("tall"));
    } else if (ratio > 7) {
      type = (w > h ? imageSizesMap.get("skinnywide") : imageSizesMap.get("skinnytall"));
    } else {
      type = ((w > 125 || h > 125)  ? imageSizesMap.get("big") : imageSizesMap.get("small"));
    }
    return type;
  }
};