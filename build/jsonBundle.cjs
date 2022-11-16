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

"use strict";

const { existsSync, readFileSync, writeFile } = require("fs");
const { join } = require("path");

const snippetsPath = join("dist");

let isolatedPath = join(snippetsPath, "bundle.isolated.js");

// get out if there is no built artifact
for (let source of [isolatedPath]) {
  if (!existsSync(source)) {
    console.error(`Couldn't find ${source}`);
    process.exit(1);
  }
}

let content = {
  injectedCode: "",
  isolatedCode: readFileSync(isolatedPath).toString(),
  injectedList: ""
};

writeFile(join(snippetsPath, "adblock-snippets.json"),
  JSON.stringify(content),
  error => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
  });
