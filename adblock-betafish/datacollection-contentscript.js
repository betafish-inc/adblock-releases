var matchSelectors = [];
var pairs = [];
var chunkSize = 1000;
function* genFunc()
{
  var i = pairs.length;
  while (i--)
  {
    yield pairs.splice((-1 * chunkSize), chunkSize);
  }
}

chrome.runtime.sendMessage({type: "getSelectors"}, response =>
{
  if (document.readyState != "loading")
  {
    selectors = [];
    pairs = response.selectors;

    let interval = setInterval(() =>
    {
      let val = genFunc().next();
      if (val.done) {
        clearInterval(interval);
        if (matchSelectors.length > 0)
        {
          let noDuplicates = Array.from(new Set(matchSelectors)); // remove any duplicates
          chrome.runtime.sendMessage({ type: "datacollection.elementHide", selectors: noDuplicates });
        }
      }
      else
      {
        let selectors = val.value;
        for (let selector of selectors)
        {
          for (let element of document.querySelectorAll(selector))
          {
            // Only consider selectors that actually have an effect on the
            // computed styles, and aren't overridden by rules with higher
            // priority, or haven't been circumvented in a different way.
            if (getComputedStyle(element).display == "none")
            {
              matchSelectors.push(selector);
            }
          }
        }
      }
    }, 10); // pause 10 milli-seconds between each chunck
  }
});