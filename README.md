# AdBlock

## Intro

[AdBlock](https://getadblock.com/) is a popular ad blocking extension for Chrome,
Opera and Safari, now based on the [Adblock Plus](https://adblockplus.org/) code.
By leveraging the Adblock Plus build system `build.py` and dependency management
tool `ensure_dependencies.py` this repository is built on top of Adblock Plus
and contains only what is necessary for AdBlock's branding and additional functionality.


## Requirements

This repository has [the same requirements as the Adblock Plus](https://github.com/adblockplus/adblockpluschrome#requirements).


## Usage

### Building the extension

To produce an unsigned build, suitable for uploading to the Chrome Web Store
and Opera Add-Ons, run the following command:

    ./build.py -t chrome build

This will create a build with a name in the form
`adblockforchrome-VERSION.zip`


### Development builds

To simplify the process of testing your changes you can create an unpacked
development environment. For that run one of the following commands:

    ./build.py devenv -t chrome

This will create a `devenv` directory in the repository. In Chrome you should
load it as an unpacked extension directory. After making changes to the
source code re-run the command to update the development environment, the
extension should reload automatically after a few seconds.


### Dependencies

Our dependency management system is called `ensure_dependencies.py`, it's a
small Python script that pulls the project's dependencies and checks out the
correct revisions using source control. (Mercurial and Git are supported.)

The project's dependencies are specified in the `dependencies` file, the format
is [briefly documented in the script's source code](https://github.com/adblockplus/buildtools/blob/master/ensure_dependencies.py#L22-L35)
and in the [original Trac issue](https://issues.adblockplus.org/ticket/170).

The build script `./build.py` automatically triggers the dependencies script
but if you need to run it manually for some reason you can do so like this:

    ./ensure_dependencies.py

Finally it's important to note that although the `ensure_dependencies.py` script
is present in this repository, it should not be modified here directly. Instead
modifications should be made to the script in the `buildtools` repository, the
copy here can then be updated from there.

## Overrides and customization

In order to customize AdBlock, we've aliased some of ABP's core JS files.  All of
these aliased files can be found in the
[alias](https://github.com/betafish-inc/adblock-next-gen/tree/master/adblock-betafish/alias)
folder.
When updating the [dependencies](https://github.com/betafish-inc/adblock-next-gen/blob/master/dependencies)
file to upgrade to a new version of ABP, be sure to review and update the
corresponding files in the `alias` folder.

Also, we've overridden some of the features and functions of the ABP build process in the
[build.py](https://github.com/betafish-inc/adblock-next-gen/blob/master/build.py) file.
The overriden functions should also be reviewed when updating to a new version of the build tool.


## Code Style

We use a standard code style enforced by [eslint](https://eslint.org) for JavaScript and [Prettier](https://prettier.io) for HTML, CSS and JSON. To use these tools, install [Node.js](https://nodejs.org) and run the following command in the project directory:

```bash
npm install
```

Specifically, the standard JavaScript code style we've adopted is the [Airbnb JavaScript style guide](https://github.com/airbnb/javascript/blob/master/README.md)

The following npm commands are then available:

* `npm run lint` runs eslint and prints out all JavaScript violations.
* `npm run lint-fix` runs eslint and automatically fixes JavaScript style violations in place (be sure to commit before running this command in case you need to revert the changes eslint makes).
* `npm run prettier` runs prettier on HTML, CSS, and JSON files in the adblock-betafish directory and list all files that need to be Prettier.
* `npm run prettier-fix` runs prettier and automatically replaces with Prettier versions for HTML, CSS, and JSON files in the adblock-betafish directory.

## Development

This repository leverages the existing Adblock Plus code. You should therefore
make improvements to Adblock Plus and other dependencies instead where possible.
When not possible you can add functionality by modifying the AdBlock specific
meta data files and JavaScript code found in this repository.

### Metadata

The metadata files, for example `metadata.chrome`, are used by the build system
to configure and build the extension. Each metadata file consists of sections,
under which there are a series of keys and values. Some metadata files are
specific to the various platforms, like Chrome or Safari. Other metadata files
are used for all platforms.

The metadata files in this repository inherit from the ones contained within
the `adblockpluschrome` and `adblockplus` dependencies.

 - Options specified in this repository's metadata files will take precedence
   over options specified in the `adblockplus` and `adblockpluschrome` metadata
   files.
 - The values of options are always strings, however they sometimes are used
   as space delimited lists. For those cases you can add or remove items with
   the special `+=` and `-=` syntax. (You can also use this syntax to append
   items to inherited values. For example to append the path of an additional
   background script specific to AdBlock to a list that was inherited from the
   Adblock Plus metadata files.)

_Note: For changes to metadata files to take effect (as with changes to any
other files) a new build must first be generated._

### Extending functionality

To extend this extension's functionality you can add additional content
and background scripts using the metadata files mentioned above. Relevant
metadata sections to modify include `general.backgroundScripts`,
`contentScripts.document_start`, `contentScripts.document_end` and `mapping`.

Example content and background scripts have already been added, `content.js`
and `background.js` respectively, using `metadata.adblock`. For an example of
more advanced usage I recommend taking a look at
`adblockpluschrome/metadata.common`.

### Adding to manifest.json

There is now the ability to add any key/value pairs to the manifest.json file by
adding them to the [manifest] section of the metadata.adblock file. The
following rules apply:
        * An option's key may be declared as a series of nested dictionary keys,
          seperated by '.'.
        * Declaring an option's value in a new line (even if only one is given)
          will define the option's value as a list.
        * When an option's value is defined as a list, no other nested
          objects may follow.
        * A list is expandable by the ConfigParser's '+=' token (Note: A
          previously declared string will be converted into a list).
        * Values may be marked as `number` or `bool` by prefixing them
          accordingly (this also applies to values in a list):
          * bool:<value>
          * number:<value>

        Example:
                                    {
        foo = foo                     "foo": "foo",
        asd =                         "asd": ["asd"],
          asd                         "bar": {
        bar.baz = a                     "baz": ["a", "c", "d"]
        baz.foo = a                   },
        baz.z =                       "baz": {
          bar                           "foo": "a",
          bool:true             ===>    "z": ["bar", true]
        bar.baz +=                    },
          c                           "bad": true,
          d                           "good": false,
        bad = bool:true               "is": {
        good = bool:false               "integer": 1,
        is.integer = number:1           "float": 1.4
        is.float = number:1.4         }
                                    }

## Developer Guide

General guidelines for developing AdBlock specific code.

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
