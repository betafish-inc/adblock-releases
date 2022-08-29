
const common = {
  webpack: {
    bundles: [

    ],
  },
  mapping: {
    copy: [
      {
        dest: 'tests',
        src: [
          'node_modules/mocha/mocha.js',
          'node_modules/mocha/mocha.css',
        ],
      },
    ],
  },
  unitTests: {
    scripts: [
      'mocha.js',
      'mocha-setup.js',
      '../polyfill.js',
      '../ext/common.js',
      '../ext/background.js',
      'unit-tests.js',
      'mocha-runner.js',
    ],
  },
};

export const chromeDev = { ...common, extends: 'chrome' };
export const firefoxDev = { ...common, extends: 'firefox' };
