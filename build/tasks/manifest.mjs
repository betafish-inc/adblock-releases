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

import { resolve } from 'path';
import fs from 'fs';
import { Readable } from 'stream';
// eslint-disable-next-line import/no-extraneous-dependencies
import Vinyl from 'vinyl';

let manifest;

function editManifest(dataParam, version, channel, target, extensionId) {
  const data = dataParam;
  data.version = version;

  if (target === 'chrome') {
    delete data.applications;
    delete data.content_security_policy;
    const tempArray = data.web_accessible_resources.concat(data.web_accessible_resources_chrome);
    data.web_accessible_resources = tempArray;
  }

  if (target === 'firefox') {
    const gecko = {};
    gecko.strict_min_version = data.applications.gecko.strict_min_version;
    gecko.id = extensionId || data.applications.gecko.id;

    delete data.storage;
    delete data.minimum_chrome_version;
    delete data.minimum_opera_version;
    delete data.optional_permissions;

    data.applications.gecko = gecko;
  }
  delete data.web_accessible_resources_chrome;

  return data;
}

export function createManifest(contents) {
  // eslint-disable-next-line new-cap
  return new Readable.from([
    new Vinyl({
      // eslint-disable-next-line no-undef
      contents: Buffer.from(JSON.stringify(contents, null, 2)),
      path: 'manifest.json',
    }),
  ]);
}

export async function getManifestContent({
  target, version, channel, path, extensionId,
}) {
  if (manifest) {
    return manifest;
  }

  const raw = JSON.parse(await fs.promises.readFile(resolve(path || 'build/manifest.json')));

  manifest = editManifest(raw, version, channel, target, extensionId);

  return manifest;
}
