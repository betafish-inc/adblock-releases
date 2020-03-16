
/** @module notificationHelper */

/** original file adblockpluschrome\lib\notificationHelper.js */

"use strict";

const {startIconAnimation, stopIconAnimation} = require("../../adblockpluschrome/lib/icon");

/**
 * Initializes the notification system.
 *
 * @param {bool} firstRun
 */
exports.initNotifications = firstRun =>
{

};

let isOptional =
/**
 * If the given notification type is of vital importance return false,
 * true otherwise.
 *
 * @param {string} notificationType
 * @return {boolean}
 */
exports.isOptional = notificationType =>
{
  return true;
};
