#!/usr/bin/env python

import os
import sys
import subprocess
import glob
import io
import json
import os
import re
import struct
import subprocess
import sys
import random
import posixpath
import re
import errno
from collections import OrderedDict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEPENDENCY_SCRIPT = os.path.join(BASE_DIR, "ensure_dependencies.py")
ABP_DIR = os.path.join(BASE_DIR, "adblockpluschrome")

def get_metadata_path(base_dir, type):
    return os.path.join(BASE_DIR, "metadata." + type)

def get_dev_env_path(base_dir, type):
    return os.path.join(BASE_DIR, "devenv." + type)

def import_ab_locales(params, files):
    for item in params['metadata'].items('import_ab_locales'):
        filename = item[0]
        for sourceFile in glob.glob(os.path.join(os.path.dirname(item.source),
                                                 *filename.split('/'))):
            keys = item[1]
            locale = sourceFile.split(os.path.sep)[-2]
            targetFile = posixpath.join('_locales', locale, 'messages.json')
            data = json.loads(files.get(targetFile, '{}').decode('utf-8'))

            try:
                with io.open(sourceFile, 'r', encoding='utf-8') as handle:
                    sourceData = json.load(handle)

                # Resolve wildcard imports
                if keys == '*':
                    importList = sourceData.keys()
                    importList = filter(lambda k: not k.startswith('_'), importList)
                    keys = ' '.join(importList)

                for stringID in keys.split():
                    if stringID in sourceData:
                        data.setdefault(stringID, sourceData[stringID])
            except Exception as e:
                print 'Warning: error importing locale data from %s: %s' % (sourceFile, e)

            files[targetFile] = toJson(data)

def load_translation(locale):
    filename = os.path.join(BASE_DIR, "_locales", locale, "messages.json")
    try:
        file = open(filename, "rb")
    except IOError as e:
        if e.errno != errno.ENOENT:
            raise
        return {}
    with file:
        return json.load(file, object_pairs_hook=OrderedDict)

def process_file(path, data, params):
    if path == "Info.plist":
        return data.replace("org.adblockplus.", "com.betafish.")

    m = re.search(r"^_locales\/([^/]+)\/messages.json$", path)
    if m:
        data = re.sub(r"Adblock Plus", "AdBlock", data, flags=re.I)

        translation = json.loads(data, object_pairs_hook=OrderedDict)
        translation.update(load_translation("en_US"))
        translation.update(load_translation(m.group(1)))

        data = json.dumps(translation, ensure_ascii=False, indent=2)
        data = data.encode('utf-8')

    return data

def ab_serialize_section_if_present(self, section, base):
    def parse_value(v):
        if v.startswith('number:'):
            v = v.split(':', 1)[1]
            try:
                return int(v)
            except ValueError:
                return float(v)
        if v == 'bool:true':
            return True
        if v == 'bool:false':
            return False
        return v

    if self.has_section(section):
        for k, v in self.items(section):
            parents = k.split('.')
            tail = parents.pop()
            current = base
            for name in parents:
                current = current.setdefault(name, {})

            if '\n' in v:
                current[tail] = [parse_value(x) for x in v.splitlines() if x]
            elif v == 'REMOVE':
                current.pop(tail, "false")
            else:
                current[tail] = parse_value(v)

try:
  subprocess.check_call([sys.executable, DEPENDENCY_SCRIPT, BASE_DIR])
except subprocess.CalledProcessError as e:
  print >>sys.stderr, e
  print >>sys.stderr, "Failed to ensure dependencies being up-to-date!"

import buildtools.packager
buildtools.packager.getMetadataPath = get_metadata_path
buildtools.packager.getDevEnvPath = get_dev_env_path
import buildtools.packagerChrome
buildtools.packagerChrome.processFile = process_file
buildtools.packagerChrome.import_locales = import_ab_locales
toJson = buildtools.packagerChrome.toJson
from buildtools.chainedconfigparser import ChainedConfigParser
ChainedConfigParser.serialize_section_if_present = ab_serialize_section_if_present

originalGetIgnoredFiles = buildtools.packagerChrome.getIgnoredFiles

def get_ignored_files(params):
    returnSet = originalGetIgnoredFiles(params)
    returnSet.add('skin')
    return returnSet

buildtools.packagerChrome.getIgnoredFiles = get_ignored_files

import buildtools.build
buildtools.build.process_args(ABP_DIR)
