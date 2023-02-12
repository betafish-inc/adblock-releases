/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global translate, License, MABPayment, filterNotifier,
   activateTab, browser, storageSet, storageGet, initializeProxies,
   SubscriptionsProxy, SubscriptionAdapter, send, isDistractionControlURL   */

// the elements array below are in the order they appear on the page
const distractionControlUIitems = [
  {
    id: 'distraction-control-push',
    title: translate('block_site_notifications'),
    description: translate('decline_allow_notifications'),
    imageURL: 'icons/distraction-control-push.svg',
    topLineClass: '',
  },
  {
    id: 'distraction-control-video',
    title: translate('stop_autoplay_videos'),
    description: translate('prevent_videos'),
    imageURL: 'icons/distraction-control-video.svg',
    topLineClass: 'top-line',
  },
  {
    id: 'distraction-control-newsletter',
    title: translate('hide_newsletter_popups'),
    description: translate('block_newsletter_popups'),
    imageURL: 'icons/distraction-control-newsletter.svg',
    topLineClass: 'top-line',
  },
  {
    id: 'distraction-control-survey',
    title: translate('ignore_survey_requests'),
    description: translate('dismiss_invitations'),
    imageURL: 'icons/distraction-control-survey.svg',
    topLineClass: 'top-line',
  },
];

const dcWarningClosedKey = 'dc_warning_closed';
let dcWarningClosed = storageGet(dcWarningClosedKey);

function getDefaultFilterUI(entry, filterList, checkboxID, isActiveLicense) {
  const isSelected = filterList.subscribed;
  const filterListUrl = filterList.mv2URL;

  let $checkBox = $('<input>')
    .attr('type', 'checkbox')
    .attr('id', checkboxID)
    .attr('data-url', filterListUrl)
    .prop('checked', isSelected);

  let $checkBoxIcons = $(`
    <i role="img" aria-hidden="true" class="unchecked material-icons">lens</i>
    <i role="img" aria-hidden="true" class="checked material-icons circle-icon-bg-24 checkbox-icon">check_circle</i>'`);

  if (!isActiveLicense) {
    $checkBoxIcons = $('<i role="img" aria-hidden="true" class="material-icons dc-icons md-20">lock</i>');
    $checkBox = $('<span>');
  } else {
    $checkBox.on('click', function clickhandler() {
      const checked = $(this).is(':checked');
      if (checked) {
        SubscriptionsProxy.add(filterListUrl);
      } else {
        setTimeout(() => {
          SubscriptionsProxy.remove(filterListUrl);
        }, 1);
      }
    });
  }

  const $checkBoxWrapper = $('<span>')
    .addClass('checkbox')
    .addClass('md-stack')
    .append($checkBox)
    .append($checkBoxIcons);

  const $filterTitle = $('<span>')
    .addClass('dc_filter_list_title')
    .text(entry.title);

  const $filterHeader = $('<div>')
    .append($filterTitle);

  const $extraInformation = $('<div>')
    .addClass('dc_extra_info')
    .text(entry.description);

  const $filterInfo = $('<div>')
    .append($filterHeader)
    .append($extraInformation);

  const $label = $('<label>')
    .attr('title', filterList.url)
    .attr('for', checkboxID)
    .append($filterInfo);

  if (!isActiveLicense) {
    $label.css({
      cursor: 'pointer',
    });
  }

  const $lockIcon = $('<i>lock_open</i>')
    .css({
      color: 'white',
    })
    .attr('role', 'img')
    .attr('aria-hidden', 'true')
    .addClass('md-48')
    .addClass('material-icons');

  const $lockOverlay = $('<span>')
    .addClass('dc_locked_overlay')
    .addClass('do-not-display')
    .append($lockIcon);

  const $image = $('<img>').attr('src', entry.imageURL);

  const $imageWrapper = $('<span>')
    .addClass('dc_image_wrapper')
    .append($image)
    .append($lockOverlay);

  const $leftWrapper = $('<span>')
    .addClass('left_dc_subscription')
    .append($checkBoxWrapper)
    .append($label);

  const $checkboxHeaderLine = $('<div>')
    .addClass('dc_subscription')
    .addClass('dc_section_padding')
    .attr('name', filterList.id)
    .append($leftWrapper)
    .append($imageWrapper);

  const $filterWrapper = $('<div>')
    .addClass('filter-subscription-wrapper')
    .addClass(entry.topLineClass)
    .append($checkboxHeaderLine);

  if (!isActiveLicense) {
    $filterWrapper.addClass('locked');
    $checkboxHeaderLine.addClass('locked');
    $filterWrapper.on('click', () => {
      browser.tabs.create({ url: License.MAB_CONFIG.payURL });
    });
  }

  return {
    checkbox: $checkBox,
    filter: $filterWrapper,
  };
}

const prepareDCSubscriptions = function prepareDCSubscriptions(subs, isActiveLicense) {
  let index = 0;
  for (const id in distractionControlUIitems) {
    const entry = distractionControlUIitems[id];
    $('#distraction-control-filter-lists').append(getDefaultFilterUI(entry, subs[entry.id], index, isActiveLicense).filter);
    index += 1;
  }
};

const initializeDC = async function initializeDC(isActiveLicense) {
  // Retrieves list of filter lists from the background.
  const subs = await SubscriptionAdapter.getAllSubscriptionsMinusText();
  // Initialize page using subscriptions from the background.
  // Copy from update subscription list + setsubscriptionlist
  prepareDCSubscriptions(subs, isActiveLicense);

  if (isActiveLicense && !dcWarningClosed) {
    $('.distraction-control-warning').css({ display: 'flex' });
    $('#distraction-control-warning-button').on('click', () => {
      $('.distraction-control-warning').slideUp();
      dcWarningClosed = true;
      storageSet(dcWarningClosedKey, dcWarningClosed);
    });
    $('#dc_more_information_link').on('click', () => {
      send('openTab', { urlToOpen: 'https://help.getadblock.com/support/solutions/articles/6000250028-about-distraction-control' });
    });
  }
};


$(async () => {
  await initializeProxies();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    initializeDC(false);
    return;
  }
  initializeDC(License.isActiveLicense());
  const payInfo = MABPayment.initialize('distraction-control');
  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
    $('#get-it-now-distraction-control').on('click', MABPayment.userClickedPremiumCTA);
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
  }

  $('a.link-to-tab').on('click', (event) => {
    activateTab($(event.target).attr('href'));
  });
});

const isDCFilterList = function (item) {
  return (item && isDistractionControlURL(item.url));
};

const updateCheckbox = function (item, isChecked) {
  if (isDCFilterList(item)) {
    const $checkbox = $(`input[data-url='${item.url}']`);
    $checkbox.prop('checked', isChecked);
  }
};

const onDCSubAdded = function (items) {
  let item = items;
  if (Array.isArray(items)) {
    [item] = items;
  }
  updateCheckbox(item, true);
};
SubscriptionsProxy.onAdded.addListener(onDCSubAdded);

const onDCSubRemoved = function (items) {
  let item = items;
  if (Array.isArray(items)) {
    [item] = items;
  }
  updateCheckbox(item, false);
};
SubscriptionsProxy.onRemoved.addListener(onDCSubRemoved);
