/** @module adblock-betafish/alias/recommendations */

/*
 * Same as the original source adblockpluschrome\adblockpluscore\lib
 * except:
 * - added AdBlock specific filter lists
 * - added language, id & hidden attribute
 */

/** @module */

'use strict'

/**
 * A `Recommendation` object represents a recommended filter subscription.
 */
class Recommendation {
  /**
   * Creates a `Recommendation` object from the given source object.
   * @param {object} source The source object.
   * @private
   */
  constructor(source) {
    this._source = source
  }

  /**
   * The type of the recommended filter subscription.
   * @type {string}
   */
  get type() {
    return this._source.type
  }

  /**
   * The languages of the recommended filter subscription.
   * @type {Array.<string>}
   */
  get languages() {
    return this._source.languages ? [...this._source.languages] : []
  }

  /**
   * The language indicator of the recommended filter subscription.
   * @type {boolean}
   */
  get language() {
    return (
      this._source.language ||
      (this._source.languages && this._source.languages.length > 0) ||
      false
    )
  }

  /**
   * The title of the recommended filter subscription.
   * @type {string}
   */
  get title() {
    return this._source.title
  }

  /**
   * The URL of the recommended filter subscription.
   * @type {string}
   */
  get url() {
    return this._source.url
  }

  /**
   * The home page of the recommended filter subscription.
   * @type {string}
   */
  get homepage() {
    return this._source.homepage
  }

  /**
   * The id of the recommended filter subscription.
   * @type {string}
   */
  get id() {
    return this._source.id
  }

  /**
   * The hidden indicator of the recommended filter subscription.
   * @type {boolean}
   */
  get hidden() {
    return this._source.hidden || false
  }
}

/**
 * Yields <code>{@link Recommendation}</code> objects representing recommended
 * filter subscriptions.
 *
 * @yields {Recommendation} An object representing a recommended filter
 *   subscription.
 */
exports.recommendations = function* recommendations() {
  for (let source of require('../data/betafish-subscriptions.json'))
    yield new Recommendation(source)
}
