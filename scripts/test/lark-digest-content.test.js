import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_DIGEST,
  collectSourceUrls,
  validateDigest
} from '../lark-digest-content.js';

const input = {
  x: [{ tweets: [{ url: 'https://x.com/a/status/1' }] }],
  blogs: [{ url: 'https://example.com/blog' }],
  podcasts: [{ url: 'https://example.com/podcast' }],
  stats: { totalTweets: 1, blogPosts: 1, podcastEpisodes: 1 }
};

test('collects every original source URL exactly once', () => {
  assert.deepEqual(collectSourceUrls(input), [
    'https://x.com/a/status/1',
    'https://example.com/blog',
    'https://example.com/podcast'
  ]);
});

test('validates a complete digest', () => {
  const digest = collectSourceUrls(input).join('\n');
  assert.deepEqual(validateDigest(input, digest), {
    empty: false,
    sourceUrls: 3
  });
});

test('rejects a digest that drops an original URL', () => {
  assert.throws(
    () => validateDigest(input, 'https://x.com/a/status/1'),
    /missing 2 source URL/
  );
});

test('requires the exact no-content message', () => {
  const empty = {
    x: [], blogs: [], podcasts: [],
    stats: { totalTweets: 0, blogPosts: 0, podcastEpisodes: 0 }
  };
  assert.deepEqual(validateDigest(empty, EMPTY_DIGEST), {
    empty: true,
    sourceUrls: 0
  });
  assert.throws(() => validateDigest(empty, `${EMPTY_DIGEST}。`), /exactly/);
});
