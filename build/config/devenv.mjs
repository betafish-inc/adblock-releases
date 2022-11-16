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
