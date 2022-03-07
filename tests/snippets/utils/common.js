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
/* global chai */
/* eslint no-new-func: "off" */

"use strict";

const jsonArtifacts = require("../../../vendor/abp-snippets/dist/webext/snippets.json");
const jsonArtifactsAdBlock = require('../../../dist/adblock-snippets.json');
const {compileScript} = require("../../../vendor/abp-snippets/lib/utils.js");

async function runSnippetScript(script)
{
  new Function(compileScript(script,
                             jsonArtifacts.isolatedCode + jsonArtifactsAdBlock.isolatedCode,
                             jsonArtifacts.injectedCode + jsonArtifactsAdBlock.injectedCode,
                             jsonArtifacts.injectedList + jsonArtifactsAdBlock.injectedList))();

  // For snippets that run in the context of the document via a <script>
  // element (i.e. snippets that use makeInjector()), we need to wait for
  // execution to be complete.
  await timeout(100);
}

function timeout(delay)
{
  return new Promise(resolve =>
  {
    setTimeout(resolve, delay);
  });
}

exports.timeout = timeout;
exports.runSnippetScript = runSnippetScript;
