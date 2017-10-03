chrome.storage.local.get("userid", function(response) {
  if (response &&
      response.userid) {
    window.location.href = "https://getadblock.com/installed/?u=" + response.userid + "&lg=" + chrome.i18n.getUILanguage();
  } else {
    ext.backgroundPage.sendMessage({command: "get_adblock_user_id"}, function(userID) {
      if (userID) {
        window.location.href = "https://getadblock.com/installed/?u=" + userID + "&lg=" + chrome.i18n.getUILanguage();
      }
    });
  }
});