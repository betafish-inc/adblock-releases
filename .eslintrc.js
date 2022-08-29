
module.exports = {
  "env": {
      "browser": true,
      "jquery": true,
      "node": false,
  },
  "extends": "airbnb-base",
  "plugins": ["no-unsanitized"],
  "rules": {
      "linebreak-style": "off",
      "no-unused-vars": ["error", { "vars": "local" }],
      "strict": ["error", "global"],
      "func-names": ["error", "as-needed"],
      "brace-style": ["error", "1tbs", { "allowSingleLine": false }],
      "no-cond-assign": ["error", "except-parens"],
      "curly": ["error", "all"],
      "no-restricted-syntax": ["error", "LabeledStatement", "WithStatement"],
      "guard-for-in": "off",
      "no-plusplus": ["error", { "allowForLoopAfterthoughts": true }],
      "no-global-assign": ["error", {"exceptions": ["savedData"]}],
      "no-unsanitized/method": "error",
      "no-unsanitized/property": ["error", { "escape": { "methods": ["DOMPurify.sanitize"] }}],
      "no-underscore-dangle": ["error", { "allow": [
        "_url",
        "_filterText",
        "_title",
        "_subscriptions",
        "_lastDownload",
        "_downloadStatus"
      ]
      }],
      "camelcase": ["error", { "allow": [
          "adblock_installed",
          "adblock_userid",
          "adblock_version",
          "adblock_ext_id",
          "blockage_stats",
          "bug_report",
          "synchronize_invalid_url",
          "synchronize_connection_error",
          "synchronize_invalid_data",
          "synchronize_checksum_mismatch",
          "error_msg_header",
          "error_msg_help_us",
          "error_msg_thank_you",
          "error_msg_reload",
          "error_msg_help",
          "error_msg_partI",
          "show_statsinicon",
          "myadblock_enrollment",
          "popup_menu",
          "options_page",
          "install_timestamp",
          "debug_logging",
          "youtube_channel_whitelist",
          "youtube_manage_subscribed",
          "show_advanced_options",
          "show_block_counts_help_link",
          "show_statsinpopup",
          "display_menu_stats",
          "show_survey",
          "local_cdn",
          "twitch_hiding",
          "color_themes",
          "original_sid",
          "updated_sid",
          "block_count_limit",
          "web_accessible_resources",
          "strict_min_version",
          "app_id_release"
        ]
      }],
      "spaced-comment": ["error", "always", { "markers": ["#"] }],
      "import/no-unresolved": "off",
  },
  "parserOptions": {
      "sourceType": "script",
  },
  "settings": {
    // https://stackoverflow.com/questions/41769880/how-to-manually-add-a-path-to-be-resolved-in-eslintrc
    "import/resolver": {
      "node": {
        "paths": [
          "vendor/adblockplusui/lib/",
          "vendor/adblockplusui/adblockpluschrome/lib/",
          "vendor/adblockplusui/adblockpluschrome/adblockpluscore/lib",
        ]
      }
    }
  },
  "overrides": [
    {
      "files": ["*.mjs", "*.js"],
      "parserOptions": {
        "sourceType": "module",
        "allowImportExportEverywhere": true,
        "ecmaVersion": 11
      },
    }
  ]
};
