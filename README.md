# Adblock

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

Safari builds however alwyays need to be signed:

    ./build.py -t safari build -k key.pem

Note: `key.pem` should contain the private key for your developer certificate,
the developer certificate itself as well as all the certificates it
was signed with (Apple's root certificate and intermediate certificates)
in PEM format - in hat order.

This will create a build with a name in the form
`adblockforchrome-VERSION.zip` or `adblockforsafari-VERSION.safariextz`.


### Development builds

To simplify the process of testing your changes you can create an unpacked
development environment. For that run one of the following commands:

    ./build.py -t chrome devenv
    ./build.py -t safari devenv

This will create a `devenv` directory in the repository. In Chrome you should
load it as an unpacked extension directory. After making changes to the
source code re-run the command to update the development environment, the
extension should reload automatically after a few seconds.

In Safari you should load `devenv/adblockforsafari.safariextension` as unpacked
extension directory. After making changes to the source code re-run the command
to update the development environment. You will still need to reload the
extension explicitly in the Extension Builder, Safari currently doesn't allow
automating this action.


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


### Unit tests

To run the unit test suite browse to the extension's Options page, open the
JavaScript Console and type in:

    location.href = "qunit/index.html";

The unit tests will run automatically once the page loads. The Adblock Plus unit
tests will be run first, followed by any AdBlock tests.

To add additional AdBlock specific unit tests to the test suite you can use the
`general.testScripts` metadata option. (You will likely have to add a path
mapping as well.)

Tests are run using the [QUnit](http://qunitjs.com/) library, so should be
written using the provided API.

To run any new tests that you have added you will need to re-build the extension
and then follow the above instructions for running the test suite.

An example test has been added in the `tests/example.js` file. It demonstrates
how tests can be included using our build system. A mapping has been added for
it to `metadata.adblock` and it's path appended to the `testScripts` option.
