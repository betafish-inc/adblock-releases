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

/* This module is the same as:
 *
 * https://gitlab.com/eyeo/adblockplus/abp-snippets/-/tree/next/test/runners/chromium_process.js
 * except for:
 * - lint / style modifications
 * - added set of 'logging' info from webdriver
*/

import webdriver from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import 'chromedriver';

import { executeScript } from './webdriver.mjs';
import { ensureChromium } from './chromium_download.mjs';

const { logging } = webdriver;

// The Chromium version is a build number, quite obscure.
// Chromium 63.0.3239.x is 508578
// Chromium 65.0.3325.0 is 530368
// We currently want Chromiun 63, as we still support it and that's the
// loweset version that supports WebDriver.
const CHROMIUM_REVISION = 508578;

async function runScript(chromiumPath, script, scriptArgs) {
  const options = new chrome.Options()
    // Disabling sandboxing is needed on some system configurations
    // like Debian 9.
    .addArguments('--no-sandbox')
    .setChromeBinaryPath(chromiumPath);
  // Headless doesn't seem to work on Windows.
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
  if (process.platform !== 'win32'
    && process.env.BROWSER_TEST_HEADLESS !== '0') {
    options.headless();
  }

  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setLoggingPrefs(prefs)
    .build();

  await driver.get('http://localhost:3000');
  await driver.findElement(webdriver.By.css('.test'));

  return executeScript(driver, 'Chromium (WebDriver)', script, scriptArgs);
}

export default function (script, scriptName, ...scriptArgs) {
  return ensureChromium(CHROMIUM_REVISION)
    .then(chromiumPath => runScript(chromiumPath, script, scriptArgs));
}
