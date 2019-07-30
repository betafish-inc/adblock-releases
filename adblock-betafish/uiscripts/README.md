# UI Scripts

AdBlock contains features that require "injecting" user interfaces into web pages. These currently include:

* Blacklist Wizard (aka "Block this ad" & "Block an ad on this page")
* Whitelist Wizard (aka "Don't run on pages on this site")

In order to avoid conflicts with the web page's styles and libraries, we inject all elements within a [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) mounted on the page's `<body>` element. Once injected, we reset all of the host page styles for the elements our UI employs by setting our element styles to `all: initial;` - effectively returning the shadow DOM to the original user agent style sheet. We can then build styles in safety without having to worry about style overrides or other shenanigans(*).

(*) We currently support Chrome versions 49-52 which don't support shadow DOM. This requires a fallback solution with high specificity CSS declarations to minimize conflicts with the host page styles.

In order to test the wizards without shadow DOM copy-and-paste this in the Console tab of the host page Dev Tools:
```
sessionStorage.setItem('adblock.wizard.shadow', 'ignore')
```
To restore and test the wizards with shadow DOM, copy-and-paste this instead:
```
sessionStorage.removeItem('adblock.wizard.shadow')
```