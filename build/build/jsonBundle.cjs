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
