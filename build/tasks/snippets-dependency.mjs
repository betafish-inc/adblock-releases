/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import gulp from 'gulp'
import fs from 'fs'
import { promisify } from 'util'
import glob from 'glob'
import { exec } from 'child_process'
import { Readable } from 'stream'
import Vinyl from 'vinyl'

async function getMTime(file) {
  return (await fs.promises.stat(file)).mtimeMs
}

function createSnippetsBuild() {
  return promisify(exec)(
    'bash -c "npm run --prefix ./vendor/abp-snippets build"'
  )
}

async function mustBuildSnippets(lastSnippetsBuildTime) {
  let matches = [
    ...(await promisify(glob)('./vendor/abp-snippets/lib/**')),
    ...(await promisify(glob)('./vendor/abp-snippets/build/**')),
    ...(await promisify(glob)('./vendor/abp-snippets/test/**')),
    ...(await promisify(glob)('./vendor/abp-snippets/test_runner.mjs')),
    ...(await promisify(glob)('./vendor/abp-snippets/package*')),
  ]

  return await new Promise((resolve, reject) => {
    Promise.all(
      matches.map((filename) =>
        getMTime(filename).then((mtime) => {
          if (mtime > lastSnippetsBuildTime) resolve(true)
        })
      )
    ).then(() => {
      resolve(false)
    }, reject)
  })
}

function updateLastSnippetsBuildTime() {
  return fs.promises.utimes('.last_snippets_build', new Date(), new Date())
}

function createLastSnippetsBuildTime() {
  return new Readable.from([
    new Vinyl({
      path: '.last_snippets_build',
      contents: Buffer.from(''),
    }),
  ]).pipe(gulp.dest('.'))
}

export async function buildSnippets(cb) {
  let lastSnippetsBuildTime

  try {
    lastSnippetsBuildTime = await getMTime('.last_snippets_build')
  } catch (e) {
    try {
      await createSnippetsBuild()
      return createLastSnippetsBuildTime()
    } catch (error) {
      if (error.stderr.match(/ENOENT/)) {
        console.log('Skipping Snippets.')
        return cb()
      }
    }
  }

  if (await mustBuildSnippets(lastSnippetsBuildTime)) {
    await createSnippetsBuild()
    return updateLastSnippetsBuildTime()
  }

  return cb()
}
