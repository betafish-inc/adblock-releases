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


export default {
  basename: 'adblock',
  version: '5.4.1',
  webpack: {
    bundles: [
      {
        dest: "polyfill.js",
        src: [
          "vendor/adblockplusui/adblockpluschrome/lib/polyfill.js"
        ]
      },
      {
        dest: 'abp-background.js',
        src: [
          'adblock-betafish/prefs/settings.js',
          'vendor/adblockplusui/adblockpluschrome/lib/devtools.js',
          'vendor/adblockplusui/adblockpluschrome/lib/debug.js',
          'adblock-betafish/alias/subscriptionInit.js',
          'adblock-betafish/alias/contentFiltering.js',
          'vendor/adblockplusui/adblockpluschrome/lib/messageResponder.js',
          'vendor/adblockplusui/adblockpluschrome/lib/filterConfiguration.js',
          'adblock-betafish/jquery/jquery-3.5.1.min.js',
          'adblock-betafish/errorreporting.js',
          'adblock-betafish/survey.js',
          'adblock-betafish/alias/parseFilter.js',
          'adblock-betafish/background.js',
          'adblock-betafish/allowlisting.js',
          'adblock-betafish/contextmenus.js',
          'adblock-betafish/alias/icon.js',
          'adblock-betafish/twitchSettings.js',
          'adblock-betafish/youtube/yt-bg.js',
          'adblock-betafish/picreplacement/distraction-control-bg.js',
          'adblock-betafish/messaging/premium-message-responder.js',
          'adblock-betafish/messaging/message-responder.js',
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
        dest: 'ext',
        src: [
          'vendor/adblockplusui/adblockpluschrome/ext/**',
        ],
      },
      {
        dest: '',
        src: [
          'adblock-betafish/lib/purify.min.js',
          'adblock-betafish/CHANGELOG.txt',
          'COPYING',
          'adblock-betafish/translators.json',
          'adblock-betafish/jquery/jquery-3.5.1.min.js',
          'adblock-betafish/pubnub/pubnub.min.js',
          'adblock-betafish/lib/*',
          'adblock-betafish/adblock.css',
          'adblock-betafish/picreplacement/contentscript-loader.js',
          'vendor/adblockplusui/adblockpluschrome/devtools.html',
          'vendor/adblockplusui/devtools-panel.js',
          'adblock-betafish/alias/i18n.js',
          'vendor/adblockplusui/proxy.html'
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
        dest: 'adblock-options-events.js',
        src: 'adblock-betafish/options/events.js',
      },
      {
        dest: 'adblock-options-settingsproxy.js',
        src: 'adblock-betafish/messaging/settingsproxy.js',
      },
      {
        dest: 'adblock-options-prefsproxy.js',
        src: 'adblock-betafish/messaging/prefsproxy.js',
      },
      {
        dest: 'adblock-options-servermessagesproxy.js',
        src: 'adblock-betafish/messaging/servermessagesproxy.js',
      },
      {
        dest: 'adblock-options-filtersproxy.js',
        src: 'adblock-betafish/messaging/filtersproxy.js',
      },
      {
        dest: 'adblock-options-subscriptionsproxy.js',
        src: 'adblock-betafish/messaging/subscriptionsproxy.js',
      },
      {
        dest: 'adblock-options-subscriptionadapterproxy.js',
        src: 'adblock-betafish/messaging/subscriptionadapterproxy.js',
      },
      {
        dest: 'adblock-options-localdatacollectionproxy.js',
        src: 'adblock-betafish/messaging/localdatacollectionproxy.js',
      },
      {
        dest: 'adblock-options-datacollectionproxy.js',
        src: 'adblock-betafish/messaging/datacollectionproxy.js',
      },
      {
        dest: 'adblock-options-listenersupport.js',
        src: 'adblock-betafish/messaging/listenersupport.js',
      },
      {
        dest: 'adblock-options-premiumproxy.js',
        src: 'adblock-betafish/messaging/premiumproxy.js',
      },
      {
        dest: 'adblock-options-localcdnproxy.js',
        src: 'adblock-betafish/messaging/localcdnproxy.js',
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
        src: 'adblock-betafish/alias/devtools/devtools-panel.html',
      },
      {
        dest: 'devtools.js',
        src: 'adblock-betafish/alias/devtools/devtools.js',
      },
      {
        dest: 'skin/devtools-panel.css',
        src: 'adblock-betafish/alias/devtools/devtools-panel.css',
      },
      {
        dest: 'ext/devtools.js',
        src: 'adblock-betafish/alias/devtools/ext/devtools.js',
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
      {
        dest: "vendor/webext-sdk/content.js",
        src: "vendor/webext-sdk/dist/ewe-content.js"
      }
    ],
  },
  translations: {
    dest: '',
    src: [],
  },
};
