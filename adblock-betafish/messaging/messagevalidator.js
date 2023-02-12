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
/* global browser */

import { SessionStorage } from '../../vendor/adblockplusui/adblockpluschrome/lib/storage/session';

const sessionStorageKey = 'ab:CustomFilterRandomName';
const sessionKey = 'ab:randomtext';

const sessionStorage = new SessionStorage(sessionStorageKey);

/* eslint-disable-next-line no-unused-vars */
class MessageValidator {
  generateNewRandomText = () => {
    this.randomtext = `ab-${Math.random().toString(36).substring(2)}`;
    sessionStorage.set(sessionKey, this.randomtext);
    return this.randomtext;
  };

  validateMessage = async (message) => {
    const data = await sessionStorage.get(sessionKey);
    this.randomtext = data;
    return Promise.resolve(message && (message.addCustomFilterRandomName === this.randomtext));
  };
}
const messageValidator = new MessageValidator();
export default messageValidator;
