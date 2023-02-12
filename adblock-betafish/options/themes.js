/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global  translate, License, MABPayment, settingsNotifier, localizePage, settings,
   browser, isValidTheme, initializeProxies, send
 */

(function onThemesLoaded() {
  const updateThemeSettings = ($newTheme) => {
    const key = $newTheme.data('key');
    const newTheme = $newTheme.data('theme');
    // get local copy of the Color Themes object
    const colorThemes = JSON.parse(JSON.stringify(settings.color_themes));

    colorThemes[key] = newTheme;
    settings.color_themes = colorThemes;
    window.location.reload();
  };

  const updateSelection = (changeEvent) => {
    if (!changeEvent || $.isEmptyObject(changeEvent)) {
      return;
    }
    const $selectedTheme = $(changeEvent.target).closest('.theme-box');
    if ($selectedTheme.closest('.theme-wrapper').hasClass('locked')) {
      send('openTab', { urlToOpen: License.MAB_CONFIG.payURL });
      return;
    }
    const $otherThemes = $selectedTheme.closest('section').find('.theme-box').not($selectedTheme);

    $otherThemes.removeClass('selected');
    $selectedTheme.addClass('selected');

    updateThemeSettings($selectedTheme);
  };

  const selectCurrentThemes = async (currentThemes) => {
    const popupMenuTheme = await isValidTheme(currentThemes.popup_menu) ? currentThemes.popup_menu : 'default_theme';
    const optionsPageTheme = await isValidTheme(currentThemes.options_page) ? currentThemes.options_page : 'default_theme';

    // reset selected theme
    $('.popup-menu-themes .selected').removeClass('selected');
    $('.options-page-themes .selected').removeClass('selected');

    // Get theme nodes to select
    const $popupTheme = $(`.popup-menu-themes [data-theme=${popupMenuTheme}]`);
    const $optionsTheme = $(`.options-page-themes [data-theme=${optionsPageTheme}]`);
    const $popupInput = $popupTheme.find('input[name=popup-menu-theme]');
    const $optionsInput = $optionsTheme.find('input[name=options-page-theme]');

    // Select theme nodes
    $popupTheme.addClass('selected');
    $optionsTheme.addClass('selected');
    $popupInput.prop('checked', true);
    $optionsInput.prop('checked', true);

    $('.options-page-theme-preview').attr('src', `icons/${optionsPageTheme}/optionscard.svg`);
    $('.options-page-theme-preview').attr('alt', translate('a_theme_preview', translate(`${optionsPageTheme}`), translate('options_page')));
  };

  const showHoveredPopupThemePreview = ($themeBox) => {
    const hoveredTheme = $themeBox.data('theme');

    $('.popup-menu-theme-title').text(translate(`${hoveredTheme}`));
    $('.popup-menu-theme-preview').attr('src', `icons/${hoveredTheme}/previewcard.svg`);
    $('.popup-menu-theme-preview').attr('alt', translate('a_theme_preview', translate(`${hoveredTheme}`), translate('popup_menu')));
  };

  const showSelectedPopupThemePreview = () => {
    const popupMenuTheme = $('.popup-menu-themes .selected').data('theme');

    $('.popup-menu-theme-title').text(translate(`${popupMenuTheme}`));
    $('.popup-menu-theme-preview').attr('src', `icons/${popupMenuTheme}/previewcard.svg`);
    $('.popup-menu-theme-preview').attr('alt', translate('a_theme_preview', translate(`${popupMenuTheme}`), translate('popup_menu')));
  };

  const showHoveredOptionsThemePreview = ($themeBox) => {
    const hoveredTheme = $themeBox.data('theme');

    $('.options-page-theme-title').text(translate(`${hoveredTheme}`));
    $('.options-page-theme-preview').attr('src', `icons/${hoveredTheme}/optionscard.svg`);
    $('.options-page-theme-preview').attr('alt', translate('a_theme_preview', translate(`${hoveredTheme}`), translate('options_page')));
  };

  const showSelectedOptionsThemePreview = () => {
    const optionsPageTheme = $('.options-page-themes .selected').data('theme');

    $('.options-page-theme-title').text(translate(`${optionsPageTheme}`));
    $('.options-page-theme-preview').attr('src', `icons/${optionsPageTheme}/optionscard.svg`);
    $('.options-page-theme-preview').attr('alt', translate('a_theme_preview', translate(`${optionsPageTheme}`), translate('options_page')));
  };

  const showShadowOnLockedHover = ($themeBox) => {
    if ($themeBox.parent().hasClass('locked')) {
      $('#get-it-now-themes').addClass('shadow');
    }
  };

  const hideShadowNoHover = () => {
    $('#get-it-now-themes').removeClass('shadow');
  };

  const documentEventsHandling = () => {
    // Hover events
    $('.popup-menu-themes .theme-box:not(.selected)')
      .on('mouseenter', function handleIn() {
        showHoveredPopupThemePreview($(this));
        showShadowOnLockedHover($(this));
      })
      // eslint-disable-next-line prefer-arrow-callback
      .on('mouseleave', function handleOut() {
        showSelectedPopupThemePreview();
        hideShadowNoHover();
      });

    $('.options-page-themes .theme-box:not(.selected)')
      .on('mouseenter', function handleIn() {
        showHoveredOptionsThemePreview($(this));
        showShadowOnLockedHover($(this));
      })
      // eslint-disable-next-line prefer-arrow-callback
      .on('mouseleave', function handleOut() {
        showSelectedOptionsThemePreview();
        hideShadowNoHover();
      });

    // Change events
    $('input.invisible-radio-button').on('change', event => updateSelection(event));
  };

  $(async () => {
    await initializeProxies();
    let colorThemes = {};
    if (settings) {
      colorThemes = settings.color_themes;
    }
    $('.theme-wrapper:not(.locked) .overlay-icon').each(function i18nSupport() {
      const $preview = $(this);
      const theme = $preview.closest('.theme-box').data('theme');
      const component = $preview.closest('.theme-box').data('key');
      $preview.attr('aria-label', translate('preview_a_theme', [
        translate(`${theme}`),
        translate(`${component}`),
      ]));
    });
    await selectCurrentThemes(colorThemes);
    showSelectedOptionsThemePreview();
    showSelectedPopupThemePreview();
    if (!License || $.isEmptyObject(License) || !MABPayment) {
      return;
    }

    const payInfo = MABPayment.initialize('themes');
    if (License.shouldShowMyAdBlockEnrollment()) {
      MABPayment.freeUserLogic(payInfo);
      $('#get-it-now-themes').on('click', MABPayment.userClickedPremiumCTA);
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
}());
