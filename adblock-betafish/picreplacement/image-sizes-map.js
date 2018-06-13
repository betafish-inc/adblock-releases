// Used by both channels.js and picreplacement.js
// Since this file is conditional loaded, and not part of the content script web pack,
// 'exports' may not be defined, so we use this hack
if (typeof exports === "undefined") {
  var exports = {};
}

const imageSizesMap =
exports.imageSizesMap = new Map([
  ["NONE", 0],
  ["wide", 1],
  ["tall", 2],
  ["skinnywide", 4],
  ["skinnytall", 8],
  ["big", 16],
  ["small", 32]
]);

const WIDE =
exports.WIDE = imageSizesMap.get("wide");
const TALL =
exports.TALL = imageSizesMap.get("tall");
const SKINNYWIDE =
exports.SKINNYWIDE = imageSizesMap.get("skinnywide");
const SKINNYTALL =
exports.SKINNYTALL = imageSizesMap.get("skinnytall");
const BIG =
exports.BIG = imageSizesMap.get("big");
const SMALL =
exports.SMALL = imageSizesMap.get("small");
