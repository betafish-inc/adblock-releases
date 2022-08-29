
export const imageSizesMap = new Map([
  ['NONE', 0],
  ['wide', 1],
  ['tall', 2],
  ['skinnywide', 4],
  ['skinnytall', 8],
  ['big', 16],
  ['small', 32],
]);


export const WIDE = imageSizesMap.get('wide');
export const TALL = imageSizesMap.get('tall');
export const BIG = imageSizesMap.get('big');
export const SMALL = imageSizesMap.get('small');
export const SKINNYWIDE = imageSizesMap.get('skinnywide');
export const SKINNYTALL = imageSizesMap.get('skinnytall');
