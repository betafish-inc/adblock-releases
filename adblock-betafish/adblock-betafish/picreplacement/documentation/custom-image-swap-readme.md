# Sync technical implementation

The following document will provide a technical overview of the implementation of the Custom Image Swap feature within AdBlock (next_gen_repo).

Introduction

The Custom Image Swap feature allows premium / paid users to import or copy images into AdBlock that will be used during the Image Swap processing.

The functionality below is on the Image Swap tab of the AdBlock Options page.

Currently, AdBlock supports the three most popular sizes of ads replaced.

AdBlock allows 9 images to be stored within the extension.

Image Import or Copy function.
The following describes the technical details of how an image is imported into AdBlock on the Image Swap tab of the AdBlock Options page.

AdBlock uses the FileReader API (https://developer.mozilla.org/en-US/docs/Web/API/FileReader) to read the binary contents of the image file the user selects.

The image file's binary data is converted to a Blob to better meet Mozilla's guidelines for security.  See the `<scheme-source>` section on this page https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/img-src#Syntax
for more information.

The Blob data is loaded into a hidden image on the AdBlock options page.

A 'Croppie' is then created which creates a UI for the user to crop and perform some minor editing (scroll and zoom) of the image they selected.

The Croppie tool uses the hidden image above as the source for its UI.

When the user clicks the done button on the modal, a base64 encoded String is created of the image.  The original image file is not modified.

The base64 string is then saved by the CustomChannel background script.

If the base64 string was successfully saved, then a modal image import box is closed, and a thumbnail of the recently imported image is shown.

The CustomChannel background script is responsible for saving the base64 string to storage, and updating its metadata about the custom images.

The CustomChannel stores each image file individually (along with some image metadata) with a unique key (the number of milliseconds since the Unix Epoch).

The CustomChannel also stores an array containing image meta data for each image.  The separate data structure does not contain the base64 string of the image.  This data is primarily used by the Channel to randomly select an appropriately sized custom image during the ad swap / replacement process.

The extension storage API (browser.storage.local) is used because
  1) Both content scripts and background scripts have access to the data, and can use the same APIs. This allows AdBlock to pass the storage key of the randomly selected stored image to the picreplacement content script, avoiding the overview of passing a large base64 string to the content script via message passing.
  2) AdBlock currently has 'unlimited' storage in this location via the unlimited storage permission. As noted above, we are restricting the number of images that can be imported to 9.

# Current Custom Channel data storage structure

Each saved / imported image will be saved with the following structure:
  'key' : {
    "name": String - the filename from the file the user selected
    "width": Integer - the width of the image
    "height": Integer - the height of the image
    "src": String (base64 encoded) of the image
  }

The array containing image meta data.  This array is used to populate the 'listing' array each channel has.
'customMetaData': [
  {
    "name": String - the filename from the file the user selected
    "width": Integer - the width of the image
    "height": Integer - the height of the image
    "url": the 'key' of the related image file
  },
  ...
]

Sync considerations:
Custom images will not be sync'd

# Testing hints:

Test that existing settings are retained for current Premium Image Swap users

Test new premium users will still need to enable this Image Swap feature

Test all image file formats ('svg', 'tiff', 'png', 'webp', 'jpeg', 'bmp', 'gif')

For images that contain EXIF data, such as jpegs from mobile phones and cameras, test that the browser ignores the rotation information stored in the image file.

Test the import of large image files

Test in older versions of the browsers (the minimum supported version if possible).

Test the custom images are displayed correctly on the Image Swap page, on tabs / pages where they are used for ad replacement, and on the view image details page

Sync should continue to work with previous versions of AdBlock that do not have this feature.  For example, if a user enables the custom image swap, and only custom image, and has sync enabled, the old version of AdBlock should gracefully handle the setting, and return it when a user makes an update on it.

To test the error handling on the "Image Swap" page, run the following code snippet on the _**background**_ page of the extension:

```
let customChannel = channels.channelGuide[channels.getIdByName('CustomChannel')].channel;
customChannel.addCustomImage = function() {
  return new Promise((resolve, reject) => {
    reject("test error");
  });
};
```

Then attempt to add a custom image.  Once the 'Done' button is clicked on the modal, an error will be returned, and the error message dialog box should be shown.

Reload the extension to reset and remove the test code.

