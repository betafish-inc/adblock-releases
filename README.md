# AdBlock

## Intro

[AdBlock](https://getadblock.com/) is a popular ad blocking extension for Chrome,
Edge and Firefox.

## Requirements

- Node >= 16.10.0
- npm >= 7

## Usage
Building
---------

### Building on Windows

On Windows, you need a [Linux environment running on WSL](https://docs.microsoft.com/windows/wsl/install-win10).
Then install the above requirements and run the commands below from within Bash.

### Updating the dependencies

In order to build the extension, you need to run the

`npm run submodules:update`

script. This build won't include the snippets library.

In order to create a build which includes the snippets library, you should run the

`npm run submodules:update-with-snippets`

script instead. This will work only if you have access to the [abp-snippets repository](https://gitlab.com/eyeo/adblockplus/abp-snippets).

_Note: when building from a source archive, the above step must be skipped._

Run the following command to install all of the required packages

`npm install`

The above script will install the required npm packages for AdBlock, Adblock Plus, and run any pre & post install processing scripts.

Rerun the above commands when the dependencies might have changed,
e.g. after checking out a new revison.

### Building the extension

Run the following command in the project directory:

`npx gulp build -t {chrome|firefox} [-c development]`

This will create a build with a name in the form
_adblockpluschrome-n.n.n.zip_ or _adblockplusfirefox-n.n.n.xpi_. These builds
are unsigned. They can be submitted as-is to the extension stores, or if
unpacked loaded in development mode for testing (same as devenv builds below).

### Development environment

To simplify the process of testing your changes you can create an unpacked
development environment. For that run one of the following command:

`npx gulp devenv -t {chrome|firefox}`

This will create a _devenv.*_ directory in the project directory. You can load
the directory as an unpacked extension under _chrome://extensions_ in
Chromium-based browsers, and under _about:debugging_ in Firefox. After making
changes to the source code re-run the command to update the development
environment, and the extension should reload automatically after a few seconds.

### Other Build options

Two other build options are provided to aid in testing of the extension.

`--ext-version` - specifiying this parameter at build time will override the version specified in the `build/config/base.mjs` file.  Most information about the format of the version in the manifest.json file can be found [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version/format).

`--ext-id` - specifiying this parameter at build time will override the Firefox / Mozilla extension id specified in the `build/manifest.json` file. More information about the format and when to provide the Extension / Add-on ID can be found [here](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/).

## Code Style

We use a standard code style enforced by [eslint](https://eslint.org) for JavaScript and [Prettier](https://prettier.io) for HTML, CSS and JSON. We use [HTMLhint](https://github.com/htmlhint/HTMLHint) for HTML accessibility and standards checking. To use these tools, install [Node.js](https://nodejs.org) and run the following command in the project directory:

```bash
npm install
```

Specifically, the standard JavaScript code style we've adopted is the [Airbnb JavaScript style guide](https://github.com/airbnb/javascript/blob/master/README.md)

The following npm commands are then available:

* `npm run lint` runs eslint and prints out all JavaScript violations.
* `npm run lint-fix` runs eslint and automatically fixes JavaScript style violations in place (be sure to commit before running this command in case you need to revert the changes eslint makes).
* `npm run prettier` runs prettier on HTML, CSS, and JSON files in the adblock-betafish directory and list all files that need to be Prettier.
* `npm run prettier-fix` runs prettier and automatically replaces with Prettier versions for HTML, CSS, and JSON files in the adblock-betafish directory.
* `npm run html-hint` runs HTMLhint and flags any issues with the HTML templates such as missing `DOCTYPE`, tags and/or attributes. This does not run on pre-commits so it must be run manually. New AdBlock custom attributes should be added in `/rules/static/custom_attributes.json`. If mistakenly flagged, standard HTML attributes should be added in `/rules/static/aria_attributes.json` or `/rules/static/mapped_attributes.json`.

## Developer Guide

General guidelines for developing AdBlock specific code.

Running the unit tests
----------------------

### Requirements

In order to run the unit test suite you need
[Node.js 16.10.0 or higher](https://nodejs.org/). Once Node.js is installed
please run `npm install` in the repository directory in order to install the
required dependencies.

You will also need to access to the [abp-snippets repository](https://gitlab.com/eyeo/adblockplus/abp-snippets).

### Running Snippets tests

The `./tests/snippets/browser` folder contains the unit tests files.

`npm run test-snippets` will run all tests in the `tests` directory of the repository.

### Running Snippet tests with the '--debugPrint' parameter

Since Snippets can have a 'debug' flag set. Calling debug before a snippet turns on the debug flag. If the other snippets support it, they'll enable their debug mode.

To see the output from the debug for a Snippet, or the console.log statements in the Mocha test script, run the `npm run test-snippets-with-debug` command.  Currently, this command will only work in the Chromium remote browser.

### Running the browser tests in a real browser

The tests under `./tests/snippets/browser` require a browser environment. `npm run test-snippets` will
run these in a headless browser, with each module being loaded in a new frame.

The default is to run in both Chromium (using the remote interface)
and Firefox. You can select which runners to use by setting the
BROWSER_TEST_RUNNERS environment, the default is
"chromium_remote,firefox". Possible values (separated by a ',') are:

- "chromium_remote": Chromium 60 (using the remote interface)
- "chromium": Chrome 63 (using WebDriver)
- "firefox": Firefox 57 (using WebDriver)

You can not set a specific version of the browser at runtime.

Browser tests run headless by default (except on Windows). If you want
to disable headless mode on the WebDriver controlled tests, set the
BROWSER_TEST_HEADLESS environment to 0.

### Running the unit tests on Windows

On Windows, you'll need to run the tests under [Linux environment running on WSL](https://docs.microsoft.com/windows/wsl/install-win10).  Also, the Firefox tests will fail to run on Windows.  


Note:  If you see the following error:
`chromium-linux-467222/chrome-linux/chrome: error while loading shared libraries: libgconf-2.so.4: cannot open shared object file: No such file or directory`

run the following command in WSL: `sudo apt install libgconf-2-4` 
This command will install the necessary library.

### Icons and Graphics

All graphics use SVG when at all possible. The current exception is the extension toolbar icon which is currently a PNG. There is work in progress to replace this image with SVG.

Icons use SVG web fonts. We primarily use [Material Design Icons](https://www.material.io/resources/icons/?style=baseline) and provide a few custom icons via the AdBlock Icons project. Standard markup to display the "settings" icon would be:

```html
<i class="material-icons">settings</i>
```

For <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> compliance, we use <abbr title="Accessible Rich Internet Applications">ARIA</abbr> content to make the web icons accessible for screen readers. Read the [full description](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA24) for details, but  a summary of the steps are:

* mark the web icon element using attribute `role="img"`
* if the web icon is purely visual, use `aria-hidden="true"`
* if the web icon is semantic, use `aria-label="Settings"` to provide the screen reader description of the icon.

An example of an icon used as a button:

```html
<i class="material-icons" role="img" aria-label="Extension settings">settings</i>
```

An example of an icon that "decorates" text and does not need to be read by the screen reader:

```html
<i class="material-icons" role="img" aria-hidden="true">check_circle</i> We are OK
```

### Accessibility

The following are notes for improving the accessibility of the AdBlock user interface.

#### Assistive Technologies

Assistive Technologies (<abbr>AT</abbr>) such as screen readers present the web content to users dramatically differently than the visual renderer.

It is important to optimize AT UX for "skipping" content. Important information should be presented first, followed by additional details. This allows the user to skip the reading of the detailed information if they are trying to navigate to particular sections of the UI.

AT use the HTML document structure and the semantic meaning associated with different HTML elements to assist in making content easy to understand. Many AT and their end users create custom stylesheets assigning different presentations (volumes, tone, etc) to different element types (i.e. `<h1>` elements may be spoken more loudly and with a deeper tone). Whenever possible use appropriate HTML elements to assist these stylesheets.

AT present the screen content as a "snapshot" of the content at the point in time when the element is visited. Dynamic content should carefully consider what the AT presentation should be when presented, and whether it's worth the distraction to the user when deciding if alerting the user of a change is desired. Content that should be dynamic should be marked the appropriate ARIA [live region roles](https://www.w3.org/TR/wai-aria-1.1/#live_region_roles) and [live region attributes](https://www.w3.org/TR/wai-aria-1.1/#attrs_liveregions). It is much harder for a user of a AT to "ignore" notifications.

`tabindex` is a good "quick fix" for controlling AT focus. Assign a value of `0` for items that should receive keyboard focus, and a `-1` for items that normally receive focus but should not for an AT. However, `tabindex` is a crutch - elements that receive focus should use the proper HTML elements and ARIA `role` attribute so the browser can automatically and "naturally" determine focus. Many users will have custom stylesheets for their AT that helps with their particular disability and those will be bypassed by using `div` elements for everything and brute forcing particular AT behaviors. We should consider the presence of `tabindex` as an "automatic technical debt" for improving the HTML in the future.

`tabindex` trivia: `tabindex` set on the `label` for an `input` transfers the focus to the `input`. Focus on the `input` reads it's `label`. The AT won't go into a loop or double-read the `label`. So setting a `tabindex` on the label reads the label when the input gets focus. Entering tab will go to the `label` but the AT won't read anything - so it feels like the tab is "broken/stuck" for the AT (visually you see the focus switch but the AT does not speak anything). The third tab then moves to the next input. Setting `tabindex="-1"` on the `input` and `tabindex="0"` on the `label` looks more correct - the label highlights and is spoken when it gets focus and keyboard input toggles (in the case of a checkbox) the input. However (on Chrome) the AT freaks out and reads all the `label` entries that are "nearby" in the DOM when the first input gets focus and then does not read anything else as focus moves in the "nearby group" (aka don't do it).

It is important to test using a screen reader. There is no substitute for experiencing and trying to operate the UI regularly using AT. Some small changes create amazing improvements to the AT UX and some unexpected outputs can be unusually annoying when using an AT. On Mac, use `cmd-F5` to toggle Voice Over on/off (or open System Preferences | Accessibility | Voice Over) and use the keyboard for navigation. TODO Windows and Linux testing options?

### Help Flow Map

The help flow structure is defined in `help-map.json`. Each entry represents a page in the help flow, and the key for each entry needs to be unique.

Each page can contain any combination of the following:
  * `title`: displayed at the top of page, i18n string key, max one per page
  * `seques`: displayed first in body of page, can have multiple per page
    * `content`: i18n string key, max one per segue
    * `segueTo`: key for help flow page to transition to on click, max one per segue
    * `sequeToIfPaused`: key for help flow page to transition to on click if paused, max one per segue
    * `segueToIfWhitelisted`: key for help flow page to transition to on click if whitelisted, max one per segue
  * `sections`: displayed second in body of page, can have multiple per page
    * `content`: array of objects representing sentences to be displayed as a paragraph, can have multiple per section
      * `text`: i18n string key
      * `linkURL`: URL to be subbed into a string with link placeholders ("[[" and "]]")
  * `buttons`: displayed third in body of page, can have multiple per page
    * `text`: i18n string key
    * `action`: function from `help-action.js` to be called on click
    * `icon`: material icons key of icon to be displayed on button, displayed before text
  * `footer`: displayed at bottom of page, i18n string key, max one per page
