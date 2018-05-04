 // Used by both channels.js and picreplacement.js
const imageSizesMap = new Map([
  ["NONE", 0],
  ["wide", 1],
  ["tall", 2],
  ["skinnywide", 4],
  ["skinnytall", 8],
  ["big", 16],
  ["small", 32]
]);

const WIDE = imageSizesMap.get("wide");
const TALL = imageSizesMap.get("tall");
const SKINNYWIDE = imageSizesMap.get("skinnywide");
const SKINNYTALL = imageSizesMap.get("skinnytall");
const BIG = imageSizesMap.get("big");
const SMALL = imageSizesMap.get("small");
