
import path from 'path';

const tmplLoaderPath = path.resolve('adblockplusui', 'adblockpluschrome', 'build', 'utils', 'wp-template-loader.cjs');

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
      prefs: path.resolve('', 'adblockplusui/adblockpluschrome/lib/prefs.js'),
      './options': '../../adblock-betafish/alias/options.js',
      './icon': '../../adblock-betafish/alias/icon.js',
      subscriptionInit: '../../adblock-betafish/alias/subscriptionInit.js',
      './requestBlocker.js': '../../../adblock-betafish/alias/requestBlocker.js',
      uninstall: '../../adblock-betafish/alias/uninstall.js',
      recommendations: '../../adblock-betafish/alias/recommendations.js',
      notificationHelper: '../../adblock-betafish/alias/notificationHelper.js',
    },
    modules: [
      'adblockplusui/adblockpluschrome/lib',
      'adblockplusui/adblockpluschrome/adblockpluscore/lib',
      'adblockplusui/lib',
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
