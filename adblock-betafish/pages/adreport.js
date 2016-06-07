
var backgroundPage = ext.backgroundPage.getWindow();
var require = backgroundPage.require;
var Prefs = require('prefs').Prefs;
var subscriptionClasses = require('subscriptionClasses');
var Subscription = subscriptionClasses.Subscription;
var FilterStorage = require('filterStorage').FilterStorage;
var FilterNotifier = require('filterNotifier').FilterNotifier;

var options = parseUri.parseSearch(document.location.search);
var tabId = options.tabId.replace(/[^0-9]/g, '');
var extensionsDisabled = [];
var subscriptionsNodes = [];
var contact = '';
var updateFiltersClicked = false;

var recordMessage = function(msg) {
  if (!msg) {
    return;
  }
  backgroundPage.recordAdreportMessage(msg);
}

$(function () {
  localizePage();
  recordMessage("open");
  $( window ).unload(function() {
    if (!updateFiltersClicked) {
      recordMessage("update_filters_not_clicked");
    }
  });

  // Get the list of all unsubscribed default filters
  var unsubscribedDefaultFilters = [];
  var subs = backgroundPage.getAllSubscriptionsMinusText();
  for (var id in subs) {
    if (!subs[id].subscribed && !subs[id].user_submitted) {
      unsubscribedDefaultFilters[id] = subs[id];
    }
  }

  var getSubscriptionXMLFile = function (xmlFile)
    {
    backgroundPage.fetch(xmlFile)
      .then(function(response)
      {
        return response.text();
      }).then(function(text)
        {
          var doc = new DOMParser().parseFromString(text, 'application/xml');
          var nodes = doc.getElementsByTagName('subscription');
          for (var i = 0; i < nodes.length; i++)
          {
            var node = nodes[i];
            if (node)
            {
              subscriptionsNodes.push(node);
            }
          }
        });
  };

  // Pre-load the subscription information
  // to determine the contact information quickly based on the language of the
  // page
  getSubscriptionXMLFile('subscriptions.xml');
  getSubscriptionXMLFile('adblock-subscriptions.xml');
  var determineContactHomePage = function (contactPrefex)
  {
    if (subscriptionsNodes.length === 0)
      {
      return '';
    }

    for (var i = 0; i < subscriptionsNodes.length; i++)
    {
      var node = subscriptionsNodes[i];
      if (node)
      {
        var prefixes = node.getAttribute('prefixes');
        var homepage = node.getAttribute('homepage');
        if (prefixes !== null &&
            homepage !== null)
        {
          var prefixArray = prefixes.split(',');
          if (prefixArray.indexOf(contactPrefex) >= 0)
          {
            return homepage;
          }
        }
      }
    }
  };

  // Shows the instructions for how to enable all extensions according to the
  // browser of the user
  if (SAFARI)
  {
    $('.chrome_only')
        .hide();
  } else
  {
    $('.safari_only')
        .hide();
    $("li[i18n='disableforchromestepone']").find('a')
            .click(function ()
             {
              if (OPERA)
                {
                chrome.tabs.create({
                  url: 'opera://extensions/',
                });
              }              else
                {
                  chrome.tabs.create({
                    url: 'chrome://extensions/',
                  });
                }
            });
  }

  // Sort the languages list
  var $languageOptions = $('#step_language_lang option');
  $languageOptions.sort(function (a, b) {
    if (!a.text) return -1;
    if (!b.text) return 1; // First one is empty
    if (!a.value) return 1;
    if (!b.value) return -1; // 'Other' at the end
    if (a.getAttribute('i18n') == 'lang_english') return -1; // English
    // second
    if (b.getAttribute('i18n') == 'lang_english') return 1;
    return (a.text > b.text) ? 1 : -1;
  });

  $('#step_language_lang')
      .empty()
      .append($languageOptions);
  $languageOptions[0].selected = true;

  // add the link to the anchor in "adreport2"
  $('a', '#info').attr('href', 'http://help.getadblock.com/support/solutions/articles/6000061202').attr('target', '_blank');

  $('#step_update_filters_DIV').show();

  // Add the click handlers...
  // Updating the users filters
  $('#UpdateFilters')
        .click(function () {
          $(this).prop('disabled', true);
          recordMessage("update_filters_click");
          updateFiltersClicked = true;
          backgroundPage.updateFilterLists();
          $('.afterFilterUpdate input').prop('disabled', false);
          $('.afterFilterUpdate').removeClass('afterFilterUpdate');
        });

  // if the user clicks a radio button
  $('#step_update_filters_no')
        .click(function () {
          recordMessage("update_filters_no");
          $('#step_update_filters')
              .html("<span class='answer' chosen='no'>" + translate('no') + '</span>');
          $('#checkupdate')
              .text(translate('adalreadyblocked'));
        });

  $('#step_update_filters_yes')
        .click(function () {
          recordMessage("update_filters_yes");
          $('#step_update_filters')
              .html("<span class='answer' chosen='yes'>" + translate('yes') + '</span>');

          // If the user is subscribed to Acceptable Ads, ask them to
          // unsubscribe, and recheck the page
          var subs = backgroundPage.getAllSubscriptionsMinusText();

          // if the user is subscribed to Acceptable-Ads, ask them to disable
          // it
          if (subs && subs.acceptable_ads && subs.acceptable_ads.subscribed) {
            $('#step_update_aa_DIV')
                .show();
            $('.odd')
                .css('background-color', '#f8f8f8');
          } else {
            $('#step_disable_extensions_DIV')
                .fadeIn()
                .css('display', 'block');
            $('.even')
                .css('background-color', '#f8f8f8');
          }

          $('#malwarewarning')
                  .html(translate('malwarenotfound'));
        });

  // STEP 3: disable AA - IF enabled...
  $('#DisableAA')
        .click(function () {
          $(this).prop('disabled', true);
          recordMessage("disable_aa_click");
          setTimeout(function ()
          {
            var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
            FilterStorage.removeSubscription(subscription);

            // display the Yes/No buttons
            $('.afterDisableAA input')
                .prop('disabled', false);
            $('.afterDisableAA')
                .removeClass('afterDisableAA');
          }, 1);
        });

  // if the user clicks a radio button
  $('#step_update_aa_no')
        .click(function () {
          recordMessage("disable_aa_no");
          $('#step_update_aa')
              .html("<span class='answer' chosen='no'>" + translate('no') + '</span>');
          $('#checkupdate')
              .text(translate('aamessageadreport'));
          $('#checkupdatelink')
              .text(translate('aalinkadreport'));
          $('#checkupdatelink_DIV')
              .fadeIn()
              .css('display', 'block');

        });

  $('#step_update_aa_yes')
        .click(function () {
          recordMessage("disable_aa_yes");
          $('#step_update_aa')
              .html("<span class='answer' chosen='yes'>" + translate('yes') + '</span>');
          $('#step_disable_extensions_DIV')
              .fadeIn()
              .css('display', 'block');
        });

  // STEP 4: disable all extensions

  // Code for displaying the div is in the $function() that contains
  // localizePage()
  // after user disables all extensions except for AdBlock
  // if the user clicks a radio button
  $('#step_disable_extensions_no')
        .click(function () {
          recordMessage("disable_extensions");
          $('#step_disable_extensions')
              .html("<span class='answer' chosen='no'>" + translate('no') + '</span>');
          $('#checkupdate')
              .text(translate('reenableadsonebyone'));
        });

  $('#step_disable_extensions_yes')
        .click(function () {
          $('#step_disable_extensions')
              .html("<span class='answer' chosen='yes'>" + translate('yes') + '</span>');
          $('#step_language_DIV')
              .fadeIn()
              .css('display', 'block');
          if (extensionsDisabled.length > 0) {
            chrome.permissions.request({
              permissions: ['management'],
            }, function (granted) {
              // The callback argument will be true if the user granted
              // the permissions.
              if (granted) {
                for (var i = 0; i < extensionsDisabled.length; i++) {
                  chrome.management.setEnabled(extensionsDisabled[i], true);
                }

                alert(translate('enableotherextensionscomplete'));
              } else {
                alert(translate('manuallyenableotherextensions'));
              }
            });
          }
        });

  // Automatically disable / enable other extensions
  $('#OtherExtensions')
        .click(function () {
          $('#OtherExtensions')
              .prop('disabled', true);
          if (!SAFARI) {
            chrome.permissions.request({
              permissions: ['management'],
            }, function (granted) {
              // The callback argument will be true if the user granted
              // the permissions.
              if (granted) {
                // remove the Yes/No buttons, so users don't click them
                // to soon.
                $('#step_disable_extensions')
                    .fadeOut()
                    .css('display', 'none');
                chrome.management.getAll(function (result) {
                  for (var i = 0; i < result.length; i++) {
                    if (result[i].enabled &&
                        result[i].mayDisable &&
                        result[i].id !== 'gighmmpiobklfepjocnamgkkbiglidom' &&
                        result[i].id !== 'aobdicepooefnbaeokijohmhjlleamfj' &&
                        result[i].id !== 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
                      // if the extension is a developer version,
                      // continue, don't disable.
                      if (result[i].installType === 'development' &&
                          result[i].type === 'extension' &&
                          result[i].name === 'AdBlock') {
                        continue;
                      }

                      chrome.management.setEnabled(result[i].id, false);
                      extensionsDisabled.push(result[i].id);
                    }
                  }

                  chrome.permissions.remove({
                    permissions: ['management'],
                  }, function (removed) {});

                  var alertDisplayed = false;
                  alert(translate('disableotherextensionscomplete'));
                  chrome.runtime.onMessage.addListener(
                                function (request, sender, sendResponse) {
                                  if (!alertDisplayed && request.command === 'reloadcomplete') {
                                    alertDisplayed = true;
                                    alert(translate('tabreloadcomplete'));

                                    // we're done, redisplay the Yes/No
                                    // buttons
                                    $('#step_disable_extensions')
                                        .fadeIn()
                                        .css('display', 'block');
                                    sendResponse({});
                                  }
                                }
                            );
                  backgroundPage.reloadTab(parseInt(tabId));
                }); // end of chrome.management.getAll()
              } else {
                $('#OtherExtensions')
                    .prop('disabled', false);
              }
            }); // end of chrome.permissions.request()
          }
        });

  // STEP 5: language

  // if the user clicks an item
  $('#step_language_lang')
        .change(function () {
          var $selected = $('#step_language_lang option:selected');
          $('#step_language')
              .html("<span class='answer'>" + $selected.text() + '</span>');
          $('#step_language span')
              .attr('chosen', $selected.attr('i18n'));
          if ($selected.text() == translate('other'))
          {
            $('#checkupdate')
                .html(translate('nodefaultfilter1'));
            $('#link')
                .html(translate('here'))
                .attr('href', 'https://adblockplus.org/en/subscriptions');
            recordMessage("language");
            return;
          }
          else
          {
            var requiredLists = $selected.attr('value')
                .split(';');
            for (var i = 0; i < requiredLists.length - 1; i++)
            {
              if (unsubscribedDefaultFilters[requiredLists[i]])
              {
                $('#checkupdate')
                    .text(translate('retryaftersubscribe', [translate('filter' + requiredLists[i])]));
                recordMessage("language");
                return;
              }
            }
          }

          var contactPrefex = requiredLists[requiredLists.length - 1];
          contact = determineContactHomePage(contactPrefex);

          $('#step_firefox_DIV')
              .fadeIn()
              .css('display', 'block');
          $('#checkinfirefox1')
              .html(translate('checkinfirefox_1'));
          $('#checkinfirefox2')
              .html(translate('checkinfirefox_2'));
          $('#checkinfirefox')
              .html(translate('checkinfirefoxtitle'));
          if (SAFARI) {
            $('#chrome1, #chrome2')
                .html(translate('orchrome'));
            $('#adblockforchrome')
                .html(translate('oradblockforchrome'));
          }
        });

  // STEP 6: also in Firefox

  // If the user clicks a radio button
  $('#step_firefox_yes')
        .click(function () {
          recordMessage("filterlistproblem");
          $('#step_firefox')
              .html("<span class='answer' chosen='yes'>" + translate('yes') + '</span>');
          if (/^mailto\:/.test(contact))
              contact = contact.replace(' at ', '@');
          var reportLink = "<a href='" + contact + "'>" + contact.replace(/^mailto\:/, '') + '</a>';
          $('#checkupdate')
              .html(translate('reportfilterlistproblem', [reportLink]));
          $('#privacy')
              .show();
        });

  $('#step_firefox_no')
        .click(function () {
          $('#step_firefox')
              .html("<span class='answer' chosen='no'>" + translate('no') + '</span>');
          if (SAFARI) {
            // Safari can't block video ads
            $('#step_flash_DIV')
                .fadeIn()
                .css('display', 'block');
          } else {
            recordMessage("adblockissue");
            $('#step_report_DIV')
                .fadeIn()
                .css('display', 'block');
            if (debugInfo) {
              $('#debug-info')
                        .val(createReadableReport({
                          debug: debugInfo,
                        }));
            }
          }
        });

  $('#step_firefox_wontcheck')
        .click(function () {
          recordMessage("firefox_wontcheck");
          if (!SAFARI) {
            // Chrome blocking is good enough to assume the answer is 'yes'
            $('#step_firefox_yes')
                .click();
          } else {
            // Safari can't do this.
            $('#checkupdate')
                .text(translate('fixityourself'));
          }

          $('#step_firefox')
              .html("<span class='answer' chosen='wont_check'>" + translate('refusetocheck') + '</span>');
        });

  // STEP 7: video/flash ad (Safari-only)

  // If the user clicks a radio button
  $('#step_flash_yes')
        .click(function () {
          recordMessage("flash_yes");
          $('#step_flash')
              .html("<span class='answer' chosen='yes'>" + translate('yes') + '</span>');
          $('#checkupdate')
              .text(translate('cantblockflash'));
        });

  $('#step_flash_no')
        .click(function () {
          recordMessage("flash_no");
          $('#step_flash')
              .html("<span class='answer' chosen='no'>" + translate('no') + '</span>');
          $('#step_report_DIV')
              .fadeIn()
              .css('display', 'block');
          if (debugInfo) {
            $('#debug-info')
                    .val(createReadableReport({
                      debug: debugInfo,
                    }));
          }
        });

  // STEP 7: Ad Report
  $('#step_report_submit')
        .click(function () {
          recordMessage("sendReport");
          sendReport();
        });
});

// Get debug info
backgroundPage.getDebugInfo(function (info) {
  debugInfo                = {};
  debugInfo.filter_lists   = JSON.stringify(info.subscriptions, null, '\t');
  debugInfo.other_info     = JSON.stringify(info.other_info, null, '\t');
  debugInfo.custom_filters = JSON.stringify(info.custom_filters, null, '\t');
  debugInfo.settings       = JSON.stringify(info.settings, null, '\t');
  debugInfo.language       = determineUserLanguage();
});

function sendReport() {
  // Cache access to input boxes
  var $name = $('#step_report_name');
  var $email = $('#step_report_email');
  var $location = $('#step_report_location');
  var $filter = $('#step_report_filter');
  var problems = 0;

  // Reset any error messages
  $('#screen_capture_file_label')
      .css('color', 'black');
  $email.removeClass('inputError');
  $name.removeClass('inputError');
  $('#step_response_error')
      .parent()
      .fadeOut();
  $('#step_response_success')
      .parent()
      .fadeOut();
  $('#adreport_missing_info')
      .hide();
  $('#adreport_missing_screenshot')
      .hide();

  // Validate user entered info
  if ($name.val() === '') {
    problems++;
    $name.addClass('inputError');
    $('#adreport_missing_info')
        .show();
  }

  if ($email.val() === '' ||
      $email.val()
      .search(/^.+@.+\..+$/) === -1) {
    problems++;
    $email.addClass('inputError');
    $('#adreport_missing_info')
        .show();
  }

  if ($('#screen_capture_file')[0].files.length === 0) {
    $('#adreport_missing_screenshot')
        .show();
    problems++;
    $('#screen_capture_file_label')
        .css('color', '#f00');
  }

  if (problems) {
    $('html, body')
            .animate({
              scrollTop: $('#adreport_missing_info')
                  .offset()
                  .top,
            }, 2000);
    return;
  }

  var reportData = {
    title: 'Ad Report',
    name: $name.val(),
    email: $email.val(),
    location: $location.val(),
    filter: $filter.val(),
    debug: debugInfo,
    url: '',
  };

  var domain = '';
  if (options.url)
  {
    domain = parseUri(options.url)
        .hostname;
    reportData.title = reportData.title + ': ' + domain;
    reportData.url = options.url;
  }

  var theAnswers = [];
  var $answers = $('span[class="answer"]');
  var $text = $('div[class="section"]:visible');
  var minArrayLength = Math.min($answers.length, $text.length);
  for (var i = 0; i < minArrayLength; i++)
  {
    theAnswers.push((i + 1) + '.' + $text[i].id + ': ' + $answers[i].getAttribute('chosen'));
  }

  reportData.answers = theAnswers.join('\n');

  // Retrieve extension info
  var askUserToGatherExtensionInfo = function () {
    if (chrome &&
        chrome.permissions &&
        chrome.permissions.request) {
      chrome.permissions.request({
        permissions: ['management'],
      }, function (granted) {
        // The callback argument will be true if the user granted the
        // permissions.
        if (granted) {
          chrome.management.getAll(function (result) {
            var extInfo = [];
            for (var i = 0; i < result.length; i++) {
              extInfo.push('Number ' + (i + 1));
              extInfo.push('  name: ' + result[i].name);
              extInfo.push('  id: ' + result[i].id);
              extInfo.push('  version: ' + result[i].version);
              extInfo.push('  enabled: ' + result[i].enabled);
              extInfo.push('  type: ' + result[i].type);
              extInfo.push('');
            }

            reportData.extensions = extInfo.join('\n');
            chrome.permissions.remove({
              permissions: ['management'],
            }, function (removed) {});

            sendData();
            return;
          });
        } else {
          // user didn't grant us permission
          reportData.extensions = 'Permission not granted';
          sendData();
          return;
        }
      });
    } else {
      // user didn't grant us permission
      reportData.extensions = 'Extension information not avaiable';
      sendData();
    }
  }; // end of askUserToGatherExtensionInfo

  var sendData = function ()
  {
    var formdata = new FormData();
    formdata.append('ad_report', JSON.stringify(reportData));

    if ($('#screen_capture_file')[0].files.length > 0)
    {
      formdata.append('screencapturefile', $('#screen_capture_file')[0].files[0]);
    }

    $('#debug-info')
        .val(createReadableReport(reportData));
    $.ajax({
      url: 'https://getadblock.com/freshdesk/adReport.php',
      data: formdata,
      contentType: false,
      processData: false,
      success: function (text)
      {
        $('#step_report_submit')
            .prop('disabled', true);

        // if a ticket was created, the response should contain a ticket
        // id #
        if (text)
        {
          try
          {
            var respObj = JSON.parse(text);
            if (respObj &&
                respObj.hasOwnProperty('helpdesk_ticket') &&
                respObj.helpdesk_ticket.hasOwnProperty('display_id'))
            {
              $('#step_response_success')
                  .parent()
                  .fadeIn();
              $('html, body').animate({
                                  scrollTop: $('#step_response_success')
                                      .offset()
                                      .top,
                                }, 2000);
            } else
            {
              prepareManualReport(reportData, null, null, respObj);
              handleResponseError(respObj);
            }
          }
          catch (e)
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

  if (chrome &&
      chrome.tabs &&
      chrome.tabs.detectLanguage)
  {
    var tabIdInt = -1;
    try
    {
      tabIdInt = parseInt(tabId);
    }
    catch (e)
    {
      reportData.language = 'unknown';
      askUserToGatherExtensionInfo();
      return;
    }

    chrome.tabs.detectLanguage(tabIdInt, function (language)
    {
      if (language)
      {
        reportData.language = language;
      }

      askUserToGatherExtensionInfo();
    }); // end of detectLanguage
  } else
  {
    reportData.language = 'unknown';
    askUserToGatherExtensionInfo();
  }

  // Handle any HTTP or server errors
  var handleResponseError = function (respObj)
  {
    $('#step_response_error')
        .parent()
        .fadeIn();
    if (respObj &&
        respObj.hasOwnProperty('error_msg')) {
      $('#step_response_error_msg')
          .text(translate(respObj.error_msg));
    }

    // re-enable the button(s) if the error is recoverable (the user can
    // re-submit)
    if (respObj &&
        respObj.hasOwnProperty('retry_allowed') &&
        respObj.retry_allowed === 'true') {
      $('#step_report_submit')
          .prop('disabled', false);
      $('#step_response_error_manual_submission')
          .hide();
    } else {
      $('#step_response_error_manual_submission a')
          .attr('href', 'https://adblocksupport.freshdesk.com/support/tickets/new');
      $('#step_response_error_manual_submission a')
          .attr('target', '_blank');
      $('#step_response_error_manual_submission')
          .show();
    }

    $('html, body')
            .animate({
              scrollTop: $('#step_response_error')
                  .offset()
                  .top,
            }, 2000);
  };
} // end of sendReport()

var createReadableReport = function (data) {
  var body = [];
  if (data.location) {
    body.push('* Location of ad *');
    body.push(data.location);
  }

  if (data.expect) {
    body.push('');
    body.push('* Working Filter? *');
    body.push(data.expect);
  }

  body.push('');

  // Get written debug info
  // data.debug is the debug info object
  content = [];
  content.push('* Debug Info *');
  content.push('');
  if (data.debug &&
      data.debug.filter_lists) {
    content.push('=== Filter Lists ===');
    content.push(data.debug.filter_lists);
  }

  content.push('');

  // Custom & Excluded filters might not always be in the object
  if (data.custom_filters) {
    content.push('=== Custom Filters ===');
    content.push(data.debug.custom_filters);
    content.push('');
  }

  if (data.exclude_filters) {
    content.push('=== Exclude Filters ===');
    content.push(data.debug.exclude_filters);
    content.push('');
  }

  if (data.debug &&
      data.debug.settings) {
    content.push('=== Settings ===');
    content.push(data.debug.settings);
  }

  content.push('');
  if (data.debug &&
      data.debug.other_info) {
    content.push('=== Other Info ===');
    content.push(data.debug.other_info);
  }

  body.push(content.join('\n'));
  body.push('');
  return body.join('\n');
};

// Pretty Print the data
var prepareManualReport = function (data, status, HTTPerror, respObj) {
  var body = [];
  body.push(createReadableReport(data));
  if (status) {
    body.push('Status: ' + status);
  }

  if (HTTPerror) {
    body.push('HTTP error code: ' + HTTPerror);
  }

  if (respObj) {
    body.push('Server error information: ' + JSON.stringify(respObj));
  }

  $('#manual_submission')
      .val(body.join('\n'));
};

// Auto-scroll to bottom of the page
$('input, select')
    .change(function (event) {
      event.preventDefault();
      $('html, body')
            .animate({
              scrollTop: 15000,
            }, 50);
    });

