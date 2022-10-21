

/* For ESLint: List any global identifiers used in this file below */
/* global browser, browser, getSettings, translate, determineUserLanguage */

const BG = browser.extension.getBackgroundPage();
let debugInfo;
let textDebugInfo = '';
let extInfo = '';

const bugReportLogic = function () {
  const stepsPlaceholder = '1.\n2.\n3.';
  const validatorKey = 'validators';
  const errorClassName = 'input-error';

  const validators = {
    empty: value => value.trim().length > 0,
    email: value => value.search(/^.+@.+\..+$/) !== -1,
    steps: value => value.trim() !== stepsPlaceholder,
  };

  const $name = $('#name').data(validatorKey, [validators.empty]);
  const $email = $('#email').data(validatorKey, [validators.empty, validators.email]);
  const $title = $('#summary').data(validatorKey, [validators.empty]);
  const $repro = $('#repro-steps').data(validatorKey, [validators.empty, validators.steps]).val(stepsPlaceholder);
  const $expect = $('#expected-result').data(validatorKey, [validators.empty]);
  const $actual = $('#actual-result').data(validatorKey, [validators.empty]);

  const continueProcessing = function () {
    $('#debug-info').val(textDebugInfo);
    $('#step2-back').prop('disabled', false);
    $('#step_final_questions').fadeIn();

    // Auto-scroll to bottom of the page
    $('html, body').animate({
      scrollTop: 15000,
    }, 50);
    if ($('#rememberDetails').is(':checked')) {
      browser.storage.local.set({
        userName: $name.val(),
      });
      browser.storage.local.set({
        userEmail: $email.val(),
      });
    }
  };

  // Retrieve extension info
  const askUserToGatherExtensionInfo = function () {
    if (
      browser
      && browser.runtime.getManifest().optional_permissions
      && browser.runtime.getManifest().optional_permissions.includes('management')
      && browser.permissions
      && browser.permissions.request
    ) {
      browser.permissions.request({
        permissions: ['management'],
      }).then((granted) => {
        // The callback argument will be true if
        // the user granted the permissions.
        if (granted) {
          // since the management.getAll function is not available when the page is loaded
          // the function is not wrapped by the polyfil Promise wrapper
          // so we create, and load a temporary iFrame after the permission is granted
          // so the polyfil will correctly wrap the now available API
          const iframe = document.createElement('iframe');
          iframe.onload = () => {
            const proxy = iframe.contentWindow.browser;
            proxy.management.getAll().then((result) => {
              const tempExtInfo = [];
              for (let i = 0; i < result.length; i++) {
                tempExtInfo.push(`Number ${i + 1}`);
                tempExtInfo.push(`  name: ${result[i].name}`);
                tempExtInfo.push(`  id: ${result[i].id}`);
                tempExtInfo.push(`  version: ${result[i].version}`);
                tempExtInfo.push(`  enabled: ${result[i].enabled}`);
                tempExtInfo.push(`  type: ${result[i].type}`);
                tempExtInfo.push('');
              }
              extInfo = `\nExtensions:\n${tempExtInfo.join('\n')}`;
              browser.permissions.remove({ permissions: ['management'] });
              document.body.removeChild(iframe);
              continueProcessing();
            });
          };
          iframe.src = browser.runtime.getURL('proxy.html');
          iframe.style.visibility = 'hidden';
          document.body.appendChild(iframe);
        } else {
          // user didn't grant us permission
          extInfo = 'Permission not granted';
          continueProcessing();
        }
      }); // end of permission request
    } else {
      // not supported in this browser
      extInfo = 'no extension information';
      continueProcessing();
    }
  };

  // Get debug info
  BG.getDebugInfo((theDebugInfo) => {
    debugInfo = {};
    debugInfo.filterLists = JSON.stringify(theDebugInfo.subscriptions, null, '\t');
    debugInfo.otherInfo = JSON.stringify(theDebugInfo.otherInfo, null, '\t');
    debugInfo.customFilters = theDebugInfo.customFilters;
    debugInfo.settings = JSON.stringify(theDebugInfo.settings, null, '\t');
    debugInfo.language = determineUserLanguage();

    const content = [];
    if (theDebugInfo.subscriptions) {
      content.push('=== Filter Lists ===');
      for (const sub in theDebugInfo.subscriptions) {
        content.push(`Id: ${sub}`);
        content.push(`  Download Count: ${theDebugInfo.subscriptions[sub].downloadCount}`);
        content.push(`  Download Status: ${theDebugInfo.subscriptions[sub].downloadStatus}`);
        content.push(`  Last Download: ${theDebugInfo.subscriptions[sub].lastDownload}`);
        content.push(`  Last Success: ${theDebugInfo.subscriptions[sub].lastSuccess}`);
      }
    }

    content.push('');

    // Custom & Excluded filters might not always be in the object
    if (theDebugInfo.customFilters) {
      content.push('=== Custom Filters ===');
      for (const filter in theDebugInfo.customFilters) {
        content.push(theDebugInfo.customFilters[filter]);
      }

      content.push('');
    }

    if (theDebugInfo.exclude_filters) {
      content.push('=== Exclude Filters ===');
      content.push(JSON.stringify(theDebugInfo.exclude_filters));
    }

    content.push('=== Settings ===');
    for (const setting in theDebugInfo.settings) {
      content.push(`${setting} : ${theDebugInfo.settings[setting]}`);
    }

    content.push('');
    content.push('=== Other Info ===');
    content.push(JSON.stringify(theDebugInfo.otherInfo, null, '\t'));

    // Put it together to put into the textbox
    textDebugInfo = content.join('\n');
  });

  // Cache access to input boxes
  browser.storage.local.get('userName').then((response) => {
    $name.val(response.userName);
  });

  browser.storage.local.get('userEmail').then((response) => {
    $email.val(response.userEmail);
  });

  const handleResponseError = function () {
    $('#manual_report_DIV').show();
    $('#step_response_error').fadeIn();
    $('html, body').animate({
      scrollTop: $('#step_response_error').offset().top,
    }, 2000);
  };

  // Preparation for manual report in case of error.
  const prepareManualReport = function (data, statusText) {
    const body = [];
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
    if (statusText) {
      body.push(`statusText: ${statusText}`);
    }
    $('#manual_submission').val(body.join('\n'));
  };

  const sendReport = async function () {
    const reportData = {
      title: $title.val(),
      repro: $repro.val(),
      expect: $expect.val(),
      actual: $actual.val(),
      debug: debugInfo,
      name: $name.val(),
      email: $email.val(),
    };

    if (extInfo) {
      reportData.debug.extensions = extInfo;
    }
    const formData = new FormData();
    formData.append('bug_report', JSON.stringify(reportData));
    try {
      const response = await fetch('https://getadblock.com/freshdesk/bugReportV2.php', {
        method: 'POST',
        cache: 'no-cache',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.prototype.hasOwnProperty.call(data, 'id')) {
          $('#step_response_success').fadeIn();
          $('html, body').animate({
            scrollTop: $('#step_response_success').offset().top,
          }, 2000);
        } else {
          prepareManualReport(reportData, response.statusText);
          handleResponseError();
        }
      }
    } catch {
      prepareManualReport(reportData);
      handleResponseError();
    }
  };

  // Step 1: Name & Email
  $('#step1-next').on('click', () => {
    // Check for errors
    let isFormValid = true;

    for (const $field of [$name, $email, $title, $repro, $expect, $actual]) {
      const value = $field.val();
      const fieldValidators = $field.data(validatorKey);
      const isFieldValid = fieldValidators.every(validator => validator(value));
      $field.toggleClass(errorClassName, !isFieldValid);
      isFormValid = isFormValid && isFieldValid;
    }

    if (isFormValid) {
      // Success - go to next step
      $(this).prop('disabled', true);
      $('#email, #name, #rememberDetails').prop('disabled', true);
      $('#summary, #repro-steps, #expected-result, #actual-result').prop('disabled', true);
      $('.missingInfoMessage').hide();
      askUserToGatherExtensionInfo();
    } else {
      // Failure - let them know there's an issue
      $('#step_name_email > .missingInfoMessage').show();
    }
  });

  $('#step2-back').on('click', () => {
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

  $('#submit').on('click', () => {
    $('#submit').prop('disabled', true);
    $('#step2-back').prop('disabled', true);
    sendReport();
  });
};

$(() => {
  let optionsTheme = 'default_theme';
  if (BG && BG.getSettings()) {
    const settings = BG.getSettings();
    optionsTheme = settings.color_themes.options_page;
  }
  $('body').attr('id', optionsTheme).data('theme', optionsTheme);
  $('#sidebar-adblock-logo').attr('src', `icons/${optionsTheme}/logo.svg`);
  bugReportLogic();
});
