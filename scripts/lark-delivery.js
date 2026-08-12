import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Feishu post messages are limited to 30 KB after serialization. Keep each
// Markdown chunk comfortably below that limit to leave room for CLI conversion.
const DEFAULT_MAX_CHUNK_BYTES = 18_000;
const LOCAL_LARK_CLI = fileURLToPath(
  new URL('./node_modules/.bin/lark-cli', import.meta.url)
);

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function splitOversizedBlock(block, maxBytes) {
  const lines = block.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (byteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = '';

    if (byteLength(line) <= maxBytes) {
      current = line;
      continue;
    }

    let piece = '';
    for (const character of line) {
      if (byteLength(piece + character) > maxBytes) {
        chunks.push(piece);
        piece = character;
      } else {
        piece += character;
      }
    }
    current = piece;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitLarkMarkdown(text, maxBytes = DEFAULT_MAX_CHUNK_BYTES) {
  if (byteLength(text) <= maxBytes) return [text];

  const blocks = text.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const rawBlock of blocks) {
    const blockParts =
      byteLength(rawBlock) > maxBytes
        ? splitOversizedBlock(rawBlock, maxBytes)
        : [rawBlock];

    for (const block of blockParts) {
      const candidate = current ? `${current}\n\n${block}` : block;
      if (byteLength(candidate) <= maxBytes) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = block;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function resolveLarkTarget(delivery = {}, env = process.env) {
  const chatId = env.LARK_CHAT_ID || delivery.chatId;
  const openId = env.LARK_OPEN_ID || delivery.openId;

  if (Boolean(chatId) === Boolean(openId)) {
    throw new Error(
      'Set exactly one LARK_CHAT_ID/delivery.chatId or LARK_OPEN_ID/delivery.openId'
    );
  }

  if (chatId && !chatId.startsWith('oc_')) {
    throw new Error('Lark chat_id must start with oc_');
  }
  if (openId && !openId.startsWith('ou_')) {
    throw new Error('Lark open_id must start with ou_');
  }

  return chatId
    ? { flag: '--chat-id', value: chatId }
    : { flag: '--user-id', value: openId };
}

export function buildLarkCommandArgs({
  target,
  markdown,
  idempotencyKey,
  dryRun = false
}) {
  return [
    'im',
    '+messages-send',
    target.flag,
    target.value,
    '--markdown',
    markdown,
    '--as',
    'bot',
    '--idempotency-key',
    idempotencyKey,
    ...(dryRun ? ['--dry-run'] : [])
  ];
}

export async function sendLarkDigest(
  text,
  delivery = {},
  { dryRun = false, env = process.env } = {}
) {
  const appId = env.LARK_APP_ID;
  const appSecret = env.LARK_APP_SECRET;
  if (Boolean(appId) !== Boolean(appSecret)) {
    throw new Error(
      'Set both LARK_APP_ID and LARK_APP_SECRET, or neither when using a configured lark-cli profile'
    );
  }

  const target = resolveLarkTarget(delivery, env);
  const chunks = splitLarkMarkdown(text);
  const digestHash = createHash('sha256').update(text).digest('hex').slice(0, 32);
  const cli =
    env.LARK_CLI_BIN ||
    (existsSync(LOCAL_LARK_CLI) ? LOCAL_LARK_CLI : 'lark-cli');

  for (let index = 0; index < chunks.length; index += 1) {
    const prefix = chunks.length > 1 ? `**Follow Builders 日报 (${index + 1}/${chunks.length})**\n\n` : '';
    const markdown = prefix + chunks[index];
    const idempotencyKey = `fb-${digestHash}-${index + 1}`;
    const args = buildLarkCommandArgs({
      target,
      markdown,
      idempotencyKey,
      dryRun
    });

    const cliEnv = {
      ...env,
      LARKSUITE_CLI_BRAND: env.LARK_BRAND || 'feishu',
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1'
    };
    if (appId && appSecret) {
      cliEnv.LARKSUITE_CLI_APP_ID = appId;
      cliEnv.LARKSUITE_CLI_APP_SECRET = appSecret;
    }

    const result = spawnSync(cli, args, {
      stdio: 'inherit',
      env: cliEnv
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`lark-cli exited with status ${result.status}`);
    }

    if (!dryRun && chunks.length > 1 && index < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return { messageCount: chunks.length, dryRun };
}
