'use strict';

(function(){
  const updateThemeSettings = ($newTheme) => {
    let key = $newTheme.data('key');
    let newTheme = $newTheme.data('theme');
    let themeSettings = backgroundPage.getSettings().color_themes;

    themeSettings[key] = newTheme;
    backgroundPage.setSetting('color_themes', themeSettings, reloadAllOpenedTabs);
  }

  const updateSelection = (changeEvent) => {
    if (!changeEvent || $.isEmptyObject(changeEvent)) {
      return;
    }
    let $selectedTheme = $(changeEvent.target).closest('.theme-box');
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
    let $themeNameDiv = $themeBox.find('.theme-name');
    $themeNameDiv.text(translate($themeNameDiv.attr('i18n')));
  }

  const validateTheme = (themeName) => {
    return validThemes.includes(themeName) ? themeName : 'default_theme';
  }

  const selectCurrentThemes = (currentThemes) => {
    let popupMenuTheme = validateTheme(currentThemes.popup_menu);
    let optionsPageTheme = validateTheme(currentThemes.options_page);

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
    $('.theme-box:not(.selected)').hover(
      function() { showApplyTheme($(this)) },
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
    documentEventsHandling();
  });
})();
