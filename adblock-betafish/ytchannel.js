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
    chrome.runtime.sendMessage({
      command: "get_channel_name_by_channel_id",
      channelId: getChannelId(url)
    });
  }
  else if (/watch/.test(url))
  {
    chrome.runtime.sendMessage({
      command: "get_channel_name_by_video_id",
      videoId: getVideoId(url)
    });
  }
  else if (/user/.test(url))
  {
    var userId = getUserId(url);
    if (!userId) {
      chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: false });
    } else {
      chrome.runtime.sendMessage({
        command: "get_channel_name_by_user_id",
        userId: userId
      });
    }
  } else {
    chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: false });
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

  // Get id of the user
  function getUserId(url)
  {
    let pathName = parseUri(location.href).pathname;
    if (pathName.startsWith("/user/") && pathName.length > 6) {
      return pathName.slice(6);
    }
  }


  // Function which: - adds name of the channel on the end of the URL,
  //                   e.g. &ab_channel=nameofthechannel
  //                 - reload the page, so AdBlock can properly whitelist
  //                   the page (just if channel is whitelisted by user)
  function updateURL(channelName, shouldReload) {
    // check that the url hasn't changed
    if (channelName && url === document.location.href) {
      const parsedChannelName = parseChannelName(channelName);
      let updatedUrl;
      let [baseUrl] = url.split('&ab_channel');
      [baseUrl] = baseUrl.split('?ab_channel');
      if (parseUri(url).search.indexOf('?') === -1) {
        updatedUrl = `${baseUrl}?&ab_channel=${parsedChannelName}`;
      } else {
        updatedUrl = `${baseUrl}&ab_channel=${parsedChannelName}`;
      }

      // Add the name of the channel to the end of URL
      window.history.replaceState(null, null, updatedUrl);

      // |shouldReload| is true only if we are not able to get
      // name of the channel by using YouTube Data v3 API
      if (shouldReload) {
        // Reload page from cache, if it should be whitelisted
        BGcall('pageIsWhitelisted', updatedUrl, (whitelisted) => {
          if (whitelisted) {
            document.location.reload(false);
          }
        });
      }
    }
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
  if (msg.command === 'updateURLWithYouTubeChannelName') {
    updateURL(msg.channelName, true);
  }
}
chrome.runtime.onMessage.addListener(onMessage);
