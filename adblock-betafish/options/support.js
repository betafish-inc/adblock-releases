$(document).ready(function ()
{

  // Check for updates
  $('#checkupdate').html(translate('checkforupdates'));
  if (!SAFARI)
  {
    chrome.runtime.requestUpdateCheck(function (response)
    {
      if (response === 'no_update')
      {
        $('#checkupdate').html(translate('latest_version')).show();
      } else if (response === 'update_available')
      {
        $('#checkupdate').html(translate('adblock_outdated_chrome')).show().find('a').click(function ()
        {
          if (OPERA)
          {
            chrome.tabs.create({ url: 'opera://extensions/' });
          } else
          {
            chrome.tabs.create({ url: 'chrome://extensions/' });
          }
        });
      }
    });
  }

  if (navigator.language.substring(0, 2) != 'en')
  {
    $('.english-only').css('display', 'inline');
  }
  // Show debug info
  $('#debug').click(function ()
  {
    var  debugInfo = null;
    var showDebugInfo = function ()
    {
      $('#debugInfo').text(debugInfo).
        css({ width: '450px', height: '100px' }).
        fadeIn();
    };
    // Get debug info
    backgroundPage.getDebugInfo(function (theDebugInfo)
    {
      var content = [];
      if (theDebugInfo.subscriptions)
      {
        content.push('=== Filter Lists ===');
        for (var sub in theDebugInfo.subscriptions)
        {
          content.push('Id:' + sub);
          content.push('  Download Count: ' + theDebugInfo.subscriptions[sub].downloadCount);
          content.push('  Download Status: ' + theDebugInfo.subscriptions[sub].downloadStatus);
          content.push('  Last Download: ' + theDebugInfo.subscriptions[sub].lastDownload);
          content.push('  Last Success: ' + theDebugInfo.subscriptions[sub].lastSuccess);
        }
      }

      content.push('');

      // Custom & Excluded filters might not always be in the object
      if (theDebugInfo.custom_filters)
      {
        content.push('=== Custom Filters ===');
        for (var filter in theDebugInfo.custom_filters)
        {
          content.push(theDebugInfo.custom_filters[filter]);
        }

        content.push('');
      }

      if (theDebugInfo.exclude_filters)
      {
        content.push('=== Exclude Filters ===');
        content.push(JSON.stringify(theDebugInfo.exclude_filters));
      }

      content.push('=== Settings ===');
      for (var setting in theDebugInfo.settings)
      {
        content.push(setting + ' : ' + theDebugInfo.settings[setting]);
      }

      content.push('');
      content.push('=== Other Info ===');
      content.push(JSON.stringify(theDebugInfo.other_info, null, '\t'));

      // Put it together to put into the textbox
      debugInfo = content.join('\n');

      if (SAFARI)
      {
        showDebugInfo();
      } else
      {
        chrome.permissions.request({
          permissions: ['management'],
        }, function (granted)
        {
          // The callback argument will be true if the user granted the permissions.
          if (granted)
          {
            chrome.management.getAll(function (result)
            {
              var extInfo = [];
              extInfo.push('==== Extension and App Information ====');
              for (var i = 0; i < result.length; i++)
              {
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
              }, function (removed)
              {
              });
            });
          } else
          {
            debugInfo =  debugInfo + '\n\n==== User Denied Extension and App Permissions ====';
            showDebugInfo();
          }
        });
      }
    });
  });

  // Show the changelog
  $('#whatsnew a').click(function ()
  {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('CHANGELOG.txt'), false);
    xhr.send();
    var object = xhr.responseText;
    $('#changes').text(object).css({ width: '670px', height: '200px' }).fadeIn();
  });
});
