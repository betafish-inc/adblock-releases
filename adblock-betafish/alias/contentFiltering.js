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
import * as snippets from "@eyeo/snippets";

function loadSnippets() {
  ewe.snippets.setLibrary({
    injectedCode: snippets.injected,
    isolatedCode: snippets.isolated
  });
};
loadSnippets();
