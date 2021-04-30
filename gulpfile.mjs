/* eslint-disable import/extensions */

import gulp from 'gulp';
import argparse from 'argparse';
import merge from 'merge-stream';
import zip from 'gulp-vinyl-zip';
import del from 'del';
import url from 'url';
import * as tasks from './build/tasks/index.mjs';
import * as config from './build/config/index.mjs';
import * as configParser from './adblockpluschrome/build/configParser.mjs';
import * as gitUtils from './adblockpluschrome/build/utils/git.mjs';

const argumentParser = new argparse.ArgumentParser({
  description: 'Build the extension',
});

argumentParser.addArgument(
  ['-t', '--target'],
  { choices: ['chrome', 'firefox'] },
);
argumentParser.addArgument(
  ['-c', '--channel'],
  {
    choices: ['development', 'release'],
    defaultValue: 'release',
  },
);
argumentParser.addArgument(['-b', '--build-num']);
argumentParser.addArgument(['--ext-version']);
argumentParser.addArgument(['--ext-id']);
argumentParser.addArgument('--config');
argumentParser.addArgument(['-m', '--manifest']);
argumentParser.addArgument(['--basename']);


const args = argumentParser.parseKnownArgs()[0];
const targetDir = `devenv.${args.target}`;

async function getBuildSteps(options) {
  const buildSteps = [];
  const addonName = `${options.basename}${options.target}`;

  if (options.isDevenv) {
    buildSteps.push(
      tasks.addDevEnvVersion(),
      await tasks.addTestsPage({ scripts: options.tests.scripts, addonName }),
    );
  }
  buildSteps.push(
    tasks.mapping(options.mapping),
    tasks.webpack({
      webpackInfo: options.webpackInfo,
      addonName,
      addonVersion: options.version,
      sourceMapType: options.sourceMapType,
    }),
    tasks.createManifest(options.manifest),
  );

  return buildSteps;
}

async function getBuildOptions(isDevenv, isSource) {
  if (!isSource && !args.target) {
    argumentParser.error('Argument "-t/--target" is required');
  }

  const opts = {
    isDevenv,
    target: args.target,
    channel: args.channel,
    archiveType: args.target === 'chrome' ? '.zip' : '.xpi',
  };

  // eslint-disable-next-line no-nested-ternary
  opts.sourceMapType = opts.target === 'chrome'
    ? isDevenv === true ? 'inline-cheap-source-maps' : 'none'
    : 'source-maps';

  if (args.config) {
    configParser.setConfig(await import(url.pathToFileURL(args.config)));
  } else {
    configParser.setConfig(config);
  }

  let configName;
  if (isSource) {
    configName = 'base';
  } else if (isDevenv && configParser.hasTarget(`${opts.target}Dev`)) {
    configName = `${opts.target}Dev`;
  } else {
    configName = opts.target;
  }

  opts.webpackInfo = configParser.getSection(configName, 'webpack');
  opts.mapping = configParser.getSection(configName, 'mapping');
  if (opts.target === 'chrome') {
    opts.mapping.copy.push({
      dest: 'localLib/jquery',
      src: [
        'adblock-betafish/localLib/jquery/*',
      ],
    });
  }
  opts.tests = configParser.getSection(configName, 'tests');
  opts.basename = configParser.getSection(configName, 'basename');
  opts.version = configParser.getSection(configName, 'version');
  if (args.basename) {
    opts.basename = args.basename;
  }

  if (isDevenv) {
    opts.output = gulp.dest(targetDir);
  } else {
    if (opts.channel === 'development') {
      opts.version = args.build_num
        ? opts.version.concat('.', args.build_num)
        : opts.version.concat('.', await gitUtils.getBuildnum());
    }

    opts.output = zip.dest(
      `${opts.basename}${opts.target}-${opts.version}${opts.archiveType}`,
    );
  }
  if (args.ext_version) {
    opts.version = args.ext_version;
  }

  opts.manifest = await tasks.getManifestContent({
    target: opts.target,
    version: opts.version,
    channel: opts.channel,
    path: args.manifest,
    extensionId: args.ext_id,
  });
  return opts;
}

async function buildDevenv() {
  const options = await getBuildOptions(true);
  return merge(await getBuildSteps(options))
    .pipe(options.output);
}

async function buildPacked() {
  const options = await getBuildOptions(false);

  return merge(await getBuildSteps(options))
    .pipe(options.output);
}

function cleanDir() {
  return del(targetDir);
}

export const devenv = gulp.series(
  cleanDir,
  tasks.buildUI,
  buildDevenv,
);

export const build = gulp.series(
  tasks.buildUI,
  buildPacked,
);

export async function source() {
  const options = await getBuildOptions(false, true);
  return tasks.sourceDistribution(`${options.basename}-${options.version}`);
}

function startWatch() {
  gulp.watch(
    [
      'adblock-betafish/*',
      '!gulpfile.js',
    ],
    {
      ignoreInitial: false,
    },
    gulp.series(
      cleanDir,
      buildDevenv,
    ),
  );
}

export const watch = gulp.series(
  tasks.buildUI,
  startWatch,
);
