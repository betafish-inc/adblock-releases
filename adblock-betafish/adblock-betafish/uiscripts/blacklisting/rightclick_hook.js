

// Record the last element to be right-clicked, since that information isn't
// passed to the contextmenu click handler that calls top_open_blacklist_ui
// eslint-disable-next-line no-unused-vars
let rightClickedItem = null;

if (document.body) {
  document.body.addEventListener('contextmenu', (e) => {
    rightClickedItem = e.srcElement;
  });
  document.body.addEventListener('click', () => {
    rightClickedItem = null;
  });
}
