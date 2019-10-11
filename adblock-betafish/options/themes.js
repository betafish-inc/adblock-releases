'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global backgroundPage, translate, License, MABPayment, settingsNotifier, localizePage */

(function onThemesLoaded() {
  const updateThemeSettings = ($newTheme) => {
    const key = $newTheme.data('key');
    const newTheme = $newTheme.data('theme');
    // get local copy of the Color Themes object
    const colorThemes = JSON.parse(JSON.stringify(backgroundPage.getSettings().color_themes));

    colorThemes[key] = newTheme;
    backgroundPage.setSetting('color_themes', colorThemes);
    window.location.reload();
  };


  const showNameTheme = ($themeBox) => {
    if ($themeBox.parent().hasClass('locked')) {
      $themeBox.find('.theme-name-lock').show();
    }
    const $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate($themeNameDiv.attr('i18n')));
  };

  const updateSelection = (changeEvent) => {
    if (!changeEvent || $.isEmptyObject(changeEvent)) {
      return;
    }
    const $selectedTheme = $(changeEvent.target).closest('.theme-box');
    if ($selectedTheme.closest('.theme-wrapper').hasClass('locked')) {
      return;
    }
    const sectionID = $selectedTheme.closest('section').attr('id');
    const $otherThemes = $(`#${sectionID} .theme-box`).not($selectedTheme);

    $otherThemes.removeClass('selected');
    $selectedTheme.addClass('selected');

    // Restore theme name string if cursor happens
    // to still be hovering on top of the Apply Theme button
    showNameTheme($selectedTheme);
    updateThemeSettings($selectedTheme);
  };

  // Create node for the overlay fullpage overview
  // Inputs:
  //     - clickEvent: Event
  // Outputs:
  //     - JQuery object: created overlay preview node
  const createPreviewNode = (clickEvent) => {
    const theme = $(clickEvent.target).closest('.theme-box').data('theme');
    const component = $(clickEvent.target).closest('.theme-box').data('key');
    const htmlTagID = 'options-page-html';
    const { scrollHeight } = document.getElementById(htmlTagID);
    const $overlayContent = $('<div>');
    const $imgPreview = $('<img>');
    const $closeIcon = $('<i>');
    const $overlay = $('<div>');
    $closeIcon
      .addClass('material-icons')
      .addClass('circle-icon-bg-24')
      .addClass('close-preview-icon')
      .text('cancel')
      .attr('role', 'img')
      .attr('i18n-aria-label', 'close');

    $imgPreview
      .addClass(theme)
      .addClass(component)
      .addClass('preview')
      .attr('alt', translate('a_theme_preview', translate(theme), translate(component)));

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
  };

  const showPreviewOfClickedTheme = (clickEvent) => {
    // Check that a preview overlay isn't already being shown
    if ($('.dark-overlay-preview').length > 0) {
      return;
    }

    const $darkOverlayPreview = createPreviewNode(clickEvent);
    localizePage();
    $darkOverlayPreview.show();

    // Remove poupup menu preview if clicked anywhere but preview image
    $darkOverlayPreview.click((event) => {
      const clickedPreviewImg = $(event.target).hasClass('preview');
      if (clickedPreviewImg) {
        return;
      }
      $darkOverlayPreview.remove();
    });
  };

  const showApplyTheme = ($themeBox) => {
    if ($themeBox.hasClass('selected')) {
      return;
    }

    const $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate('apply_theme'));
  };

  const showSupportToUnlock = ($themeBox) => {
    $themeBox.find('.theme-name-lock').hide();
    const $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate('support_to_unlock'));
  };

  const selectCurrentThemes = (currentThemes) => {
    const popupMenuTheme = backgroundPage.isValidTheme(currentThemes.popup_menu) ? currentThemes.popup_menu : 'default_theme';
    const optionsPageTheme = backgroundPage.isValidTheme(currentThemes.options_page) ? currentThemes.options_page : 'default_theme';

    // reset selected theme
    $('#popup-menu-themes .selected').removeClass('selected');
    $('#options-page-themes .selected').removeClass('selected');

    // Get theme nodes to select
    const $popupTheme = $(`#popup-menu-themes [data-theme=${popupMenuTheme}]`);
    const $optionsTheme = $(`#options-page-themes [data-theme=${optionsPageTheme}]`);
    const $popupInput = $popupTheme.find('input[name=popup-menu-theme]');
    const $optionsInput = $optionsTheme.find('input[name=options-page-theme]');

    // Select theme nodes
    $popupTheme.addClass('selected');
    $optionsTheme.addClass('selected');
    $popupInput.prop('checked', true);
    $optionsInput.prop('checked', true);
  };

  const documentEventsHandling = () => {
    // Hover events
    $('.theme-wrapper:not(.locked) .theme-box:not(.selected)').hover(
      function handleIn() {
        showApplyTheme($(this));
      },
      function handleOut() {
        showNameTheme($(this));
      },
    );

    $('.theme-wrapper.locked .theme-box').hover(
      function handleIn() {
        showSupportToUnlock($(this));
      },
      function handleOut() {
        showNameTheme($(this));
      },
    );

    // Click events
    $('.theme-box-top').click(event => showPreviewOfClickedTheme(event));

    // Change events
    $('input.invisible-radio-button').change(event => updateSelection(event));
  };

  $(document).ready(() => {
    let colorThemes = {};
    if (backgroundPage && backgroundPage.getSettings()) {
      colorThemes = backgroundPage.getSettings().color_themes;
    }
    $('.theme-hover-overlay .search[role=img]').each(function i18nSupport() {
      const $preview = $(this);
      const theme = $preview.closest('.theme-box').data('theme');
      const component = $preview.closest('.theme-box').data('key');
      $preview.attr('aria-label', translate('preview_a_theme', translate(theme), translate(component)));
    });
    selectCurrentThemes(colorThemes);

    if (!License || $.isEmptyObject(License) || !MABPayment) {
      return;
    }

    const payInfo = MABPayment.initialize('themes');
    if (License.shouldShowMyAdBlockEnrollment()) {
      MABPayment.freeUserLogic(payInfo);
    } else if (License.isActiveLicense()) {
      MABPayment.paidUserLogic(payInfo);
    }

    documentEventsHandling();
  });

  const onSettingsChanged = function (name, currentValue) {
    if (name === 'color_themes') {
      selectCurrentThemes(currentValue);
    }
  };

  settingsNotifier.on('settings.changed', onSettingsChanged);

  window.addEventListener('unload', () => {
    settingsNotifier.off('settings.changed', onSettingsChanged);
  });
}());
