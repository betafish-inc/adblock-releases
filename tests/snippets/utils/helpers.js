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

const {assert} = chai;

function expectHidden(element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  assert.equal(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should be set to 'none'`);
}

function expectVisible(element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  assert.notEqual(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should not be set to 'none'`);
}

exports.expectHidden = expectHidden;
exports.expectVisible = expectVisible;
