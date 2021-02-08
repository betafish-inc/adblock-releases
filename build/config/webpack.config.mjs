
import path from 'path';

const tmplLoaderPath = path.resolve('adblockpluschrome', 'build', 'utils', 'wp-template-loader.js');

export default {
  optimization: {
    minimize: false,
  },
  output: {
    path: path.resolve(''),
  },
  node: {
    global: false,
  },
  resolve: {
    alias: {
      events$: 'events.js',
      punycode$: 'punycode.js',
      url$: 'url.js',
      prefs: path.resolve('', 'adblockpluschrome/lib/prefs.js'),
      './options': '../../adblock-betafish/alias/options.js',
      './icon': '../../adblock-betafish/alias/icon.js',
      subscriptionInit: '../../adblock-betafish/alias/subscriptionInit.js',
      uninstall: '../../adblock-betafish/alias/uninstall.js',
      recommendations: '../../adblock-betafish/alias/recommendations.js',
      notificationHelper: '../../adblock-betafish/alias/notificationHelper.js',
    },
    modules: [
      'adblockpluschrome/lib',
      'adblockpluschrome/adblockpluscore/lib',
      'adblockpluschrome/adblockplusui/lib',
      'build/templates',
      'node_modules',
    ],
  },
  resolveLoader: {
    alias: {
      'wp-template-loader': tmplLoaderPath,
    },
  },
};
