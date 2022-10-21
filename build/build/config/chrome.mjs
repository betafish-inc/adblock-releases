
export default {
  extends: 'base',
  webpack: {
    bundles: [
      {
        dest: 'abp-background.js',
        src: [
          'adblock-betafish/localcdn.js',
        ],
      },
    ],
    alias: {
      info$: 'info.chrome.js.tmpl',
    },
  },
};
