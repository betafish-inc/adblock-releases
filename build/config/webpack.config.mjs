import path from 'path';

const tmplLoaderPath = path.resolve("build", "utils", "wp-template-loader.cjs");

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
      prefs: path.resolve('', 'vendor/adblockplusui/adblockpluschrome/lib/prefs.js'),
      './options': '../../adblock-betafish/alias/options.js',
      '../../lib/pages/options.js': '../../../../adblock-betafish/alias/options.js',
      './icon': '../../adblock-betafish/alias/icon.js',
      'subscriptionInit': '../../adblock-betafish/alias/subscriptionInit.js',
      uninstall: '../../adblock-betafish/alias/uninstall.js',
      '../../vendor/webext-sdk/dist/ewe-api.js': path.resolve('', 'vendor/webext-sdk/dist/ewe-api.js')
    },
    modules: [
      'vendor/adblockplusui/adblockpluschrome/lib',
      'vendor/adblockplusui/lib',
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
