
const common = {
  webpack: {
    bundles: [
      {
        dest: 'qunit/tests.js',
        src: ['./tests/*'],
      },
    ],
  },
  mapping: {
    copy: [
      {
        dest: 'qunit',
        src: ['./adblockpluschrome/qunit/qunit.*'],
      },
    ],
  },
  tests: {
    scripts: [
      'qunit.js',
      '../polyfill.js',
      ' ../ext/common.js',
      '../ext/background.js',
      'tests.js',
    ],
  },
};

export const chromeDev = { ...common, extends: 'chrome' };
export const firefoxDev = { ...common, extends: 'firefox' };
