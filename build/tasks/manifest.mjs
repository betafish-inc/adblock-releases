
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
