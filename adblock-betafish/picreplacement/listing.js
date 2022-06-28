/* For ESLint: List any global identifiers used in this file below */
/* global  */


// Inputs: width:int, height:int, url:url, title:string, attributionUrl:url
class Listing {
  constructor(data) {
    this.width = data.width;
    this.height = data.height;
    this.url = data.url;
    this.title = data.title;
    this.attributionUrl = data.attributionUrl;
    this.channelName = data.channelName;
    if (data.name) {
      this.name = data.name;
    }
    if (data.thumbURL) {
      this.thumbURL = data.thumbURL;
    }
    if (data.userLink) {
      this.userLink = data.userLink;
    }
    if (data.anySize) {
      this.anySize = data.anySize;
    }
    if (data.type) {
      this.type = data.type;
    }
    if (data.ratio) {
      this.ratio = data.ratio;
    }
    if (data.customImage) {
      this.customImage = data.customImage;
    }
  }
}
export default Listing;
