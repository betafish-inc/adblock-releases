/**
 * Registers and emits events.
 */
/* eslint-disable-next-line no-unused-vars */
class ListenerSupport {
  constructor() {
    this.listeners = [];
  }

  /**
     * Adds a listener.
     *
     * @param {function} listener
     */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
     * Removes a listener
     *
     * @param {function} listener
     */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
     * Calls all previously added listeners with the provided data.
     *
     * @param {...*}   [args]
     */
  emit(...args) {
    this.listeners.forEach(listener => listener(...args));
  }
}
