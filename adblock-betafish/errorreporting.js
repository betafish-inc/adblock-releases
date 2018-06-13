// Send the file name and line number of any error message. This will help us
// to trace down any frequent errors we can't confirm ourselves.
window.addEventListener("error", function(e)
{
  if (!e.filename && !e.lineno && !e.colno && !e.error && !e.message) {
    return;
  }
  var str = "Error: " +
           (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
           ":" + (e.lineno||"anywhere") +
           ":" + (e.colno||"anycol");
  if (e.message) {
    str += ": " + e.message;
  }
  var src = e.target.src || e.target.href;
  if (src) {
    str += "src: " + src;
  }
  if (e.error)
  {
      var stack = "-" + (e.error.message ||"") +
                  "-" + (e.error.stack ||"");
      stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
      //only append the stack info if there isn't any URL info in the stack trace
      if (stack.indexOf("http") === -1)
      {
         str += stack;
      }
      //don't send large stack traces
      if (str.length > 1024)
      {
        str = str.substr(0,1023);
      }
  }
  chromeStorageSetHelper("errorkey", "Date added:" + new Date() + " " + str);
  console.log(str);
});