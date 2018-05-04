'use strict';
var BG = chrome.extension.getBackgroundPage();
var myAdBlockOptionsStorageKey = "myadblockoptions";

function saveMyAdBlockSettings() {
  var currentOptions = {};
  var saveData = {};
  saveData[myAdBlockOptionsStorageKey] = currentOptions;
  currentOptions.catChannelSwitch = $("#catChannelSwitch").is(":checked");
  currentOptions.dogChannelSwitch = $("#dogChannelSwitch").is(":checked");
  currentOptions.landscapeChannelSwitch = $("#landscapeChannelSwitch").is(":checked");
  chrome.storage.local.set(saveData);
}

$(document).ready(function ()
{
  localizePage();
  var guide = BG.channels.getGuide();
  var currentMyAdBlockSetting = BG.getSettings().picreplacement;
  for (var id in guide) {
    if (guide[id].name === "CatsChannel") {
      $("#catChannelSwitch").data( "channelid", id );
      $("#catChannelSwitch").prop('checked', guide[id].enabled && currentMyAdBlockSetting);
    }
    if (guide[id].name === "DogsChannel") {
      $("#dogChannelSwitch").data( "channelid", id );
      $("#dogChannelSwitch").prop('checked', guide[id].enabled && currentMyAdBlockSetting);
    }
    if (guide[id].name === "LandscapesChannel") {
      $("#landscapeChannelSwitch").data( "channelid", id );
      $("#landscapeChannelSwitch").prop('checked', guide[id].enabled && currentMyAdBlockSetting);
    }
  }
  $('#picReplacementSwitch').prop('checked', currentMyAdBlockSetting);
  $('input[type=\'checkbox\']').change(function () {
    var channelId = $(this).data("channelid");
    if (channelId) {
      BG.channels.setEnabled(channelId, $(this).is(":checked"));
      if (!$("#catChannelSwitch").is(":checked") &&
          !$("#dogChannelSwitch").is(":checked") &&
          !$("#landscapeChannelSwitch").is(":checked")) {  // if all of the individual settings are disabled, disable myAdBlock
          $('#picReplacementSwitch').prop('checked', false);
          BG.setSetting("picreplacement", false);
      } else if (!$('#picReplacementSwitch').is(":checked") &&
                 ($("#catChannelSwitch").is(":checked") ||
                  $("#dogChannelSwitch").is(":checked") ||
                  $("#landscapeChannelSwitch").is(":checked"))) {  // if any of the individual settings are enabled, enable myAdBlock
            $('#picReplacementSwitch').prop('checked', true);
            BG.setSetting("picreplacement", true);
      }
    } else {
      BG.setSetting("picreplacement", $(this).is(":checked"));
      if ($('#picReplacementSwitch').is(":checked")) { // if they've re-enabled the feature, load any saved settings
        chrome.storage.local.get(myAdBlockOptionsStorageKey, function(savedData) {
          $("#catChannelSwitch").prop('checked', savedData[myAdBlockOptionsStorageKey].catChannelSwitch);
          $("#dogChannelSwitch").prop('checked', savedData[myAdBlockOptionsStorageKey].dogChannelSwitch);
          $("#landscapeChannelSwitch").prop('checked', savedData[myAdBlockOptionsStorageKey].landscapeChannelSwitch);
          var channelId = $("#catChannelSwitch").data("channelid");
          BG.channels.setEnabled(channelId, savedData[myAdBlockOptionsStorageKey].catChannelSwitch);
          channelId = $("#dogChannelSwitch").data("channelid");
          BG.channels.setEnabled(channelId, savedData[myAdBlockOptionsStorageKey].dogChannelSwitch);
          channelId = $("#landscapeChannelSwitch").data("channelid");
          BG.channels.setEnabled(channelId, savedData[myAdBlockOptionsStorageKey].landscapeChannelSwitch);
        });
      } else { // save current individual settings, and then disable any individual options
        saveMyAdBlockSettings();
        $("#catChannelSwitch").prop('checked', false);
        var channelId = $("#catChannelSwitch").data("channelid");
        BG.channels.setEnabled(channelId, false);
        $("#dogChannelSwitch").prop('checked', false);
        channelId = $("#dogChannelSwitch").data("channelid");
        BG.channels.setEnabled(channelId, false);
        $("#landscapeChannelSwitch").prop('checked', false);
        channelId = $("#landscapeChannelSwitch").data("channelid");
        BG.channels.setEnabled(channelId, false);
      }
    }
  });
});