#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { readFile, rename } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { validateDigest } from './lark-digest-content.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_LOCAL_DIR = join(REPO_DIR, '.follow-builders-local');

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const localDir = resolve(getArg('--local-dir', DEFAULT_LOCAL_DIR));
  const runDir = resolve(getArg('--run-dir', join(localDir, 'run')));
  const statePath = resolve(getArg('--state', join(localDir, 'state-lark.json')));
  const inputPath = resolve(getArg('--input', join(runDir, 'lark-input.json')));
  const nextStatePath = resolve(
    getArg('--next-state', join(runDir, 'state-lark.next.json'))
  );
  const digestPath = resolve(getArg('--digest', join(runDir, 'lark-digest.md')));
  const dryRun = process.argv.includes('--dry-run');

  const [input, digest] = await Promise.all([
    readFile(inputPath, 'utf8').then(JSON.parse),
    readFile(digestPath, 'utf8')
  ]);
  const validation = validateDigest(input, digest);

  const result = spawnSync(
    process.execPath,
    [join(SCRIPT_DIR, 'deliver.js'), '--file', digestPath],
    {
      cwd: REPO_DIR,
      encoding: 'utf8',
      env: {
        ...process.env,
        DELIVERY_METHOD: 'lark',
        LARK_DRY_RUN: dryRun ? '1' : '0'
      }
    }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Lark delivery failed: ${(result.stderr || result.stdout).trim()}`
    );
  }

  if (!dryRun) await rename(nextStatePath, statePath);

  console.log(
    JSON.stringify({
      status: 'ok',
      dryRun,
      stateAdvanced: !dryRun,
      ...validation
    })
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
