'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, parseUri, BGcall, ElemHide */

(function onPageLoad() {
  // Store actual URL
  const urlOnPageLoad = document.location.href;

  // used to decode all encoded HTML  (convert '&' to &amp;)
  const parseElem = document.createElement('textarea');

  const parseChannelName = function (channelNameToParse) {
    function fixedEncodeURIComponent(str) {
      return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
    }
    // TODO: refactor code to resolve no-unsanitized errors
    // eslint-disable-next-line no-unsanitized/property
    parseElem.innerHTML = channelNameToParse;
    const channelName = parseElem.innerText;
    // Remove whitespace, and encode
    return fixedEncodeURIComponent(channelName.replace(/\s/g, ''));
  };

  // Get id of the channel
  const getChannelId = function (channelUrl) {
    return parseUri(channelUrl).pathname.split('/')[2];
  };

  // Get id of the video
  const getVideoId = function (channelUrl) {
    return parseUri.parseSearch(channelUrl).v;
  };

  // Get id of the user
  const getUserId = function () {
    const pathName = parseUri(document.location.href).pathname;
    if (pathName.startsWith('/user/') && pathName.length > 6) {
      return pathName.slice(6);
    }
    return null;
  };

  // Function which: - adds name of the channel on the end of the URL,
  //                   e.g. &ab_channel=nameofthechannel
  //                 - reload the page, so AdBlock can properly whitelist
  //                   the page (just if channel is whitelisted by user)
  const updateURL = function (channelName, shouldReload) {
    // check that the url hasn't changed
    if (channelName && urlOnPageLoad === document.location.href) {
      const parsedChannelName = parseChannelName(channelName);
      let updatedUrl;
      let [baseUrl] = urlOnPageLoad.split('&ab_channel');
      [baseUrl] = baseUrl.split('?ab_channel');
      if (parseUri(urlOnPageLoad).search.indexOf('?') === -1) {
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
  };

  if (!/ab_channel/.test(urlOnPageLoad)) {
    // Get name of the channel by using YouTube Data v3 API
    if (/channel/.test(urlOnPageLoad)) {
      chrome.runtime.sendMessage({
        command: 'get_channel_name_by_channel_id',
        channelId: getChannelId(urlOnPageLoad),
      });
    } else if (/watch/.test(urlOnPageLoad)) {
      chrome.runtime.sendMessage({
        command: 'get_channel_name_by_video_id',
        videoId: getVideoId(urlOnPageLoad),
      });
    } else if (/user/.test(urlOnPageLoad)) {
      const userId = getUserId(urlOnPageLoad);
      if (!userId) {
        chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: false });
      } else {
        chrome.runtime.sendMessage({
          command: 'get_channel_name_by_user_id',
          userId,
        });
      }
    } else {
      chrome.runtime.sendMessage({ command: 'updateYouTubeChannelName', args: false });
    }
  }

  // Reload the stylesheet when we receive a message from the background page to do so.
  function onMessage(msg) {
    if (msg.type === 'reloadStyleSheet') {
      const elemhide = new ElemHide();
      elemhide.apply();
    }
    if (msg.command === 'updateURLWithYouTubeChannelName') {
      updateURL(msg.channelName, true);
    }
  }

  chrome.runtime.onMessage.addListener(onMessage);
}());
