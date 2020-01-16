/*
 * Same as the original source adblockpluschrome/adblockpluscore/lib/messageResponder.js
 * except:
 * - only included the FilterError class and the parseFilter function
 * - added 'parseFilter' message listener
 * - 'parseFilter' returns an object instead of an array
 * - 'parseFilter' sets filter to the text in the case of an invalid header
 * - linted according to our style rules

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

"use strict";

const { InvalidFilter } = require('filterClasses');

class FilterError
{
  constructor(type, reason = null)
  {
    this.lineno = null;
    this.reason = reason;
    this.selector = null;
    this.type = type;
  }

  toJSON()
  {
    return {
      lineno: this.lineno,
      reason: this.reason,
      selector: this.selector,
      type: this.type
    };
  }
}

function parseFilter(text)
{
  let filter = null;
  let error = null;

  text = Filter.normalize(text);
  if (text)
  {
    if (text[0] == "[")
    {
      filter = text;
      error = new FilterError("unexpected_filter_list_header");
    }
    else
    {
      filter = Filter.fromText(text);
      if (filter instanceof InvalidFilter)
        error = new FilterError("invalid_filter", filter.reason);
    }
  }

  return { filter, error };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'parseFilter' || !message.filterTextToParse) {
    return;
  }
  sendResponse(parseFilter(message.filterTextToParse));
});

Object.assign(window, {
  parseFilter,
});
