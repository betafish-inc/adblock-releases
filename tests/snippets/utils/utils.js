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

// A 'local' copy of this file:
// https://gitlab.com/eyeo/adblockplus/abp-snippets/-/blob/ba61e5d4a84f7058bfd75e6e17f4bab883a34b62/lib/utils.js
// since it is currently not in the NPM eyeo/snippets project

/** @module */

let singleCharacterEscapes = new Map([
    ["n", "\n"], ["r", "\r"], ["t", "\t"]
  ]);

  /**
   * Parses a script and returns a list of all its commands and their arguments.
   * @param {string} script The script.
   * @returns {Array.<string[]>} A list of commands and their arguments.
   * @package
   */
  export function parseScript(script) {
    let tree = [];

    let escape = false;
    let withinQuotes = false;

    let unicodeEscape = null;

    let quotesClosed = false;

    let call = [];
    let argument = "";

    for (let character of script.trim() + ";") {
      let afterQuotesClosed = quotesClosed;
      quotesClosed = false;

      if (unicodeEscape != null) {
        unicodeEscape += character;

        if (unicodeEscape.length == 4) {
          let codePoint = parseInt(unicodeEscape, 16);
          if (!isNaN(codePoint))
            argument += String.fromCodePoint(codePoint);

          unicodeEscape = null;
        }
      }
      else if (escape) {
        escape = false;

        if (character == "u")
          unicodeEscape = "";
        else
          argument += singleCharacterEscapes.get(character) || character;
      }
      else if (character == "\\") {
        escape = true;
      }
      else if (character == "'") {
        withinQuotes = !withinQuotes;

        if (!withinQuotes)
          quotesClosed = true;
      }
      else if (withinQuotes || character != ";" && !/\s/.test(character)) {
        argument += character;
      }
      else {
        if (argument || afterQuotesClosed) {
          call.push(argument);
          argument = "";
        }

        if (character == ";" && call.length > 0) {
          tree.push(call);
          call = [];
        }
      }
    }

    return tree;
  }

  /**
   * Compiles a script against a given list of libraries, passed as JSON
   * serialized string, or a an array of strings, into executable code.
   * @param {string|Array.<string>} scripts One or more scripts to convert into
   *  executable code.
   * @param {string} isolatedSnippetsLibrary The stringified bundle to be executed
   * in the isolated content script context.
   * @param {string} injectedSnippetsLibrary The stringified bundle to be injected
   * and executed in the main context.
   * @param {string|Array.<string>} injectedSnippetsList An array containing the
   * available injectable snippets.
   * @param {object} [environment] An object containing environment variables.
   * @returns {string} Executable code.
   */
  export function compileScript(scripts,
                                isolatedSnippetsLibrary,
                                injectedSnippetsLibrary,
                                injectedSnippetsList,
                                environment = {}) {
    let isolatedLib = JSON.stringify(isolatedSnippetsLibrary);
    let injectedLib = JSON.stringify(injectedSnippetsLibrary);
    let jsonEnv = JSON.stringify(environment);
    return `
      (() =>
      {
        let scripts = ${JSON.stringify([].concat(scripts).map(parseScript))};

        let isolatedLib = ${isolatedLib};
        let imports = Object.create(null);
        let injectedSnippetsCount = 0;
        let loadLibrary = new Function("exports", "environment", isolatedLib);
        loadLibrary(imports, ${jsonEnv});
        const isolatedSnippets = imports.snippets;

        let injectedLib = ${injectedLib};
        let injectedSnippetsList = ${JSON.stringify(injectedSnippetsList)};
        let executable = "(() => {";
        executable += "let environment = ${jsonEnv.replace(/[\\"]/g, "\\$&")};";
        executable += injectedLib;

        let {hasOwnProperty} = Object.prototype;
        for (let script of scripts)
        {
          for (let [name, ...args] of script)
          {
            if (hasOwnProperty.call(isolatedSnippets, name))
            {
              let value = isolatedSnippets[name];
              if (typeof value == "function")
                value(...args);
            }
            if (injectedSnippetsList.includes(name))
            {
              executable += stringifyFunctionCall(name, ...args);
              injectedSnippetsCount++;
            }
          }
        }

        executable += "})();";

        if (injectedSnippetsCount > 0)
          injectSnippetsInMainContext(executable);

        function stringifyFunctionCall(func, ...params)
        {
          // Call JSON.stringify on the arguments to avoid any arbitrary code
          // execution.
          const f = "snippets['" + func + "']";
          const parameters = params.map(JSON.stringify).join(",");
          return f + "(" + parameters + ");";
        }

        function injectSnippetsInMainContext(exec)
        {
          // injecting phase
          let script = document.createElement("script");
          script.type = "application/javascript";
          script.async = false;

          // Firefox 58 only bypasses site CSPs when assigning to 'src',
          // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
          // only bypass site CSPs when using 'textContent'.
          if (typeof netscape != "undefined" && typeof browser != "undefined")
          {
            let url = URL.createObjectURL(new Blob([executable]));
            script.src = url;
            document.documentElement.appendChild(script);
            URL.revokeObjectURL(url);
          }
          else
          {
            script.textContent = executable;
            document.documentElement.appendChild(script);
          }

          document.documentElement.removeChild(script);
        }
      })();
    `;
  }
