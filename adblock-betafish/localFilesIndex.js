function getAvailableFiles() {
return {
jquery: {
"jquery-1.10.2.min.js": 93107,
"jquery-1.11.0.min.js": 96381,
"jquery-1.11.1.min.js": 95786,
"jquery-1.11.2.min.js": 95931,
"jquery-1.11.3.min.js": 95957,
"jquery-1.12.4.min.js": 97163,
"jquery-1.3.2.min.js": 57254,
"jquery-1.4.2.min.js": 72174,
"jquery-1.7.1.min.js": 93868,
"jquery-1.7.2.min.js": 94840,
"jquery-1.8.2.min.js": 93435,
"jquery-1.8.3.min.js": 93636,
"jquery-1.9.1.min.js": 92629,
"jquery-2.1.1.min.js": 84245,
"jquery-2.1.3.min.js": 84320,
"jquery-2.1.4.min.js": 84345,
"jquery-2.2.4.min.js": 85578,
"jquery-3.1.1.min.js": 86709,
"jquery-3.2.1.min.js": 86659,
},
};
}
 
// Attach methods to window
Object.assign(window, {
  getAvailableFiles
});
const {LocalCDN} = require('./localcdn');
LocalCDN.setUp();
 
