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

