# 集成bg.js
- src: adblock-releases\build\config\base.mjs
- 涉及 
``` js
[
    'adblockplusui/adblockpluschrome/lib/devtools.js',
    'adblockplusui/adblockpluschrome/lib/debug.js',
    'adblock-betafish/alias/requestBlocker.js',
    'adblockplusui/adblockpluschrome/lib/popupBlocker.js',
    'adblockplusui/adblockpluschrome/lib/stats.js',
    'adblockplusui/adblockpluschrome/lib/csp.js',
    'adblock-betafish/alias/contentFiltering.js',
    'adblockplusui/adblockpluschrome/lib/messageResponder.js',
    'adblockplusui/adblockpluschrome/lib/filterConfiguration.js',
    'adblockplusui/adblockpluschrome/lib/ml.js',
    // 'adblock-betafish/jquery/jquery-3.5.1.min.js',
    'adblock-betafish/errorreporting.js',
    'adblock-betafish/functions.js',
    'adblock-betafish/survey.js',
    'adblock-betafish/settings.js',
    'adblock-betafish/alias/parseFilter.js',
    'adblock-betafish/background.js',
    'adblock-betafish/contextmenus.js',
    'adblock-betafish/alias/subscriptionInit.js',
    // 'adblock-betafish/alias/icon.js',
    'adblock-betafish/excludefilter.js',
    // 'adblock-betafish/picreplacement/image-sizes-map.js',
    // - premiun.图像交换 功能用的图片信息
    // 'adblock-betafish/picreplacement/channels.js',
    // 'adblock-betafish/picreplacement/cat-channel.js',
    // 'adblock-betafish/picreplacement/dog-channel.js',
    // 'adblock-betafish/picreplacement/landscape-channel.js',
    // 'adblock-betafish/picreplacement/custom-channel.js',
    // 'adblock-betafish/picreplacement/birds-channel.js',
    // 'adblock-betafish/picreplacement/food-channel.js',
    // 'adblock-betafish/picreplacement/goat-channel.js',
    // 'adblock-betafish/picreplacement/ocean-channel.js',
    // 'adblock-betafish/picreplacement/unknown-channel.js',

    'adblock-betafish/picreplacement/check.js',
    'adblock-betafish/picreplacement/sync-service.js',
    'adblock-betafish/picreplacement/distraction-control-bg.js',
    'adblock-betafish/getselectors.js',
    'adblock-betafish/data_migration.js',
    // - 个别网站的屏蔽设置
    'adblock-betafish/twitchSettings.js',
    'adblock-betafish/youtube/yt-bg.js',
]
```

# 涉及广告的filter list
https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt?addonName=adblockchrome&addonVersion=4.38.0&application=chrome&applicationVersion=95.0.4638.54&platform=chromium&platformVersion=95.0.4638.54&lastVersion=0&downloadCount=0&disabled=false&firstVersion=20211020