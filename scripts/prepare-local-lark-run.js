#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  buildNextDeliveryState,
  emptyDeliveryState,
  filterUndeliveredContent,
  getDigestStats,
  mergePendingContent,
  normalizeDeliveryState
} from './digest-delivery-state.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_LOCAL_DIR = join(REPO_DIR, '.follow-builders-local');

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function readState(statePath) {
  if (!existsSync(statePath)) return emptyDeliveryState();
  return normalizeDeliveryState(
    JSON.parse(await readFile(statePath, 'utf8'))
  );
}

const CENTRAL_FILES = {
  feedX: 'feed-x.json',
  feedPodcasts: 'feed-podcasts.json',
  feedBlogs: 'feed-blogs.json',
  summarizePodcast: 'prompts/summarize-podcast.md',
  summarizeTweets: 'prompts/summarize-tweets.md',
  summarizeBlogs: 'prompts/summarize-blogs.md',
  digestIntro: 'prompts/digest-intro.md',
  translate: 'prompts/translate.md'
};

function withoutProxyEnv(env) {
  const clean = { ...env };
  for (const key of [
    'ALL_PROXY', 'all_proxy', 'HTTP_PROXY', 'http_proxy',
    'HTTPS_PROXY', 'https_proxy'
  ]) delete clean[key];
  return clean;
}

function fetchCentralBundle() {
  const fields = Object.entries(CENTRAL_FILES)
    .map(([alias, path]) => `${alias}: object(expression: \"main:${path}\") { ... on Blob { text } }`)
    .join('\n');
  const query = `query { repository(owner: \"zarazhangrui\", name: \"follow-builders\") { ${fields} } }`;
  const result = spawnSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
    cwd: REPO_DIR,
    encoding: 'utf8',
    env: withoutProxyEnv(process.env),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`GitHub API failed: ${(result.stderr || result.stdout).trim()}`);
  }

  const repository = JSON.parse(result.stdout).data?.repository;
  const files = {};
  for (const [alias, path] of Object.entries(CENTRAL_FILES)) {
    const text = repository?.[alias]?.text;
    if (typeof text !== 'string') throw new Error(`GitHub API omitted ${path}`);
    files[path] = text;
  }
  return { fetchedAt: new Date().toISOString(), files };
}

async function fetchPreparedDigest(bundlePath) {
  let centralFeedUpdated = false;
  if (!process.argv.includes('--use-cache')) {
    try {
      const bundle = fetchCentralBundle();
      await writeFile(bundlePath, `${JSON.stringify(bundle)}\n`);
      centralFeedUpdated = true;
    } catch (error) {
      if (!existsSync(bundlePath)) throw error;
      console.error(`Central feed refresh failed; using cached bundle: ${error.message}`);
    }
  }

  if (!existsSync(bundlePath)) {
    throw new Error('No cached central feed bundle is available');
  }

  const result = spawnSync(process.execPath, [join(SCRIPT_DIR, 'prepare-digest.js')], {
    cwd: REPO_DIR,
    encoding: 'utf8',
    env: {
      ...process.env,
      FOLLOW_BUILDERS_FEED_SOURCE: 'bundle',
      FOLLOW_BUILDERS_PROMPT_SOURCE: 'bundle',
      FOLLOW_BUILDERS_BUNDLE_PATH: bundlePath
    }
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `prepare-digest.js failed: ${(result.stderr || result.stdout).trim()}`
    );
  }
  return {
    prepared: JSON.parse(result.stdout),
    centralFeedUpdated,
    ref: 'zarazhangrui/follow-builders@main'
  };
}

async function main() {
  const localDir = resolve(getArg('--local-dir', DEFAULT_LOCAL_DIR));
  const statePath = resolve(getArg('--state', join(localDir, 'state-lark.json')));
  const runDir = resolve(getArg('--run-dir', join(localDir, 'run')));
  const inputPath = join(runDir, 'lark-input.json');
  const nextStatePath = join(runDir, 'state-lark.next.json');
  const digestPath = join(runDir, 'lark-digest.md');
  const bundlePath = join(localDir, 'central-feed-bundle.json');

  await Promise.all([mkdir(dirname(statePath), { recursive: true }), mkdir(runDir, { recursive: true })]);

  const [feedResult, state] = await Promise.all([
    fetchPreparedDigest(bundlePath),
    readState(statePath)
  ]);
  const { prepared, centralFeedUpdated, ref } = feedResult;
  const incoming = {
    x: prepared.x || [],
    podcasts: prepared.podcasts || [],
    blogs: prepared.blogs || []
  };
  const undelivered = filterUndeliveredContent(incoming, state);
  state.pending = mergePendingContent(state.pending, undelivered);

  // Persist the queue before generation. Failed generation or delivery keeps
  // every item pending for the next scheduled run.
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const selected = state.pending;
  const output = {
    ...prepared,
    config: {
      ...prepared.config,
      language: 'zh',
      delivery: { method: 'lark' }
    },
    ...selected,
    stats: {
      ...getDigestStats(selected),
      feedGeneratedAt: prepared.stats?.feedGeneratedAt || null
    }
  };
  const nextState = buildNextDeliveryState(state, selected);

  await Promise.all([
    writeFile(inputPath, `${JSON.stringify(output, null, 2)}\n`),
    writeFile(nextStatePath, `${JSON.stringify(nextState, null, 2)}\n`)
  ]);

  console.log(
    JSON.stringify({
      status: 'ok',
      inputPath,
      digestPath,
      statePath,
      nextStatePath,
      centralFeedUpdated,
      centralFeedRef: ref,
      stats: output.stats
    })
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
