'use strict';
var BG = chrome.extension.getBackgroundPage();
$(document).ready(function () {
    localizePage();
    if (window.location &&
      window.location.search)
    {
      var searchQuery = parseUri.parseSearch(window.location.search);
      if (searchQuery &&
          searchQuery.url)
      {
        var newPic = document.createElement("img");
        newPic.src = searchQuery.url;
        newPic.classList.add("center");
        var sectionEl = document.getElementById("imgDIV");
        if (searchQuery.width) {
          newPic.width = searchQuery.width;
        }
        if (searchQuery.height) {
          newPic.height = searchQuery.height;
        }
        newPic.style.cssText = "background-position: 0px 0px; float: none;left: auto; top: auto; bottom: auto; right: auto; display: inline-block; width: " + searchQuery.width + "px; height: " + searchQuery.height + "px;";
        sectionEl.appendChild(newPic);
      }
    }
});