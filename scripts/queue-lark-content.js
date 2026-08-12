#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';

import {
  filterUndeliveredContent,
  mergePendingContent,
  normalizeDeliveryState
} from './digest-delivery-state.js';

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const statePath = getArg('--state', 'state-lark.json');
  const mode = getArg('--mode', 'all');
  const state = normalizeDeliveryState(await readJSON(statePath));
  const incoming = { x: [], podcasts: [], blogs: [] };

  if (mode === 'all' || mode === 'tweets-only') {
    incoming.x = (await readJSON('feed-x.json')).x || [];
  }
  if (mode === 'all' || mode === 'podcasts-only') {
    incoming.podcasts =
      (await readJSON('feed-podcasts.json')).podcasts || [];
  }
  if (mode === 'all' || mode === 'blogs-only') {
    incoming.blogs = (await readJSON('feed-blogs.json')).blogs || [];
  }

  const undelivered = filterUndeliveredContent(incoming, state);
  state.pending = mergePendingContent(state.pending, undelivered);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  console.log(
    JSON.stringify({
      status: 'ok',
      mode,
      pendingBuilders: state.pending.x.length,
      pendingPodcasts: state.pending.podcasts.length,
      pendingBlogs: state.pending.blogs.length
    })
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
