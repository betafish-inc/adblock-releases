function getAvailableFiles() {
return {
jquery: {
"jquery-1.10.2.min.js": 93108,
"jquery-1.11.0.min.js": 96382,
"jquery-1.11.1.min.js": 95787,
"jquery-1.11.2.min.js": 95932,
"jquery-1.11.3.min.js": 95958,
"jquery-1.12.4.min.js": 97164,
"jquery-1.3.2.min.js": 57255,
"jquery-1.4.2.min.js": 72175,
"jquery-1.7.1.min.js": 93869,
"jquery-1.7.2.min.js": 94841,
"jquery-1.8.2.min.js": 93436,
"jquery-1.8.3.min.js": 93637,
"jquery-1.9.1.min.js": 92630,
"jquery-2.1.1.min.js": 84246,
"jquery-2.1.3.min.js": 84321,
"jquery-2.1.4.min.js": 84346,
"jquery-2.2.4.min.js": 85579,
"jquery-3.1.1.min.js": 86710,
"jquery-3.2.1.min.js": 86660,
},
};
}
 
// Attach methods to window
Object.assign(window, {
  getAvailableFiles
});
const {LocalCDN} = require('./localcdn');
LocalCDN.setUp();
 
