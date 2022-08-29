/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */
/* global Mocha, require */

/*
 * This module is the same as:
   https://gitlab.com/eyeo/adblockplus/abp-snippets/-/tree/next/test/browser/_bootstrap.js
   except for:
   - lint / style modifications
   - renamed the gobal var '_consoleLogs' to 'testingConsoleLogs'
 */

'use strict';

require('mocha');
require('chai');

if (typeof window.testingConsoleLogs === 'undefined') {
  window.testingConsoleLogs = { passes: 0, failures: 0, log: [] };
}

/*
 * Custom reporter for our harness. Reworked from `Spec` to use
 * template string as the chrome remote interface doesn't support
 * mutiple console.log arguments.
 */
function WdReporter(runner, options) {
  Mocha.reporters.Spec.call(this, runner, options);

  runner.on('fail', () => {
    window.testingConsoleLogs.failures += 1;
  });
}

Mocha.utils.inherits(WdReporter, Mocha.reporters.Spec);

function runTests(moduleNames) {
  const oldLog = Mocha.reporters.Base.consoleLog;
  Mocha.reporters.Base.consoleLog = (...msg) => {
    window.testingConsoleLogs.log.push(msg);
    oldLog.call(this, ...msg);
  };

  mocha.setup({ ui: 'bdd', reporter: WdReporter });

  for (const module of moduleNames) {
    require(`./${module}.js`);
  }

  return new Promise((resolve) => {
    mocha.run(resolve);
  });
}

module.exports = runTests;
