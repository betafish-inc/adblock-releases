/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */
/* For ESLint: List any global identifiers used in this file below */
/* global browser */


/** @module */

/**
 * Registers and emits named events.
 */
/* eslint-disable-next-line no-unused-vars */
class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Adds a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  on(name, listener) {
    const listeners = this.listeners.get(name);
    if (listeners) {
      listeners.push(listener);
    } else {
      this.listeners.set(name, [listener]);
    }
  }

  /**
   * Removes a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  off(name, listener) {
    const listeners = this.listeners.get(name);
    if (listeners) {
      if (listeners.length > 1) {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      } else if (listeners[0] === listener) {
        // We must use strict equality above for compatibility with
        // Array.prototype.indexOf
        this.listeners.delete(name);
      }
    }
  }

  /**
   * Returns a copy of the array of listeners for the specified event.
   *
   * @param {string} name
   *
   * @returns {Array.<function>}
   */
  listeners(name) {
    const listeners = this.listeners.size > 0 ? this.listeners.get(name) : null;
    return listeners ? listeners.slice() : [];
  }

  /**
   * Checks whether there are any listeners for the specified event.
   *
   * @param {string} [name] The name of the event. If omitted, checks whether
   *   there are any listeners for any event.
   *
   * @returns {boolean}
   */
  hasListeners(name) {
    return this.listeners.size > 0
           && (typeof name === 'undefined' || this.listeners.has(name));
  }

  /**
   * Calls all previously added listeners for the given event name.
   *
   * @param {string} name
   * @param {...*}   [args]
   */
  emit(name, ...args) {
    const listeners = this.listeners.size > 0 ? this.listeners.get(name) : null;
    if (listeners) {
      for (const listener of listeners.slice()) {
        listener(...args);
      }
    }
  }
}


/* eslint-disable-next-line no-unused-vars */
function send(command, args) {
  const updatedArgs = Object.assign({}, { command }, args);
  return browser.runtime.sendMessage(updatedArgs);
}

/* eslint-disable-next-line no-unused-vars */
function sendTypeMessage(type, args) {
  const updatedArgs = Object.assign({}, { type }, args);
  return browser.runtime.sendMessage(updatedArgs);
}
