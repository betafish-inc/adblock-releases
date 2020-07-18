// This file is based on this similar ABP file:
// https://github.com/adblockplus/adblockpluschrome/blob/master/devtools.js
"use strict";

let panelWindow = null;

// Versions of Firefox before 54 do not support the devtools.panels API; on
// these platforms, even when the option is enabled, we cannot show the
// devtools panel.
if ("panels" in browser.devtools)
{
  browser.runtime.sendMessage(
    {
      type: "prefs.get",
      key: "show_devtools_panel"
    }).then(enabled =>
    {
      if (enabled)
      {
        browser.devtools.panels.create(
          "AdBlock",
          "icons/ab-32.png",
          "devtools-panel.html").then(panel =>
          {
            panel.onShown.addListener(window =>
            {
              panelWindow = window;
            });

            panel.onHidden.addListener(window =>
            {
              panelWindow = null;
            });

            if (panel.onSearch)
            {
              panel.onSearch.addListener((eventName, queryString) =>
              {
                if (panelWindow)
                  panelWindow.postMessage({type: eventName, queryString}, "*");
              });
            }
          }
        );
      }
    }
  );
}