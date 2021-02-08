
export default {
  extends: 'base',
  webpack: {
    bundles: [
      {
        dest: 'abp-background.js',
        src: [
          'adblock-betafish/localFilesIndex.js',
        ],
      },
    ],
    alias: {
      info$: 'info.chrome.js.tmpl',
    },
  },
};
