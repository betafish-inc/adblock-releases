$(document).ready(function () {

  if (navigator.language.substring(0, 2) != 'en')
  {
    $('.english-only').removeClass('do-not-display');
  }
  // Show debug info
  $('#debug').click(function () {
    var  debugInfo = null;
    var showDebugInfo = function () {
      $('#debugInfo').text(debugInfo).
        css({ width: '450px', height: '100px' }).
        fadeIn();
    };
    // Get debug info
    backgroundPage.getDebugInfo(function (theDebugInfo) {
      var content = [];
      if (theDebugInfo.subscriptions) {
        content.push('=== Filter Lists ===');
        for (var sub in theDebugInfo.subscriptions) {
          content.push('Id:' + sub);
          content.push('  Download Count: ' + theDebugInfo.subscriptions[sub].downloadCount);
          content.push('  Download Status: ' + theDebugInfo.subscriptions[sub].downloadStatus);
          content.push('  Last Download: ' + theDebugInfo.subscriptions[sub].lastDownload);
          content.push('  Last Success: ' + theDebugInfo.subscriptions[sub].lastSuccess);
        }
      }

      content.push('');

      // Custom & Excluded filters might not always be in the object
      if (theDebugInfo.custom_filters) {
        content.push('=== Custom Filters ===');
        content.push(theDebugInfo.custom_filters);
        content.push('');
      }

      if (theDebugInfo.exclude_filters) {
        content.push('=== Exclude Filters ===');
        content.push(JSON.stringify(theDebugInfo.exclude_filters));
      }

      content.push('=== Settings ===');
      for (var setting in theDebugInfo.settings) {
        content.push(setting + ' : ' + theDebugInfo.settings[setting]);
      }

      content.push('');
      content.push('=== Other Info ===');
      content.push(JSON.stringify(theDebugInfo.other_info, null, '\t'));

      // Put it together to put into the textbox
      debugInfo = content.join('\n');

      chrome.permissions.request({
        permissions: ['management'],
      }, function (granted) {
        // The callback argument will be true if the user granted the permissions.
        if (granted) {
          chrome.management.getAll(function (result) {
            var extInfo = [];
            extInfo.push('==== Extension and App Information ====');
            for (var i = 0; i < result.length; i++) {
              extInfo.push('Number ' + (i + 1));
              extInfo.push('  name: ' + result[i].name);
              extInfo.push('  id: ' + result[i].id);
              extInfo.push('  version: ' + result[i].version);
              extInfo.push('  enabled: ' + result[i].enabled);
              extInfo.push('  type: ' + result[i].type);
              extInfo.push('');
            }

            debugInfo =  debugInfo + '  \n\n' + extInfo.join('  \n');
            showDebugInfo();
            chrome.permissions.remove({
              permissions: ['management'],
            }, function (removed) {});
          });
        } else {
          debugInfo =  debugInfo + '\n\n==== User Denied Extension and App Permissions ====';
          showDebugInfo();
        }
      });
    });
  });

  // Show the changelog
  $('#whatsnew_link').click(function ()
  {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('CHANGELOG.txt'), false);
    xhr.send();
    var object = xhr.responseText;
    $('#changes').text(object).css({ width: '670px', height: '200px' }).fadeIn();
    $("body, html").animate({
      scrollTop: $('#changes').offset().top
    }, 1000);
  });
});
