import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNextDeliveryState,
  filterUndeliveredContent,
  getDigestStats,
  hasDigestContent,
  mergePendingContent
} from '../digest-delivery-state.js';

const content = {
  x: [
    {
      name: 'Builder',
      tweets: [
        { id: '1', url: 'https://x.com/a/status/1' },
        { id: '2', url: 'https://x.com/a/status/2' }
      ]
    }
  ],
  podcasts: [{ guid: 'episode-1', url: 'https://youtube.com/watch?v=1' }],
  blogs: [{ url: 'https://example.com/article' }]
};

test('filters content already recorded as delivered', () => {
  const filtered = filterUndeliveredContent(content, {
    seenTweets: { '1': Date.now() },
    seenVideos: {},
    seenArticles: { 'https://example.com/article': Date.now() }
  });

  assert.deepEqual(filtered.x[0].tweets.map((tweet) => tweet.id), ['2']);
  assert.equal(filtered.podcasts.length, 1);
  assert.equal(filtered.blogs.length, 0);
  assert.deepEqual(getDigestStats(filtered), {
    podcastEpisodes: 1,
    xBuilders: 1,
    totalTweets: 1,
    blogPosts: 0
  });
});

test('filters content already waiting in the delivery queue', () => {
  const filtered = filterUndeliveredContent(content, {
    pending: content
  });

  assert.deepEqual(filtered, { x: [], podcasts: [], blogs: [] });
});

test('builds state only from the content selected for delivery', () => {
  const deliveredAt = new Date('2026-08-12T00:00:00.000Z');
  const next = buildNextDeliveryState({}, content, deliveredAt);

  assert.equal(next.lastDeliveredAt, deliveredAt.toISOString());
  assert.equal(next.seenTweets['1'], deliveredAt.getTime());
  assert.equal(next.seenTweets['2'], deliveredAt.getTime());
  assert.equal(next.seenVideos['episode-1'], deliveredAt.getTime());
  assert.equal(
    next.seenArticles['https://example.com/article'],
    deliveredAt.getTime()
  );
});

test('detects an empty digest across all source types', () => {
  assert.equal(hasDigestContent({ x: [], podcasts: [], blogs: [] }), false);
  assert.equal(hasDigestContent(content), true);
});

test('merges queued content without duplicating source IDs or URLs', () => {
  const pending = mergePendingContent(content, {
    x: [
      {
        name: 'Builder',
        tweets: [
          { id: '2', url: 'https://x.com/a/status/2' },
          { id: '3', url: 'https://x.com/a/status/3' }
        ]
      }
    ],
    podcasts: [
      { guid: 'episode-1', url: 'https://youtube.com/watch?v=1' }
    ],
    blogs: [
      { url: 'https://example.com/article' },
      { url: 'https://example.com/article-2' }
    ]
  });

  assert.deepEqual(pending.x[0].tweets.map((tweet) => tweet.id), ['1', '2', '3']);
  assert.equal(pending.podcasts.length, 1);
  assert.equal(pending.blogs.length, 2);
});
