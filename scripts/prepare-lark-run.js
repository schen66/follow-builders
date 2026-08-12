#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';

import {
  buildNextDeliveryState,
  getDigestStats,
  normalizeDeliveryState
} from './digest-delivery-state.js';

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

async function main() {
  const inputPath = getArg('--input');
  const statePath = getArg('--state');
  const outputPath = getArg('--output');
  const nextStatePath = getArg('--next-state');
  if (!inputPath || !statePath || !outputPath || !nextStatePath) {
    throw new Error(
      'Usage: prepare-lark-run.js --input <json> --state <json> --output <json> --next-state <json>'
    );
  }

  const [prepared, state] = await Promise.all([
    readFile(inputPath, 'utf8').then(JSON.parse),
    readFile(statePath, 'utf8').then(JSON.parse)
  ]);

  const normalizedState = normalizeDeliveryState(state);
  const selected = normalizedState.pending;
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
  const nextState = buildNextDeliveryState(normalizedState, selected);

  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`),
    writeFile(nextStatePath, `${JSON.stringify(nextState, null, 2)}\n`)
  ]);

  console.log(JSON.stringify({ status: 'ok', stats: output.stats }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
