ext.backgroundPage.sendMessage({type: "elemhide.getSelectors"}, response => {
  var filters = [];
  let pairs = response.selectors.map((sel, i) => [sel, filters && filters[i]]);
  if (document.readyState != "loading")
  {
    var nodes = [document];
    let selectors = [];
    let filters = [];

    for (let [selector, filter] of pairs)
    {
      nodes: for (let node of nodes)
      {

        for (let element of node.querySelectorAll(selector))
        {
          // Only consider selectors that actually have an effect on the
          // computed styles, and aren't overridden by rules with higher
          // priority, or haven't been circumvented in a different way.
          if (getComputedStyle(element).display == "none")
          {
            // For regular element hiding, we don't know the exact filter,
            // but the background page can find it with the given selector.
            // In case of element hiding emulation, the generated selector
            // we got here is different from the selector part of the filter,
            // but in this case we can send the whole filter text instead.
            if (filter)
              filters.push(filter);
            else
              selectors.push(selector);

            break nodes;
          }
        }
      }
    }
    if (selectors.length > 0 || filters.length > 0)
    {
      ext.backgroundPage.sendMessage({
        type: "datacollection.elementHide",
        selectors, filters
      });
    }
  }
});