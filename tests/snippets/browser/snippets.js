
/* global chai, it, describe, before, require */
/* eslint no-new-func: "off" */

'use strict';

const { runSnippetScript } = require("../utils/common.js");

const { assert } = chai;

describe('Snippets', function () {
  const timeout = ms => new Promise($ => setTimeout($, ms));

  before('create a user session', () => {
    // reset / clean up the Body
    document.body.innerHTML = `
    <script>
    </script>
    <div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling" class="outside">
        <div id="tohide">to hide \ud83d\ude42!</div>
        <div id="sibling11" class="middle">
          <div id="sibling111" class="close">
          </div>
        </div>
      </div>
      <div id="sibling2">
        <div id="sibling21">
            <div id="sibling211" class="inside">Ad*</div>
        </div>
      </div>
      <div id="sibling3">
        <div id="sibling31">
            <div id="sibling311" class="inside">Ad*</div>
        </div>
      </div>
      <div id="sibling4">
        <div id="sibling41">
            <div id="sibling411" class="inside">Ad*</div>
        </div>
      </div>
      <div id="sibling5">
        <div id="sibling51">
            <div id="sibling511" class="inside">0</div>
        </div>
      </div>
    </div>
    `;

    const jsCode = `
      let sibling111Elem = document.getElementById("sibling111");
      let sibling111ElemClickHandler = function(event) {
        sibling111Elem.style.display = 'none';
        console.log('sibling111 clicked');
      };

      let sibling211Elem = document.getElementById("sibling211");
      let sibling211ElemClickHandler = function(event) {
         sibling211Elem.style.display = 'none';
         console.log('sibling211 clicked');
      };

      let sibling311Elem = document.getElementById("sibling311");
      let sibling311ElemClickHandler = function(event) {
        console.log('sibling311Elem clicked');
        sibling311Elem.style.display = 'none';
      };

      let sibling511Elem = document.getElementById("sibling511");

      function resetClickListeners() {
        sibling111Elem.style.display = 'block';
        sibling111Elem.removeEventListener('click', sibling111ElemClickHandler, true);
        sibling111Elem.addEventListener('click', sibling111ElemClickHandler, true);

        sibling211Elem.style.display = 'block';
        sibling211Elem.removeEventListener('click', sibling211ElemClickHandler);
        sibling211Elem.addEventListener('click', sibling211ElemClickHandler);

        sibling311Elem.style.display = 'block';
        sibling311Elem.removeEventListener('click', sibling311ElemClickHandler);
        sibling311Elem.addEventListener('click', sibling311ElemClickHandler);
      };
    `;
    const scriptElement = document.createElement('script');
    scriptElement.type = 'application/javascript';
    scriptElement.async = false;
    scriptElement.textContent = jsCode;
    document.body.appendChild(scriptElement);
  });

  this.beforeEach('reset the DOM', () => {
    resetClickListeners();
  });

  function expectHidden(element, id) {
    let withId = '';
    if (typeof id !== 'undefined') {
      withId = ` with ID '${id}'`;
    }

    assert.equal(
      window.getComputedStyle(element).display, 'none',
      `The element${withId}'s display property should be set to 'none'`,
    );
  }

  function expectVisible(element, id) {
    let withId = '';
    if (typeof id !== 'undefined') {
      withId = ` with ID '${id}'`;
    }

    assert.notEqual(
      window.getComputedStyle(element).display, 'none',
      `The element${withId}'s display property should not be set to 'none'`,
    );
  }

  it('1 - specificClicker 1 simple id selector', (done) => {
    const element = document.getElementById('sibling211');
    element.style.display = 'block';
    expectVisible(element, 'sibling211');
    
    runSnippetScript('specificClicker #sibling211');

    setTimeout(() => {
      expectHidden(element, 'sibling211');
      done();
    }, 600);  // the test needs to wait at least 500 ms to allow the snippet to click the element

  });

  it('2 - specificClicker 1 complex selector with spaces', (done) => {
    let element = document.querySelector('.outside #sibling11 #sibling111');
    element.style.display = 'block';
    expectVisible(element, 'sibling111');
    runSnippetScript("specificClicker '.outside  #sibling111'");

    setTimeout(() => {
      element = document.querySelector('.outside #sibling11 #sibling111');
      expectHidden(element, '.outside #sibling11 #sibling111');
      done();
    }, 600);  // the test needs to wait at least 500 ms to allow the snippet to click the element    

  });

  it('3 - specificClicker 2 selector with spaces',  (done) => {
    let element = document.querySelector('.outside #sibling11 #sibling111');
    element.style.display = 'block';
    expectVisible(element, '.outside #sibling11 #sibling111');
    element = document.querySelector('div #sibling311');
    element.style.display = 'block';
    expectVisible(element, 'div #sibling311');
    runSnippetScript("specificClicker '.outside #sibling11 #sibling111' 'div #sibling311'");
    setTimeout(() => {
      element = document.querySelector('div #sibling311');
      expectHidden(element, 'div #sibling311');
      done();
    }, 600);  // the test needs to wait at least 500 ms to allow the snippet to click the element     
  });

  it('4 - specificClicker 2 selector with spaces and both elements clicked', (done) => {
    let element = document.querySelector('.outside #sibling11 #sibling111');
    element.style.display = 'block';
    expectVisible(element, '.outside #sibling11 #sibling111');
    element = document.querySelector('div #sibling311');
    element.style.display = 'block';
    expectVisible(element, 'div #sibling311');
    runSnippetScript("specificClicker '.outside #sibling11 #sibling111$click' 'div #sibling311$click'");
    setTimeout(() => {
      element = document.querySelector('.outside #sibling11 #sibling111');
      expectHidden(element, element, '.outside #sibling11 #sibling111');
      element = document.querySelector('div #sibling311');
      expectHidden(element, 'div #sibling311');
      done();
    }, 600);  // the test needs to wait at least 500 ms to allow the snippet to click the element           
  });

  it('5 - specificClicker 1 xpath id selector', (done) => {
    const element = document.getElementById('sibling211');
    element.style.display = 'block';
    expectVisible(element, 'sibling211');
    runSnippetScript("specificClicker '//*[@id=\"sibling211\"]$xpath' ");
    setTimeout(() => {    
      expectHidden(element, 'sibling211');
      done();
    }, 600);  // the test needs to wait at least 500 ms to allow the snippet to click the element           
  });

  it('6 - specificClicker 1 continue id selector', (done) => {
    this.timeout(3000);

    runSnippetScript('specificClicker #sibling611$continue');

    const newDiv1 = document.createElement('div');
    newDiv1.id = 'sibling611';
    newDiv1.classList.add('sibling611');
    newDiv1.innerText = '0';
    const sibling611ElemClickHandler = function () {
      const currentIntValue = parseInt(newDiv1.innerText || 0, 10);
      newDiv1.innerText = currentIntValue + 1;
    };
    newDiv1.addEventListener('click', sibling611ElemClickHandler);
    document.body.appendChild(newDiv1);
    setTimeout(() => {
      const newDiv2 = document.createElement('div');
      newDiv2.id = 'element-b';
      document.body.appendChild(newDiv2);
    }, 600);
    setTimeout(() => {
      let sibling611Elem = document.getElementById("sibling611");
      assert.equal(sibling611Elem.innerText, '2');
      done();
    }, 1200);    
  });
});
