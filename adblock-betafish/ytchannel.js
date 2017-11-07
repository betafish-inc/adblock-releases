// Store actual URL
var url = document.location.href;

// used to decode all encoded HTML  (convert '&' to &amp;)
var parseElem = document.createElement('textarea');

var parseChannelName = function(channelName) {
  function fixedEncodeURIComponent (str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16);
    });
  }
  parseElem.innerHTML = channelName;
  channelName = parseElem.innerText;
  // Remove whitespace, and encode
  return fixedEncodeURIComponent(channelName.replace(/\s/g,""));
};

if (!/ab_channel/.test(url))
{
  // Get name of the channel by using YouTube Data v3 API
  if (/channel/.test(url))
  {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + getChannelId(url) + "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"));
    xhr.onload = function()
    {
      if (xhr.readyState === 4 && xhr.status === 200)
      {
        var json = JSON.parse(xhr.response);
        // Got name of the channel
        if (json.items[0])
        {
          updateURL(json.items[0].snippet.title, true);
        }
      }
    }
    xhr.send(null);
  }
  else if (/watch/.test(url))
  {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + getVideoId(url) + "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"));
    xhr.onload = function()
    {
      if (xhr.readyState === 4 && xhr.status === 200)
      {
        var json = JSON.parse(xhr.response);
        // Got name of the channel
        if (json.items[0])
        {
          updateURL(json.items[0].snippet.channelTitle, false);
        }
      }
    }
    xhr.send(null);
  }
  else
  {
    if (/user/.test(url))
    {
      document.addEventListener("spfdone", function()
      {
        var channelNameElement = document.querySelector("span .qualified-channel-title-text > a");
        if (channelNameElement)
        {
          var channelName = document.querySelector("span .qualified-channel-title-text > a").textContent;
          updateURL(channelName, true);
        }
      }, true);
      // Spfdone event doesn't fire, when you access YT user directly
      window.addEventListener("DOMContentLoaded", function()
      {
        var channelNameElement = document.querySelector("span .qualified-channel-title-text > a");
        if (channelNameElement)
        {
          var channelName = channelNameElement.textContent;
          updateURL(channelName, true);
        }
      }, true);
    }
  }

  // Get id of the channel
  function getChannelId(url)
  {
    return parseUri(url).pathname.split("/")[2];
  }

  // Get id of the video
  function getVideoId(url)
  {
    return parseUri.parseSearch(url).v;
  }

  // Function which: - adds name of the channel on the end of the URL, e.g.
  // &channel=nameofthechannel
  // - reload the page, so AdBlock can properly whitelist the page (just if
  // channel is whitelisted by user)
  function updateURL(channelName, isChannel)
  {
    channelName = parseChannelName(channelName);
    // Add the name of the channel to the end of URL
    if (isChannel)
    {
      var updatedUrl = url + "?&ab_channel=" + channelName.replace(/\s/g, "");
    }
    else
    {
      var updatedUrl = url + "&ab_channel=" + channelName.replace(/\s/g, "");
    }
    window.history.replaceState(null, null, updatedUrl);
    // Reload page from cache, just if it should be whitelisted
    BGcall("pageIsWhitelisted", function(whitelisted)
    {
      if (whitelisted)
      {
        window.location.reload(false);
      }
    });
  }
}

// Reload the stylesheet when we recieve a message from the background page to do so.
function onMessage(msg)
{
  if (msg.type == "reloadStyleSheet")
  {
    elemhide = new ElemHide();
    elemhide.apply();
  }
}
chrome.runtime.onMessage.addListener(onMessage);
