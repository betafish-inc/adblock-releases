'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global exports, log, registerDependencies, setDebug, debug */

function querySelector(selct) {
  return document.querySelector(selct);
}

function evalXPath(xpression) {
  return document
    .evaluate(xpression, document, null, XPathResult.ANY_TYPE, null)
    .iterateNext();
}

/**
 * If the click function is defined on an element,
 *   then this function will then call the click function on that element
 * If the click function is NOT defined on an element,
 *   then this function will create a new 'click' event on that element
 *
 * @param {HTML Element} elem the element that should be 'clicked'.
 * @param {Integer} delayTime how long to wait in milliseconds before clicking the element.
 */
function clickElement(elem, delayTime) {
  setTimeout(() => {
    if (elem) {
      if (elem.click) {
        elem.click();
      } else {
        elem.dispatchEvent(new Event('click', { bubbles: true }));
      }
    }
  }, delayTime);
}


/**
 * Checks if any of the rules in the parsedArgs that
 *  - have the 'click' option set to true,
 *  - also have the 'clicked' option set to true
 *
 * @param {array of objects} parsedArgs The parsed rules.
 */
function areAllElementsClicked(parsedArgs) {
  const debugLog = (debug ? log : () => { }).bind(null, 'areAllElementsClicked');
  let allElementsClicked = true;
  for (const arg of parsedArgs) {
    if (arg.click) {
      allElementsClicked = allElementsClicked && arg.clicked;
    }
  }
  debugLog(allElementsClicked);
  return allElementsClicked;
}

/**
 * Checks if all of the HTML elements in the input array are in the DOM
 * If so, then it will click any of the elements in the array that need to be clicked
 *
 * Will return 'true', when all of the elements that are to be clicked ('click' attribute is true)
 * have been clicked ('clicked' attribute is true)
 *
 * @param {array of objects} parsedArgs The selector string to look for an HTML.
 * @param {Integer} delayTimeArg Optional The amount of time in milliseconds to wait
 * before clicking the found element
 *
 */
function clickElemsIfNecessary(parsedArgs, delayTime = 0) {
  let elemsExists = true;
  for (const arg of parsedArgs) {
    let elem;
    if (!arg.found) {
      if (arg.xpath) {
        elem = evalXPath(arg.selector);
      } else if (!arg.xpath) {
        elem = querySelector(arg.selector);
      }
      if (!elem) {
        elemsExists = false;
      } else {
        arg.found = true;
      }
    }
    if (elemsExists && arg.click && !arg.clicked) {
      arg.clicked = true;
      clickElement(elem, delayTime);
    }
  }
  return areAllElementsClicked(parsedArgs);
}

/**
 * Checks if any of the rules in the parsedArgs have the 'continue' option set to true
 *
 * @param {array of objects} parsedArgs The parsed rules.
 */
function shouldContinueMO(parsedArgs) {
  let isContinueSet = false;
  for (const arg of parsedArgs) {
    isContinueSet = isContinueSet || arg.continue;
  }
  return isContinueSet;
}

/**
 * Resets the following attributes:
 *  - 'clicked'
 *  - 'found'
 * in the input array
 *
 * @param {array of objects} parsedArgs The parsed rules.
 */
function resetAttributes(parsedArgs) {
  for (const arg of parsedArgs) {
    arg.clicked = false;
    arg.found = false;
  }
}

/**
 * Creates a MutationObserver on the document
 * When the DOM is mutated, and one of the elements is found,
 * then mutation observer is disconnect.
 *
 * The following parameters are not used in the function, but passed
 * through to other functions
 *
 * @param {array of objects} parsedArgs The selector string to look for an HTML.
 * @param {Integer} delayTimeArg Optional The amount of time in milliseconds to wait
 * before clicking the found element
 *
 */
function createMO(parsedArgs, delayTimeArg) {
  const debugLog = (debug ? log : () => { }).bind(null, 'createMO');
  let observer;
  const callback = () => {
    if (clickElemsIfNecessary(parsedArgs, delayTimeArg)) {
      debugLog('element(s) clicked');
      observer.disconnect();
      if (shouldContinueMO(parsedArgs)) {
        resetAttributes(parsedArgs);
        setTimeout(() => {
          debugLog('re-connectting observer');
          observer.observe(document, { attributes: true, childList: true, subtree: true });
        }, (delayTimeArg + 1));
      }
    }
  };
  observer = new MutationObserver(callback);
  observer.observe(document, { attributes: true, childList: true, subtree: true });
}

/**
 * parses a String parameter into an object in the following format:
 *   'selector$xpath,continue,click'
 *
 * The '$' denotes a delimiter between the selector in the options
 * The 'selector' can either be a CSS selector or an XPath expression.
 * A CSS selector is the default for the selector
 * The options are:
 *    'xpath' indicates that the selector is an XPath expression
 *    'continue' indicates that the mutation observer shouldn't be disconnect
 *               when the element is clicked
 *    'click' indicates that the element should be clicked
 *
 * The function will return an object with the following attributes:
    selector: {String} The CSS selector string or XPath expression.
    xpath: {Boolean} an indicator if the 'selector' is XPath expression.
    continue:  {Boolean} an indicator if the 'continue' option was set on the input String parameter
    click:  {Boolean} an indicator if the 'click' option was set on the input String parameter
    clicked:  {Boolean} an indicator if the 'click' option is set, and the element has been clicked
    found:  {Boolean} an indicator if the related HTML Element was found in the DOM
 *
 * @param {String} theRule The selector string to look for an HTML.
 */
function parseArg(theRule) {
  if (!theRule) {
    return null;
  }
  const result = {
    selector: '',
    xpath: false,
    continue: false,
    click: false,
    clicked: false,
    found: false,
  };
  const textArr = theRule.split('$');
  let options = [];
  if (textArr.length >= 2) {
    options = textArr[1].toLowerCase().split(',');
  }
  [result.selector] = textArr;
  for (const option of options) {
    if (option === 'click') {
      result.click = true;
    } else if (option === 'xpath') {
      result.xpath = true;
    } else if (option === 'continue') {
      result.continue = true;
    }
  }
  return result;
}

/**
 * Clicks the element(s) in the document
 * If all of the element(s) are found, then the last element in the arguments will be clicked -
 * Unless the 'click' option is set on other arguments (see below for options)
 *
 * each argument should have the following format:
 *   'selector$xpath,continue,click'
 *
 * The 'selector' can either be a CSS selector or an XPath expression.
 * The '$' denotes a delimiter between the selector in the options
 * A CSS selector is the default for the selector
 * The options are:
 *    'xpath' indicates that the selector is an XPath expression
 *    'continue' indicates that the mutation observer shouldn't be disconnectted
 *               when the element is clicked
 *    'click' indicates that the element should be clicked when found in the DOM
 *            Note - the 'click' option is not needed on last argument, it will always be clicked
 *
 * @param {Array of string} args The rule string.
 */

function specificClicker(...args) {
  const debugLog = (debug ? log : () => { }).bind(null, 'specificClicker');
  const delayTime = 100;
  const MAX_ARGS = 7;
  debugLog(args);
  let parsedArgs = [];
  for (const arg of args) {
    const result = parseArg(arg);
    if (result) {
      parsedArgs.push(result);
    }
  }

  if (parsedArgs.length > MAX_ARGS) { // Truncate any parameters after
    parsedArgs = parsedArgs.slice(0, MAX_ARGS);
  }
  const [last] = parsedArgs.slice(-1);
  last.click = true;

  debugLog(parsedArgs);

  if (document.readyState === 'complete' && clickElemsIfNecessary(parsedArgs, delayTime)) {
    debugLog('element clicked, returning');
  } else {
    debugLog('creating MO');
    createMO(parsedArgs, delayTime);
  }
}
registerDependencies(specificClicker, log, parseArg, createMO, clickElemsIfNecessary,
  shouldContinueMO, clickElement, resetAttributes, areAllElementsClicked);
exports.specificClicker = specificClicker;
