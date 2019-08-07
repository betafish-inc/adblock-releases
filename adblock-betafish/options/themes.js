'use strict';

(function(){
  const updateThemeSettings = ($newTheme) => {
    let key = $newTheme.data('key');
    let newTheme = $newTheme.data('theme');
    // get local copy of the Color Themes object
    let colorThemes = JSON.parse(JSON.stringify(backgroundPage.getSettings().color_themes));

    colorThemes[key] = newTheme;
    backgroundPage.setSetting('color_themes', colorThemes);
    window.location.reload();
  }

  const updateSelection = (changeEvent) => {
    if (!changeEvent || $.isEmptyObject(changeEvent)) {
      return;
    }
    let $selectedTheme = $(changeEvent.target).closest('.theme-box');
    if ($selectedTheme.closest('.theme-wrapper').hasClass('locked')) {
      return;
    }
    let sectionID = $selectedTheme.closest('section').attr('id');
    let $otherThemes = $(`#${ sectionID } .theme-box`).not($selectedTheme);

    $otherThemes.removeClass('selected');
    $selectedTheme.addClass('selected');

    // Restore theme name string if cursor happens
    // to still be hovering on top of the Apply Theme button
    showNameTheme($selectedTheme);
    updateThemeSettings($selectedTheme);
  }

  // Create node for the overlay fullpage overview
  // Inputs:
  //     - clickEvent: Event
  // Outputs:
  //     - JQuery object: created overlay preview node
  const createPreviewNode = (clickEvent) => {
    let theme = $(clickEvent.target).closest('.theme-box').data('theme');
    let component = $(clickEvent.target).closest('.theme-box').data('key');
    let htmlTagID = 'options-page-html';
    let scrollHeight = document.getElementById(htmlTagID).scrollHeight;
    let $overlayContent = $('<div></div>');
    let $imgPreview = $('<img/>');
    let $closeIcon = $('<i></i>');
    let $overlay = $('<div></div>');
    $closeIcon
        .addClass('material-icons')
        .addClass('circle-icon-bg-24')
        .addClass('close-preview-icon')
        .text('cancel');

    $imgPreview
        .addClass(theme)
        .addClass(component)
        .addClass('preview');

    $overlayContent
        .addClass('fixed-box')
        .append($closeIcon)
        .append($imgPreview);

    $overlay
        .height(scrollHeight)
        .addClass('dark-overlay-preview')
        .append($overlayContent);

    $('html').prepend($overlay);

    return $overlay;
  }

  const showPreviewOfClickedTheme = (clickEvent) => {
    // Check that a preview overlay isn't already being shown
    if ($('.dark-overlay-preview').length > 0) {
      return;
    }

    let $darkOverlayPreview = createPreviewNode(clickEvent);
    $darkOverlayPreview.show();

    // Remove poupup menu preview if clicked anywhere but preview image
    $darkOverlayPreview.click((event) => {
      let clickedPreviewImg = $(event.target).hasClass('preview');
      if (clickedPreviewImg)
        return;
      $darkOverlayPreview.remove();
    });
  }

  const showApplyTheme = ($themeBox) => {
    if ($themeBox.hasClass('selected'))
      return;

    let $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate('apply_theme'));
  }

  const showNameTheme = ($themeBox) => {
    if ($themeBox.parent().hasClass('locked')) {
      $themeBox.find('.theme-name-lock').show();
    }
    let $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate($themeNameDiv.attr('i18n')));
  }

  const showSupportToUnlock = ($themeBox) => {
    $themeBox.find('.theme-name-lock').hide();
    let $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate('support_to_unlock'));
  }

  const selectCurrentThemes = (currentThemes) => {
    let popupMenuTheme = backgroundPage.isValidTheme(currentThemes.popup_menu) ? currentThemes.popup_menu : 'default_theme';
    let optionsPageTheme = backgroundPage.isValidTheme(currentThemes.options_page) ? currentThemes.options_page : 'default_theme';

    // reset selected theme
    $('#popup-menu-themes .selected').removeClass("selected");
    $('#options-page-themes .selected').removeClass("selected");

    // Get theme nodes to select
    let $popupTheme = $(`#popup-menu-themes [data-theme=${ popupMenuTheme }]`);
    let $optionsTheme = $(`#options-page-themes [data-theme=${ optionsPageTheme }]`);
    let $popupInput = $popupTheme.find('input[name=popup-menu-theme]');
    let $optionsInput = $optionsTheme.find('input[name=options-page-theme]');

    // Select theme nodes
    $popupTheme.addClass('selected');
    $optionsTheme.addClass('selected');
    $popupInput.prop('checked', true);
    $optionsInput.prop('checked', true);
  }

  const documentEventsHandling = () => {
    // Hover events
    $('.theme-wrapper:not(.locked) .theme-box:not(.selected)').hover(
      function() { showApplyTheme($(this)) },
      function() { showNameTheme($(this)) }
    );

    $('.theme-wrapper.locked .theme-box').hover(
      function() { showSupportToUnlock($(this)) },
      function() { showNameTheme($(this)) }
    );

    // Click events
    $('.theme-box-top').click((event) => showPreviewOfClickedTheme(event));

    // Change events
    $('input.invisible-radio-button').change((event) => updateSelection(event));
  }

  $(document).ready(function() {
    let colorThemes = {};
    if (backgroundPage && backgroundPage.getSettings()) {
      colorThemes = backgroundPage.getSettings().color_themes;
    }

    selectCurrentThemes(colorThemes);

    if (!License || $.isEmptyObject(License) || !MABPayment) {
      return;
    }

    const iframeData = MABPayment.initialize("themes");
    if (License.shouldShowMyAdBlockEnrollment()) {
      $('.theme-wrapper.locked .theme-box').click((event) => {
        MABPayment.freeUserLogic(iframeData);
      });
    } else if (License.isActiveLicense()) {
      MABPayment.paidUserLogic(iframeData);
    }

    documentEventsHandling();
  });

  var onSettingsChanged = function(name, currentValue, previousValue) {
    if (name === 'color_themes') {
      selectCurrentThemes(currentValue);
    }
  };

  settingsNotifier.on("settings.changed", onSettingsChanged);

  window.addEventListener("unload", function() {
    settingsNotifier.off("settings.changed", onSettingsChanged);
  });
})();
