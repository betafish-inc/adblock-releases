
/** @module notificationHelper */

/** original file adblockpluschrome\lib\notificationHelper.js */
/*
 * Same as the original source adblockpluschrome/lib/icon.js
 * except:
 * Most of the logic has been removed to prevent users from seeing notifications
 * Only exported functions remain, which are no-op
 *
 */

"use strict";

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
