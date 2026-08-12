import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectSourceUrls,
  extractResponseText
} from '../generate-lark-digest.js';

test('extracts text from the Responses API output envelope', () => {
  assert.equal(
    extractResponseText({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '完整日报' }]
        }
      ]
    }),
    '完整日报'
  );
});

test('collects every original source URL exactly once', () => {
  const urls = collectSourceUrls({
    x: [{ tweets: [{ url: 'https://x.com/1' }, { url: 'https://x.com/1' }] }],
    blogs: [{ url: 'https://example.com/blog' }],
    podcasts: [{ url: 'https://youtube.com/watch?v=1' }]
  });

  assert.deepEqual(urls, [
    'https://x.com/1',
    'https://example.com/blog',
    'https://youtube.com/watch?v=1'
  ]);
});
