
export default {
  basename: 'adblock',
  version: '4.46.1',
  webpack: {
    bundles: [
      {
        dest: 'abp-background.js',
        src: [
          'adblockplusui/adblockpluschrome/lib/devtools.js',
          'adblockplusui/adblockpluschrome/lib/debug.js',
          'adblock-betafish/alias/requestBlocker.js',
          'adblockplusui/adblockpluschrome/lib/popupBlocker.js',
          'adblockplusui/adblockpluschrome/lib/stats.js',
          'adblockplusui/adblockpluschrome/lib/csp.js',
          'adblock-betafish/alias/contentFiltering.js',
          'adblockplusui/adblockpluschrome/lib/messageResponder.js',
          'adblockplusui/adblockpluschrome/lib/filterConfiguration.js',
          'adblock-betafish/jquery/jquery-3.5.1.min.js',
          'adblock-betafish/errorreporting.js',
          'adblock-betafish/functions.js',
          'adblock-betafish/survey.js',
          'adblock-betafish/settings.js',
          'adblock-betafish/alias/parseFilter.js',
          'adblock-betafish/background.js',
          'adblock-betafish/contextmenus.js',
          'adblock-betafish/alias/subscriptionInit.js',
          'adblock-betafish/alias/icon.js',
          'adblock-betafish/excludefilter.js',
          'adblock-betafish/picreplacement/image-sizes-map.js',
          'adblock-betafish/picreplacement/channels.js',
          'adblock-betafish/picreplacement/cat-channel.js',
          'adblock-betafish/picreplacement/dog-channel.js',
          'adblock-betafish/picreplacement/landscape-channel.js',
          'adblock-betafish/picreplacement/custom-channel.js',
          'adblock-betafish/picreplacement/birds-channel.js',
          'adblock-betafish/picreplacement/food-channel.js',
          'adblock-betafish/picreplacement/goat-channel.js',
          'adblock-betafish/picreplacement/ocean-channel.js',
          'adblock-betafish/picreplacement/unknown-channel.js',
          'adblock-betafish/picreplacement/check.js',
          'adblock-betafish/picreplacement/sync-service.js',
          'adblock-betafish/picreplacement/distraction-control-bg.js',
          'adblock-betafish/getselectors.js',
          'adblock-betafish/data_migration.js',
          'adblock-betafish/twitchSettings.js',
          'adblock-betafish/youtube/yt-bg.js',
          // marked as optional using wildcard
          'vendor/abp-snippets/dist/ml/bundle*.ml.mjs',
        ],
      },
      {
        dest: 'include.preload.js',
        src: [
          'adblock-betafish/alias/include.preload.js',
          'adblockplusui/adblockpluschrome/inject.preload.js',
          'adblock-betafish/picreplacement/contentscript-loader.js',
        ],
      },
      {
        dest: 'subscriptionLink.postload.js',
        src: [
          'adblockplusui/adblockpluschrome/subscriptionLink.postload.js',
        ],
      },
    ],
  },
  mapping: {
    copy: [
      {
        dest: '_locales',
        src: [
          '_locales/**/*.json',
        ],
      },
      {
        dest: 'icons',
        src: [
          'icons/*.png',
          'icons/*.gif',
          'icons/*.svg',
          'icons/*.woff2',
        ],
      },
      {
        dest: 'icons/dark_theme/',
        src: 'icons/themes/dark/*.svg',
      },
      {
        dest: 'icons/default_theme/',
        src: 'icons/themes/default/*.svg',
      },
      {
        dest: 'icons/solarized_theme/',
        src: 'icons/themes/solarized/*.svg',
      },
      {
        dest: 'icons/solarized_light_theme/',
        src: 'icons/themes/solarized_light/*.svg',
      },
      {
        dest: 'icons/ocean_theme/',
        src: 'icons/themes/ocean/*.svg',
      },
      {
        dest: 'icons/rebecca_purple_theme/',
        src: 'icons/themes/rebecca_purple/*.svg',
      },
      {
        dest: 'icons/sunshine_theme/',
        src: 'icons/themes/sunshine/*.svg',
      },
      {
        dest: 'icons/watermelon_theme/',
        src: 'icons/themes/watermelon/*.svg',
      },
      {
        dest: 'fonts/',
        src: 'adblock-betafish/fonts/*.woff',
      },
      {
        dest: 'fonts/',
        src: 'adblock-betafish/fonts/font-face.css',
      },
      {
        dest: 'data/',
        src: '/data/*.json',
      },
      {
        dest: "data/hideIfGraphMatches",
        src: [
          // marked as optional using wildcard
          "vendor/abp-snippets/dist/ml/hideIfGraphMatches/*"
        ]
      },
      {
        dest: 'ext',
        src: [
          'adblockplusui/adblockpluschrome/ext/**',
        ],
      },
      {
        dest: '',
        src: [
          'adblockplusui/adblockpluschrome/polyfill.js',
          'adblock-betafish/lib/purify.min.js',
          'adblock-betafish/CHANGELOG.txt',
          'adblock-betafish/LICENSE',
          'adblock-betafish/translators.json',
          'adblock-betafish/jquery/jquery-3.5.1.min.js',
          'adblock-betafish/pubnub/pubnub.min.js',
          'adblock-betafish/lib/*',
          'adblock-betafish/adblock.css',
          'adblockplusui/adblockpluschrome/devtools.html',
          'adblockplusui/devtools-panel.js',
          'adblockplusui/i18n.js',
          'adblockplusui/proxy.html',
          // marked as optional using wildcard
          'vendor/abp-snippets/dist/webext/snippets*.json',
        ],
      },
    ],
    rename: [
      {
        dest: 'adblock-errorreporting.js',
        src: 'adblock-betafish/errorreporting.js',
      },
      {
        dest: 'adblock-functions.js',
        src: 'adblock-betafish/functions.js',
      },
      {
        dest: 'adblock-bandaids.js',
        src: 'adblock-betafish/bandaids.js',
      },
      {
        dest: 'adblock-datacollection-contentscript.js',
        src: 'adblock-betafish/datacollection-contentscript.js',
      },
      {
        dest: 'adblock-yt-cs.js',
        src: 'adblock-betafish/youtube/yt-cs.js',
      },
      {
        dest: 'adblock-yt-manage-cs.js',
        src: 'adblock-betafish/youtube/yt-manage-cs.js',
      },
      {
        dest: 'adblock-yt-manage.css',
        src: 'adblock-betafish/youtube/yt-manage.css',
      },
      {
        dest: 'adblock-ads-allowed-icon.svg',
        src: 'adblock-betafish/youtube/ads-allowed-icon.svg',
      },
      {
        dest: 'adblock-ads-blocked-icon.svg',
        src: 'adblock-betafish/youtube/ads-blocked-icon.svg',
      },
      {
        dest: 'adblock-twitch-contentscript.js',
        src: 'adblock-betafish/twitch-contentscript.js',
      },
      {
        dest: 'adblock-onpage-icon-cs.js',
        src: 'adblock-betafish/onpageIcon/onpage-icon-cs.js',
      },
      {
        dest: 'adblock-onpage-icon.css',
        src: 'adblock-betafish/onpageIcon/onpage-icon.css',
      },
      {
        dest: 'adblock-onpage-icon-user.css',
        src: 'adblock-betafish/onpageIcon/onpage-icon-user.css',
      },
      {
        dest: 'adblock-onpage-icon.svg',
        src: 'adblock-betafish/onpageIcon/icon.svg',
      },
      {
        dest: 'adblock-options-tabs.css',
        src: 'adblock-betafish/options/tabs.css',
      },
      {
        dest: 'adblock-options-tabs.js',
        src: 'adblock-betafish/options/tabs.js',
      },
      {
        dest: 'options.html',
        src: 'adblock-betafish/options/index.html',
      },
      {
        dest: 'adblock-options-index.js',
        src: 'adblock-betafish/options/index.js',
      },
      {
        dest: 'adblock-options-options.css',
        src: 'adblock-betafish/options/options.css',
      },
      {
        dest: 'adblock-options-general.js',
        src: 'adblock-betafish/options/general.js',
      },
      {
        dest: 'adblock-options-general.html',
        src: 'adblock-betafish/options/general.html',
      },
      {
        dest: 'adblock-options-distractioncontrol.js',
        src: 'adblock-betafish/options/distractioncontrol.js',
      },
      {
        dest: 'adblock-options-distractioncontrol.html',
        src: 'adblock-betafish/options/distractioncontrol.html',
      },
      {
        dest: 'adblock-options-filters.js',
        src: 'adblock-betafish/options/filters.js',
      },
      {
        dest: 'adblock-options-filters.html',
        src: 'adblock-betafish/options/filters.html',
      },
      {
        dest: 'adblock-options-customize.js',
        src: 'adblock-betafish/options/customize.js',
      },
      {
        dest: 'adblock-options-customize.html',
        src: 'adblock-betafish/options/customize.html',
      },
      {
        dest: 'adblock-options-support.js',
        src: 'adblock-betafish/options/support.js',
      },
      {
        dest: 'adblock-options-support.html',
        src: 'adblock-betafish/options/support.html',
      },
      {
        dest: 'adblock-options-themes.js',
        src: 'adblock-betafish/options/themes.js',
      },
      {
        dest: 'adblock-options-stats-tabs.html',
        src: 'adblock-betafish/options/stats-tabs.html',
      },
      {
        dest: 'adblock-options-stats-tabs.js',
        src: 'adblock-betafish/options/stats-tabs.js',
      },
      {
        dest: 'adblock-options-stats-tabs.css',
        src: 'adblock-betafish/options/stats-tabs.css',
      },
      {
        dest: 'adblock-options-bug-report.js',
        src: 'adblock-betafish/options/bug-report.js',
      },
      {
        dest: 'adblock-options-bug-report.html',
        src: 'adblock-betafish/options/bug-report.html',
      },
      {
        dest: 'adblock-button-popup.html',
        src: 'adblock-betafish/button/popup.html',
      },
      {
        dest: 'adblock-button-popup.js',
        src: 'adblock-betafish/button/popup.js',
      },
      {
        dest: 'adblock-button-popup.css',
        src: 'adblock-betafish/button/popup.css',
      },
      {
        dest: 'adblock-button-help-segue.html',
        src: 'adblock-betafish/button/help-segue.html',
      },
      {
        dest: 'adblock-button-help-section.html',
        src: 'adblock-betafish/button/help-section.html',
      },
      {
        dest: 'adblock-button-help-button.html',
        src: 'adblock-betafish/button/help-button.html',
      },
      {
        dest: 'adblock-button-help.js',
        src: 'adblock-betafish/button/help.js',
      },
      {
        dest: 'adblock-button-help.css',
        src: 'adblock-betafish/button/help.css',
      },
      {
        dest: 'adblock-button-help-map.json',
        src: 'adblock-betafish/button/help-map.json',
      },
      {
        dest: 'adblock-button-help-action.js',
        src: 'adblock-betafish/button/help-action.js',
      },
      {
        dest: 'adblock-uiscripts-adblock-wizard.css',
        src: 'adblock-betafish/uiscripts/adblock-wizard.css',
      },
      {
        dest: 'adblock-uiscripts-load_wizard_resources.js',
        src: 'adblock-betafish/uiscripts/load_wizard_resources.js',
      },
      {
        dest: 'adblock-uiscripts-top_open_blacklist_ui.js',
        src: 'adblock-betafish/uiscripts/top_open_blacklist_ui.js',
      },
      {
        dest: 'adblock-uiscripts-top_open_whitelist_ui.js',
        src: 'adblock-betafish/uiscripts/top_open_whitelist_ui.js',
      },
      {
        dest: 'adblock-uiscripts-top_open_whitelist_completion_ui.js',
        src: 'adblock-betafish/uiscripts/top_open_whitelist_completion_ui.js',
      },
      {
        dest: 'adblock-uiscripts-send_content_to_back.js',
        src: 'adblock-betafish/uiscripts/send_content_to_back.js',
      },
      {
        dest: 'adblock-uiscripts-blacklisting-overlay.js',
        src: 'adblock-betafish/uiscripts/blacklisting/overlay.js',
      },
      {
        dest: 'adblock-uiscripts-rightclick_hook.js',
        src: 'adblock-betafish/uiscripts/blacklisting/rightclick_hook.js',
      },
      {
        dest: 'adblock-uiscripts-blacklisting-clickwatcher.js',
        src: 'adblock-betafish/uiscripts/blacklisting/clickwatcher.js',
      },
      {
        dest: 'adblock-uiscripts-blacklisting-elementchain.js',
        src: 'adblock-betafish/uiscripts/blacklisting/elementchain.js',
      },
      {
        dest: 'adblock-uiscripts-blacklisting-blacklistui.js',
        src: 'adblock-betafish/uiscripts/blacklisting/blacklistui.js',
      },
      {
        dest: 'adblock-picreplacement.js',
        src: 'adblock-betafish/picreplacement/picreplacement.js',
      },
      {
        dest: 'adblock-picreplacement-image-sizes-map.js',
        src: 'adblock-betafish/picreplacement/image-sizes-map.js',
      },
      {
        dest: 'adblock-picreplacement-push-notification-wrapper-cs.js',
        src: 'adblock-betafish/picreplacement/push-notification-wrapper-cs.js',
      },
      {
        dest: 'adblock-options-mab.html',
        src: 'adblock-betafish/options/mab.html',
      },
      {
        dest: 'adblock-options-mab.css',
        src: 'adblock-betafish/options/mab.css',
      },
      {
        dest: 'adblock-options-mab.js',
        src: 'adblock-betafish/options/mab.js',
      },
      {
        dest: 'adblock-options-mab-image-swap.html',
        src: 'adblock-betafish/options/image-swap.html',
      },
      {
        dest: 'adblock-options-mab-image-swap.js',
        src: 'adblock-betafish/options/image-swap.js',
      },
      {
        dest: 'adblock-options-mab-themes.html',
        src: 'adblock-betafish/options/themes-mab.html',
      },
      {
        dest: 'adblock-options-mab-themes.js',
        src: 'adblock-betafish/options/themes.js',
      },
      {
        dest: 'adblock-options-premium-payment.js',
        src: 'adblock-betafish/options/premium-payment.js',
      },
      {
        dest: 'adblock-color-themes.css',
        src: 'adblock-betafish/options/color_themes.css',
      },
      {
        dest: 'adblock-picreplacement-imageview.html',
        src: 'adblock-betafish/picreplacement/options/imageview.html',
      },
      {
        dest: 'adblock-picreplacement-imageview.js',
        src: 'adblock-betafish/picreplacement/options/imageview.js',
      },
      {
        dest: 'adblock-picreplacement-options-imageview.css',
        src: 'adblock-betafish/picreplacement/options/imageview.css',
      },
      {
        dest: 'adblock-options-sync.html',
        src: 'adblock-betafish/options/sync.html',
      },
      {
        dest: 'adblock-options-sync.js',
        src: 'adblock-betafish/options/sync.js',
      },
      {
        dest: 'devtools-panel.html',
        src: 'adblock-betafish/alias/devtools-panel.html',
      },
      {
        dest: 'devtools.js',
        src: 'adblock-betafish/alias/devtools.js',
      },
      {
        dest: 'skin/devtools-panel.css',
        src: 'adblockplusui/skin/devtools-panel.css',
      },
      {
        dest: 'adblock-snippets.json',
        src: 'dist/adblock-snippets.json',
      },
      {
        dest: 'icons/ab-16.png',
        src: 'icons/adblock-16.png',
      },
      {
        dest: 'icons/ab-16-whitelisted.png',
        src: 'icons/adblock-16-whitelisted.png',
      },
      {
        dest: 'icons/ab-19.png',
        src: 'icons/adblock-19.png',
      },
      {
        dest: 'icons/ab-19-whitelisted.png',
        src: 'icons/adblock-19-whitelisted.png',
      },
      {
        dest: 'icons/ab-20.png',
        src: 'icons/adblock-20.png',
      },
      {
        dest: 'icons/ab-20-whitelisted.png',
        src: 'icons/adblock-20-whitelisted.png',
      },
      {
        dest: 'icons/ab-32.png',
        src: 'icons/adblock-32.png',
      },
      {
        dest: 'icons/ab-32-whitelisted.png',
        src: 'icons/adblock-32-whitelisted.png',
      },
      {
        dest: 'icons/ab-38.png',
        src: 'icons/adblock-38.png',
      },
      {
        dest: 'icons/ab-38-whitelisted.png',
        src: 'icons/adblock-38-whitelisted.png',
      },
      {
        dest: 'icons/ab-40.png',
        src: 'icons/adblock-40.png',
      },
      {
        dest: 'icons/ab-40-whitelisted.png',
        src: 'icons/adblock-40-whitelisted.png',
      },
      {
        dest: 'icons/ab-48.png',
        src: 'icons/adblock-48.png',
      },
      {
        dest: 'icons/ab-64.png',
        src: 'icons/adblock-64.png',
      },
      {
        dest: 'icons/ab-128.png',
        src: 'icons/adblock-128.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-cat.png',
        src: 'adblock-betafish/picreplacement/images/cat.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-cat-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/cat_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-dog.png',
        src: 'adblock-betafish/picreplacement/images/dog.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-dog-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/dog_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-landscape.png',
        src: 'adblock-betafish/picreplacement/images/landscape.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-landscape-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/landscape_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-goat.png',
        src: 'adblock-betafish/picreplacement/images/goat.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-goat-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/goat_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-ocean.png',
        src: 'adblock-betafish/picreplacement/images/ocean.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-ocean-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/ocean_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-food.png',
        src: 'adblock-betafish/picreplacement/images/food.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-food-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/food_grayscale.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-bird.png',
        src: 'adblock-betafish/picreplacement/images/bird.png',
      },
      {
        dest: 'icons/adblock-picreplacement-images-bird-grayscale.png',
        src: 'adblock-betafish/picreplacement/images/bird_grayscale.png',
      },
      {
        dest: 'adblock-wizard_sync_cta.svg',
        src: 'adblock-betafish/uiscripts/wizard_sync_cta.svg',
      },
      {
        dest: 'managed-storage-schema.json',
        src: 'adblock-betafish/alias/managed-storage-schema.json',
      },
    ],
  },
  translations: {
    dest: '',
    src: [],
  },
};
