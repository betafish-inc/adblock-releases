/** @module adblock-betafish/alias/subscriptionInit */

/** similar to adblockpluschrome\lib\subscriptionInit.js */

'use strict'

/** @module subscriptionInit */

import {
  Subscription,
  DownloadableSubscription,
  SpecialSubscription,
} from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/subscriptionClasses.js'
import { filterStorage } from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/filterStorage.js'
import { filterEngine } from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/filterEngine.js'
import { recommendations } from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/recommendations.js'
import { notifications } from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/notifications.js'
import { synchronizer } from '../../adblockplusui/adblockpluschrome/adblockpluscore/lib/synchronizer.js'
import * as info from 'info'
import { port } from 'messaging.js'
import { Prefs } from 'prefs.js'
import { initNotifications } from './notificationHelper.js'

let firstRun
let subscriptionsCallback = null
let userNotificationCallback = null
let reinitialized = false
let dataCorrupted = false

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
function detectFirstRun() {
  return new Promise((resolve) => {
    firstRun = filterStorage.getSubscriptionCount() == 0

    if (firstRun && (!filterStorage.firstRun || Prefs.currentVersion)) {
      reinitialized = true
    }
    Prefs.currentVersion = info.addonVersion

    browser.storage.local.get(null).then((currentData) => {
      const edgeMigrationNeeded = currentData.filter_lists
      if (edgeMigrationNeeded && firstRun) {
        firstRun = false
      }
      resolve()
    })
  })
}

/**
 * In case of data corruption, we don't want to show users
 * any non-essential notifications so we need to instruct
 * the notification manager to ignore them.
 *
 * @param {boolean} value
 */
function setDataCorrupted(value) {
  dataCorrupted = value
  notifications.ignored = value
}

/**
 * Determines whether to add the default ad blocking subscriptions.
 * Returns true, if there are no filter subscriptions besides those
 * other subscriptions added automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there
 * is no data and therefore no subscriptions. But it also causes the
 * default ad blocking subscriptions to be added again after some
 * data corruption or misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscriptions() {
  for (let subscription of filterStorage.subscriptions()) {
    if (
      subscription instanceof DownloadableSubscription &&
      subscription.url != Prefs.subscriptions_exceptionsurl &&
      subscription.type != 'circumvention'
    )
      return false

    if (
      subscription instanceof SpecialSubscription &&
      subscription.filterCount > 0
    )
      return false
  }

  return true
}

/**
 * Finds the default filter subscriptions.
 *
 * Returns an array that includes one subscription of the type "ads" for the
 * current UI language, and any subscriptions of the type "circumvention".
 *
 * @param {Array.<object>} subscriptions
 * @return {Array.<object>}
 */
export function chooseFilterSubscriptions(subscriptions) {
  let currentLang = browser.i18n.getUILanguage().split('-')[0]
  let defaultLang = browser.runtime.getManifest().default_locale.split('_')[0]

  let adSubscriptions = []
  let adSubscriptionsDefaultLang = []
  let chosenSubscriptions = []

  for (let subscription of subscriptions) {
    switch (subscription.type) {
      case 'ads':
        if (subscription.languages.includes(currentLang))
          adSubscriptions.push(subscription)
        if (subscription.languages.includes(defaultLang))
          adSubscriptionsDefaultLang.push(subscription)
        break

      case 'circumvention':
        chosenSubscriptions.push(subscription)
        break
    }
  }

  if (
    adSubscriptions.length > 0 ||
    (adSubscriptions = adSubscriptionsDefaultLang).length > 0
  ) {
    let randomIndex = Math.floor(Math.random() * adSubscriptions.length)
    chosenSubscriptions.unshift(adSubscriptions[randomIndex])
  }

  return chosenSubscriptions
}

/**
 * Gets the filter subscriptions to be added when the extnesion is loaded.
 *
 * @return {Promise|Subscription[]}
 */
function getSubscriptions() {
  let subscriptions = []

  // Add pre-configured subscriptions
  for (let url of Prefs.additional_subscriptions)
    subscriptions.push(Subscription.fromURL(url))

  // Add "acceptable ads", "AdBlock Custom", and "BitCoing Mining Protection List" subscriptions
  if (firstRun) {
    if (info.platform !== 'gecko') {
      let acceptableAdsSubscription = Subscription.fromURL(
        Prefs.subscriptions_exceptionsurl
      )
      acceptableAdsSubscription.title = 'Allow non-intrusive advertising'
      subscriptions.push(acceptableAdsSubscription)
    }

    let abcSubscription = Subscription.fromURL(
      'https://cdn.adblockcdn.com/filters/adblock_custom.txt'
    )
    abcSubscription.title = 'AdBlock custom filters'
    subscriptions.push(abcSubscription)

    let cplSubscription = Subscription.fromURL(
      'https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt'
    )
    cplSubscription.title = 'Cryptocurrency (Bitcoin) Mining Protection List'
    subscriptions.push(cplSubscription)
  }

  // Add default ad blocking subscriptions (e.g. EasyList, Anti-Circumvention)
  let addDefaultSubscription = shouldAddDefaultSubscriptions()
  if (addDefaultSubscription || !Prefs.subscriptions_addedanticv) {
    for (let { url, type, title, homepage } of chooseFilterSubscriptions(
      recommendations()
    )) {
      // Make sure that we don't add Easylist again if we want
      // to just add the Anti-Circumvention subscription.
      if (!addDefaultSubscription && type != 'circumvention') continue

      let subscription = Subscription.fromURL(url)
      subscription.disabled = false
      subscription.title = title
      subscription.homepage = homepage
      subscriptions.push(subscription)

      if (subscription.type == 'circumvention')
        Prefs.subscriptions_addedanticv = true
    }

    return subscriptions
  }

  return subscriptions
}

function removeSubscriptions() {
  return new Promise(function (resolve, reject) {
    if ('managed' in browser.storage) {
      browser.storage.managed.get(null).then(
        (items) => {
          for (let key in items) {
            if (
              key === 'remove_subscriptions' &&
              Array.isArray(items[key]) &&
              items[key].length
            ) {
              for (let inx = 0; inx < items[key].length; inx++) {
                let subscription = Subscription.fromURL(items[key][inx])
                filterStorage.removeSubscription(subscription)
              }
            }
          }
          resolve()
        },

        // Opera doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {
          resolve()
        }
      )
    } else {
      resolve()
    }
  })
}

function openInstalled() {
  STATS.untilLoaded(function (userID) {
    browser.tabs.create({
      url:
        'https://getadblock.com/installed/?u=' +
        userID +
        '&lg=' +
        browser.i18n.getUILanguage() +
        '&dc=' +
        dataCorrupted,
    })
  })
}

function addSubscriptionsAndNotifyUser(subscriptions) {
  if (subscriptionsCallback)
    subscriptions = subscriptionsCallback(subscriptions)

  for (let subscription of subscriptions) {
    filterStorage.addSubscription(subscription)
    if (
      subscription instanceof DownloadableSubscription &&
      !subscription.lastDownload
    )
      synchronizer.execute(subscription)
  }

  // Show first run page or the updates page. The latter is only shown
  // on Chromium (since the current updates page announces features that
  // aren't new to Firefox users), and only if this version of the
  // updates page hasn't been shown yet.
  if (firstRun && !Prefs.suppress_first_run_page) {
    // Always show the first run page if a data corruption was detected
    // (either through failure of reading from or writing to storage.local).
    // The first run page notifies the user about the data corruption.
    let url
    if (firstRun || dataCorrupted) {
      // see if the there's a tab to the Premium Sunset page, if so, don't open /installed
      browser.tabs.query({ currentWindow: true }).then((tabs) => {
        if (!tabs || tabs.length === 0) {
          openInstalled()
          return
        }
        const updateFreeURL = 'https://getadblockpremium.com/sunset/free/?'
        const updatePaidURL = 'https://getadblockpremium.com/sunset/paid/?'
        const sunsetFreePageFound = tabs.some((tab) => {
          return tab && tab.url && tab.url.startsWith(updateFreeURL)
        })
        const sunsetPaidPageFound = tabs.some((tab) => {
          return tab && tab.url && tab.url.startsWith(updatePaidURL)
        })
        if (!sunsetFreePageFound && !sunsetPaidPageFound) {
          openInstalled()
        }
      })
    }
  }

  if (userNotificationCallback)
    userNotificationCallback({ dataCorrupted, firstRun, reinitialized })
}

/**
 * We need to check whether we can safely write to/read from storage
 * before we start relying on it for storing preferences.
 */
async function testStorage() {
  let testKey = 'readwrite_test'
  let testValue = Math.random()

  try {
    await browser.storage.local.set({ [testKey]: testValue })
    let result = await browser.storage.local.get(testKey)
    if (result[testKey] != testValue)
      throw new Error('Storage test: Failed to read and write value')
  } finally {
    await browser.storage.local.remove(testKey)
  }
}

;(async () => {
  await Promise.all([
    filterEngine.initialize().then(() => synchronizer.start()),
    Prefs.untilLoaded.catch(() => {
      setDataCorrupted(true)
    }),
    testStorage().catch(() => {
      setDataCorrupted(true)
    }),
  ])
  await detectFirstRun()
  let subscriptions = await getSubscriptions()
  addSubscriptionsAndNotifyUser(subscriptions)
  await removeSubscriptions()
  // We have to require the "uninstall" module on demand,
  // as the "uninstall" module in turn requires this module.
  ;(await import('./uninstall.js')).setUninstallURL()
  initNotifications(firstRun)
})()

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
export function isDataCorrupted() {
  return dataCorrupted
}

/**
 * Sets a callback that is called with an array of subscriptions to be added
 * during initialization. The callback must return an array of subscriptions
 * that will effectively be added.
 *
 * @param {function} callback
 */
export function setSubscriptionsCallback(callback) {
  subscriptionsCallback = callback
}

/**
 * Sets a callback that is called with environment information after
 * initialization to notify users.
 *
 * @param {function} callback
 */
export function setNotifyUserCallback(callback) {
  userNotificationCallback = callback
}

/**
 * @typedef {object} subscriptionsGetInitIssuesResult
 * @property {boolean} dataCorrupted
 *   true if it appears that the user's extension data was corrupted.
 * @property {boolean} reinitialized
 *   true if we have reset the user's settings due to data corruption.
 */

/**
 * Returns an Object with boolean flags for any subscription initialization
 * issues.
 *
 * @event "subscriptions.getInitIssues"
 * @returns {subscriptionsGetInitIssuesResult}
 */
port.on('subscriptions.getInitIssues', (message, sender) => ({
  dataCorrupted,
  reinitialized,
}))
