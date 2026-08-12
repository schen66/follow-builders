import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLarkCommandArgs,
  resolveLarkTarget,
  splitLarkMarkdown
} from '../lark-delivery.js';

test('resolves either a group chat or direct-message target', () => {
  assert.deepEqual(resolveLarkTarget({}, { LARK_CHAT_ID: 'oc_group' }), {
    flag: '--chat-id',
    value: 'oc_group'
  });
  assert.deepEqual(resolveLarkTarget({}, { LARK_OPEN_ID: 'ou_user' }), {
    flag: '--user-id',
    value: 'ou_user'
  });
  assert.throws(
    () =>
      resolveLarkTarget(
        {},
        { LARK_CHAT_ID: 'oc_group', LARK_OPEN_ID: 'ou_user' }
      ),
    /exactly one/
  );
});

test('builds the documented lark-cli Markdown dry-run command', () => {
  const args = buildLarkCommandArgs({
    target: { flag: '--chat-id', value: 'oc_group' },
    markdown: '日报',
    idempotencyKey: 'fb-test-1',
    dryRun: true
  });

  assert.deepEqual(args, [
    'im',
    '+messages-send',
    '--chat-id',
    'oc_group',
    '--markdown',
    '日报',
    '--as',
    'bot',
    '--idempotency-key',
    'fb-test-1',
    '--dry-run'
  ]);
});

test('splits oversized Markdown on paragraph boundaries without data loss', () => {
  const input = '第一段内容\n\n第二段内容\n\n第三段内容';
  const chunks = splitLarkMarkdown(input, 25);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join('\n\n'), input);
  assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 25));
});
