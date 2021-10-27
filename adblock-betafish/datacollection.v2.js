'use strict'

/* For ESLint: List any global identifiers used in this file below */
/* global browser, ext, chromeStorageSetHelper, getSettings, adblockIsPaused,
   adblockIsDomainPaused, filterStorage, Filter, parseUri, settings, getAllSubscriptionsMinusText,
   getUserFilters, setSetting */

const { extractHostFromFrame } = require('url')
const { ElemHideFilter } = require('filterClasses')
const { filterNotifier } = require('filterNotifier')
const { port } = require('messaging')
const info = require('info')
const { postFilterStatsToLogServer } =
  require('./servermessages').ServerMessages
const { idleHandler } = require('./idlehandler.js')

const DataCollectionV2 = (function getDataCollectionV2() {
  const HOUR_IN_MS = 1000 * 60 * 60
  const TIME_LAST_PUSH_KEY = 'timeLastPush'

  // Setup memory cache
  let dataCollectionCache = {}
  dataCollectionCache.filters = {}
  dataCollectionCache.domains = {}

  const handleTabUpdated = function (tabId, changeInfo, tabInfo) {
    if (browser.runtime.lastError) {
      return
    }
    if (!tabInfo || !tabInfo.url || !tabInfo.url.startsWith('http')) {
      return
    }
    if (
      getSettings().data_collection_v2 &&
      !adblockIsPaused() &&
      !adblockIsDomainPaused({ url: tabInfo.url, id: tabId }) &&
      changeInfo.status === 'complete'
    ) {
      browser.tabs
        .sendMessage(tabId, { command: 'ping_dc_content_script' })
        .then((pingResponse) => {
          if (pingResponse && pingResponse.status === 'yes') {
            return
          }
          browser.tabs.executeScript(tabId, {
            file: 'adblock-datacollection-contentscript.js',
            allFrames: true,
          })
        })
    }
  }

  const addFilterToCache = function (filter, page) {
    const validFilterText =
      filter && filter.text && typeof filter.text === 'string'
    if (validFilterText && page && page.url) {
      let domain = page.url.hostname
      if (!domain) {
        domain = new URL(page.url).hostname
        if (!domain) {
          return
        }
      }
      const { text } = filter

      if (!(text in dataCollectionCache.filters)) {
        dataCollectionCache.filters[text] = {}
        dataCollectionCache.filters[text].firstParty = {}
        dataCollectionCache.filters[text].thirdParty = {}
        dataCollectionCache.filters[text].subscriptions = []
      }
      if (filter.thirdParty) {
        if (!dataCollectionCache.filters[text].thirdParty[domain]) {
          dataCollectionCache.filters[text].thirdParty[domain] = {}
          dataCollectionCache.filters[text].thirdParty[domain].hits = 0
        }
        dataCollectionCache.filters[text].thirdParty[domain].hits += 1
      } else {
        if (!dataCollectionCache.filters[text].firstParty[domain]) {
          dataCollectionCache.filters[text].firstParty[domain] = {}
          dataCollectionCache.filters[text].firstParty[domain].hits = 0
        }
        dataCollectionCache.filters[text].firstParty[domain].hits += 1
      }
      for (const sub of filterStorage.subscriptions(text)) {
        const dataCollectionSubscriptions =
          dataCollectionCache.filters[text].subscriptions
        if (
          !sub.disabled &&
          sub.url &&
          dataCollectionSubscriptions.indexOf(sub.url) === -1
        ) {
          if (sub.url.length > 256) {
            dataCollectionCache.filters[text].subscriptions.push(
              sub.substring(0, 256)
            )
          } else {
            dataCollectionCache.filters[text].subscriptions.push(sub.url)
          }
        }
      }
    }
  }

  const addMessageListener = function () {
    port.on('datacollection.elementHide', (message, sender) => {
      const dataCollectionEnabled = getSettings().data_collection_v2
      const domainInfo = { url: sender.page.url, id: sender.page.id }
      if (
        dataCollectionEnabled &&
        !adblockIsPaused() &&
        !adblockIsDomainPaused(domainInfo)
      ) {
        const { selectors } = message
        const docDomain = extractHostFromFrame(sender.frame)
        for (const subscription of filterStorage.subscriptions()) {
          if (!subscription.disabled) {
            for (const text of subscription.filterText()) {
              const filter = Filter.fromText(text)
              // We only know the exact filter in case of element hiding emulation.
              // For regular element hiding filters, the content script only knows
              // the selector, so we have to find a filter that has an identical
              // selector and is active on the domain the match was reported from.
              const isActiveElemHideFilter =
                filter instanceof ElemHideFilter &&
                selectors.includes(filter.selector) &&
                filter.isActiveOnDomain(docDomain)
              if (isActiveElemHideFilter) {
                addFilterToCache(filter, sender.page)
              }
            }
          }
        }
      }
    })
    port.on('datacollection.exceptionElementHide', (message, sender) => {
      const domainInfo = { url: sender.page.url, id: sender.page.id }
      if (
        getSettings().data_collection_v2 &&
        !adblockIsPaused() &&
        !adblockIsDomainPaused(domainInfo)
      ) {
        const selectors = message.exceptions
        for (const text of selectors) {
          const filter = Filter.fromText(text)
          addFilterToCache(filter, sender.page)
        }
      }
    })
  }

  const webRequestListener = function (details) {
    if (
      details.url &&
      details.type === 'main_frame' &&
      !adblockIsPaused() &&
      !adblockIsDomainPaused({ url: details.url, id: details.id })
    ) {
      const domain = parseUri(details.url).host
      if (!dataCollectionCache.domains[domain]) {
        dataCollectionCache.domains[domain] = {}
        dataCollectionCache.domains[domain].pages = 0
      }
      dataCollectionCache.domains[domain].pages += 1
    }
  }

  const filterListener = function (item, newValue, oldValue, tabIds) {
    if (getSettings().data_collection_v2 && !adblockIsPaused()) {
      for (const tabId of tabIds) {
        browser.tabs.get(tabId).then((tab) => {
          if (
            tab &&
            !adblockIsDomainPaused({ url: tab.url.href, id: tab.id })
          ) {
            addFilterToCache(item, tab)
          }
        })
      }
    } else if (!getSettings().data_collection_v2) {
      filterNotifier.off('filter.hitCount', filterListener)
    }
  }

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    const dataCollectionEnabled = getSettings().data_collection_v2
    if (dataCollectionEnabled) {
      window.setInterval(() => {
        idleHandler.scheduleItemOnce(() => {
          if (
            dataCollectionEnabled &&
            Object.keys(dataCollectionCache.filters).length > 0
          ) {
            const subscribedSubs = []
            const subs = getAllSubscriptionsMinusText()
            for (const id in subs) {
              if (subs[id].subscribed) {
                if (subs[id].url && subs[id].url.length > 256) {
                  subscribedSubs.push(subs[id].url.substring(0, 256))
                } else {
                  subscribedSubs.push(subs[id].url)
                }
              }
            }
            if (getUserFilters().length) {
              subscribedSubs.push('customlist')
            }
            const data = {
              version: '5',
              addonName: info.addonName,
              addonVersion: info.addonVersion,
              application: info.application,
              applicationVersion: info.applicationVersion,
              platform: info.platform,
              platformVersion: info.platformVersion,
              appLocale: browser.i18n.getUILanguage(),
              filterListSubscriptions: subscribedSubs,
              domains: dataCollectionCache.domains,
              filters: dataCollectionCache.filters,
            }
            browser.storage.local.get(TIME_LAST_PUSH_KEY).then((response) => {
              let timeLastPush = 'n/a'
              if (response[TIME_LAST_PUSH_KEY]) {
                const serverTimestamp = new Date(response[TIME_LAST_PUSH_KEY])
                // Format the timeLastPush
                const yearStr = `${serverTimestamp.getUTCFullYear()}`
                let monthStr = `${serverTimestamp.getUTCMonth() + 1}`
                let dateStr = `${serverTimestamp.getUTCDate()}`
                let hourStr = `${serverTimestamp.getUTCHours()}`
                // round the minutes up to the nearest 10
                let minStr = `${
                  Math.floor(serverTimestamp.getUTCMinutes() / 10) * 10
                }`

                if (monthStr.length === 1) {
                  monthStr = `0${monthStr}`
                }
                if (dateStr.length === 1) {
                  dateStr = `0${dateStr}`
                }
                if (hourStr.length === 1) {
                  hourStr = `0${hourStr}`
                }
                if (minStr.length === 1) {
                  minStr = `0${minStr}`
                }
                if (minStr === '60') {
                  minStr = '00'
                }
                timeLastPush = `${yearStr}-${monthStr}-${dateStr} ${hourStr}:${minStr}:00`
              }
              data.timeOfLastPush = timeLastPush
              postFilterStatsToLogServer(data, (text, status, xhr) => {
                let nowTimestamp = new Date().toGMTString()
                if (xhr && typeof xhr.getResponseHeader === 'function') {
                  try {
                    if (xhr.getResponseHeader('Date')) {
                      nowTimestamp = xhr.getResponseHeader('Date')
                    }
                  } catch (e) {
                    nowTimestamp = new Date().toGMTString()
                  }
                }
                chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp)
                // Reset memory cache
                dataCollectionCache = {}
                dataCollectionCache.filters = {}
                dataCollectionCache.domains = {}
              })
            }) // end of TIME_LAST_PUSH_KEY
          }
        })
      }, HOUR_IN_MS)
      filterNotifier.on('filter.hitCount', filterListener)
      browser.webRequest.onBeforeRequest.addListener(webRequestListener, {
        urls: ['http://*/*', 'https://*/*'],
        types: ['main_frame'],
      })
      browser.tabs.onUpdated.addListener(handleTabUpdated)
      addMessageListener()
    }
  }) // End of then

  const returnObj = {}
  returnObj.start = function returnObjStart(callback) {
    dataCollectionCache.filters = {}
    dataCollectionCache.domains = {}
    filterNotifier.on('filter.hitCount', filterListener)
    browser.webRequest.onBeforeRequest.addListener(webRequestListener, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    })
    browser.tabs.onUpdated.addListener(handleTabUpdated)
    addMessageListener()
    setSetting('data_collection_v2', true, callback)
  }
  returnObj.end = function returnObjEnd(callback) {
    dataCollectionCache = {}
    filterNotifier.off('filter.hitCount', filterListener)
    browser.webRequest.onBeforeRequest.removeListener(webRequestListener)
    browser.storage.local.remove(TIME_LAST_PUSH_KEY)
    browser.tabs.onUpdated.removeListener(handleTabUpdated)
    setSetting('data_collection_v2', false, callback)
  }
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache
  }

  return returnObj
})()

exports.DataCollectionV2 = DataCollectionV2
