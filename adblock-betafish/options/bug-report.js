var debugInfo;
var textDebugInfo  = '';
var extInfo        = '';
var backgroundPage = chrome.extension.getBackgroundPage();
$(document).ready(function ()
{
  'use strict';

  // Retrieve extension info
  var askUserToGatherExtensionInfo = function ()
  {
    if (chrome &&
      chrome.permissions &&
      chrome.permissions.request)
    {
      chrome.permissions.request({
        permissions: ['management'],
      }, function (granted)
      {
        // The callback argument will be true if
        // the user granted the permissions.
        if (granted)
        {
          chrome.management.getAll(function (result)
          {
            var tempExtInfo = [];
            for (var i = 0; i < result.length; i++)
            {
              tempExtInfo.push('Number ' + (i + 1));
              tempExtInfo.push('  name: ' + result[i].name);
              tempExtInfo.push('  id: ' + result[i].id);
              tempExtInfo.push('  version: ' + result[i].version);
              tempExtInfo.push('  enabled: ' + result[i].enabled);
              tempExtInfo.push('  type: ' + result[i].type);
              tempExtInfo.push('');
            }

            extInfo = '\nExtensions:\n' + tempExtInfo.join('\n');
            chrome.permissions.remove({
              permissions: ['management'],
            }, function (removed)
            {
            });

            continueProcessing();
          });
        } else
        {
          //user didn't grant us permission
          extInfo = 'Permission not granted';
          continueProcessing();
        }
      }); //end of permission request
    } else
    {
      //not supported in this browser
      extInfo = 'no extension information';
      continueProcessing();
    }
  };

  // Get debug info
  backgroundPage.getDebugInfo(function (theDebugInfo)
  {
    debugInfo                = {};
    debugInfo.filter_lists   = JSON.stringify(theDebugInfo.subscriptions, null, '\t');
    debugInfo.other_info     = JSON.stringify(theDebugInfo.other_info, null, '\t');
    debugInfo.custom_filters = theDebugInfo.custom_filters;
    debugInfo.settings       = JSON.stringify(theDebugInfo.settings, null, '\t');
    debugInfo.language       = determineUserLanguage();

    var content = [];
    if (theDebugInfo.subscriptions)
    {
      content.push('=== Filter Lists ===');
      for (var sub in theDebugInfo.subscriptions)
      {
        content.push('Id: ' + sub);
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
    textDebugInfo = content.join('\n');
  });

  // Cache access to input boxes
  var $name     = $('#name');
  var $email    = $('#email');
  var $title    = $('#summary');
  var $repro    = $('#repro-steps');
  var $expect   = $('#expected-result');
  var $actual   = $('#actual-result');
  var $comments = $('#other-comments');
  chrome.storage.local.get('user_name', function (response)
  {
    $name.val(response.user_name);
  });

  chrome.storage.local.get('user_email', function (response)
  {
    $email.val(response.user_email);
  });

  var handleResponseError = function (respObj)
  {
    if (respObj &&
      respObj.hasOwnProperty('error_msg'))
    {
      $('#step_response_error_msg').text(translate(respObj.error_msg));
    }

    $('#manual_report_DIV').show();
    $('#step_response_error').fadeIn();
    $('html, body').animate({
      scrollTop: $('#step_response_error').offset().top,
    }, 2000);
  };

  var sendReport = function ()
  {
    var reportData = {
      title: $title.val(),
      repro: $repro.val(),
      expect: $expect.val(),
      actual: $actual.val(),
      debug: debugInfo,
      name: $name.val(),
      email: $email.val(),
      comments: $comments.val(),
    };

    if (extInfo)
    {
      reportData.debug.extensions = extInfo;
    }

    $.ajax({
      url: 'https://getadblock.com/freshdesk/bugReportV2.php',
      data: {
        bug_report: JSON.stringify(reportData),
      },
      success: function (text)
      {
        // if a ticket was created, the response should contain a ticket id #
        if (text)
        {
          try
          {
            var respObj = JSON.parse(text);
            if (respObj && respObj.hasOwnProperty('id'))
            {
              $('#step_response_success').fadeIn();
              $('html, body').animate({
                scrollTop: $('#step_response_success').offset().top,
              }, 2000);
            } else
            {
              prepareManualReport(reportData, null, null, respObj);
              handleResponseError(respObj);
            }
          } catch (e)
          {
            prepareManualReport(reportData);
            handleResponseError();
          }
        } else
        {
          prepareManualReport(reportData);
          handleResponseError();
        }
      },

      error: function (xhrInfo, status, HTTPerror)
      {
        prepareManualReport(reportData, status, HTTPerror);
        handleResponseError();
      },

      type: 'POST',
    });
  };

  // Preparation for manual report in case of error.
  var prepareManualReport = function (data, status, HTTPerror, respObj)
  {
    var body = [];
    body.push('This bug report failed to send.');
    body.push('');
    body.push('* Repro Steps *');
    body.push(data.repro);
    body.push('');
    body.push('* Expected Result *');
    body.push(data.expect);
    body.push('');
    body.push('* Actual Result *');
    body.push(data.actual);
    body.push('');
    body.push('* Other comments *');
    body.push(data.comments);
    body.push('');
    body.push('');
    body.push('');
    body.push('===== Debug Info =====');
    body.push(textDebugInfo);
    if (status)
    {
      body.push('Status: ' + status);
    }

    if (HTTPerror)
    {
      body.push('HTTP error code: ' + HTTPerror);
    }

    if (respObj)
    {
      body.push('Server error information: ' + JSON.stringify(respObj));
    }

    $('#manual_submission').val(body.join('\n'));
  };

  var continueProcessing = function ()
  {
    $('#debug-info').val(textDebugInfo);
    $('#step2-back').prop('disabled', false);
    $('#step_final_questions').fadeIn();

    // Auto-scroll to bottom of the page
    $('html, body').animate({
      scrollTop: 15000,
    }, 50);
    if ($('#rememberDetails').is(':checked'))
    {
      chrome.storage.local.set({
        user_name: $name.val(),
      });
      chrome.storage.local.set({
        user_email: $email.val(),
      });
    }
  };

  // Step 1: Name & Email
  $('#step1-next').click(function ()
  {
    // Check for errors
    var problems = 0;
    if ($name.val() === '')
    {
      problems++;
      $name.addClass('inputError');
    } else
    {
      $name.removeClass('inputError');
    }

    if ($email.val() === '' ||
      $email.val().search(/^.+@.+\..+$/) === -1)
    {
      problems++;
      $email.addClass('inputError');
    } else
    {
      $email.removeClass('inputError');
    }

    if ($title.val() === '')
    {
      problems++;
      $title.addClass('inputError');
    } else
    {
      $title.removeClass('inputError');
    }

    if ($repro.val() === '1. \n2. \n3. ')
    {
      problems++;
      $repro.addClass('inputError');
    } else
    {
      $repro.removeClass('inputError');
    }

    if ($expect.val() === '')
    {
      problems++;
      $expect.addClass('inputError');
    } else
    {
      $expect.removeClass('inputError');
    }

    if ($actual.val() === '')
    {
      problems++;
      $actual.addClass('inputError');
    } else
    {
      $actual.removeClass('inputError');
    }

    if (problems === 0)
    {
      // Success - go to next step
      $(this).prop('disabled', true);
      $('#email, #name, #rememberDetails').prop('disabled', true);
      $('#summary, #repro-steps, #expected-result, #actual-result').prop('disabled', true);
      $('.missingInfoMessage').hide();
      askUserToGatherExtensionInfo();
    } else
    {
      // Failure - let them know there's an issue
      $('#step_name_email > .missingInfoMessage').show();
    }
  });

  $('#step2-back').click(function ()
  {
    $('#email, #name, #rememberDetails').prop('disabled', false);
    $('#summary, #repro-steps, #expected-result, #actual-result').prop('disabled', false);
    $('#step_repro_info').fadeOut();
    $('#step_final_questions').fadeOut();
    $('html, body').animate({
      scrollTop: $('#step_name_email').parent().parent().offset().top,
    }, 2000);
    $('#step2-back').prop('disabled', true);
    $('#step1-next').prop('disabled', false);
  });

  $('#submit').click(function ()
  {
    sendReport();
    $('#submit').prop('disabled', true);
    $('#step2-back').prop('disabled', true);
  });
});
