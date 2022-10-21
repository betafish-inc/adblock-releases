/*
 * Same as the original source adblockpluschrome/lib/contentFiltering.js
 * except:
 * - updated require paths
 * - added fetch() of second snippet library
 */
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

/** @module contentFiltering */

import * as ewe from '../../vendor/webext-sdk/dist/ewe-api';

let snippetsSource = {};

function loadSnippets() {  
  return new Promise(async (resolve) => {
    try {
      let response = await fetch(
        browser.runtime.getURL("/snippets.json"),
        {cache: "no-cache"}
      );
      if (!response.ok) {
        return;
      }

      snippetsSource = await response.json();
      ewe.snippets.setLibrary(snippetsSource);
      resolve();
    }
    catch (e) {
      // If the request fails, the snippets library is not
      // bundled with the extension, so we silently ignore this error.
      resolve();
    }
  });
};
const snippetPromise = loadSnippets();

export const loadAdBlockSnippets = function () {
  snippetPromise.then(async () => {
    try {
      let response =
        await fetch(browser.runtime.getURL("/adblock-snippets.json"),
          { cache: "no-cache" });
      
      if (!response.ok) {
          return;      
      }
      
      let ABsnippetsSource = await response.json();
  
      if (ABsnippetsSource.injectedCode) {
        snippetsSource.injectedCode = snippetsSource.injectedCode + ABsnippetsSource.injectedCode;
      }
      if (ABsnippetsSource.injectedList) {
        snippetsSource.injectedList = snippetsSource.injectedList.concat(ABsnippetsSource.injectedList);
      }
      if (ABsnippetsSource.isolatedCode) {
        snippetsSource.isolatedCode = snippetsSource.isolatedCode + ABsnippetsSource.isolatedCode;
      }
      ewe.snippets.setLibrary(snippetsSource);
    }
    catch (e) {
      // If the request fails, the snippets library is not
      // bundled with the extension, so we silently ignore this error.
    }
  });
};



