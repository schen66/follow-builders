const STATE_RETENTION_DAYS = 90;

export function emptyDeliveryState() {
  return {
    lastDeliveredAt: null,
    seenTweets: {},
    seenVideos: {},
    seenArticles: {},
    pending: { x: [], podcasts: [], blogs: [] }
  };
}

export function normalizeDeliveryState(state = {}) {
  return {
    lastDeliveredAt: state.lastDeliveredAt || null,
    seenTweets: state.seenTweets || {},
    seenVideos: state.seenVideos || {},
    seenArticles: state.seenArticles || {},
    pending: state.pending || { x: [], podcasts: [], blogs: [] }
  };
}

function podcastKey(podcast) {
  return podcast.guid || podcast.url;
}

export function filterUndeliveredContent(content, rawState = {}) {
  const state = normalizeDeliveryState(rawState);

  const x = (content.x || [])
    .map((builder) => ({
      ...builder,
      tweets: (builder.tweets || []).filter(
        (tweet) =>
          tweet.id &&
          tweet.url &&
          !state.seenTweets[tweet.id] &&
          !state.pending.x.some((pendingBuilder) =>
            (pendingBuilder.tweets || []).some(
              (pendingTweet) => pendingTweet.id === tweet.id
            )
          )
      )
    }))
    .filter((builder) => builder.tweets.length > 0);

  const podcasts = (content.podcasts || []).filter((podcast) => {
    const key = podcastKey(podcast);
    return (
      key &&
      podcast.url &&
      !state.seenVideos[key] &&
      !state.pending.podcasts.some(
        (pendingPodcast) => podcastKey(pendingPodcast) === key
      )
    );
  });

  const blogs = (content.blogs || []).filter(
    (blog) =>
      blog.url &&
      !state.seenArticles[blog.url] &&
      !state.pending.blogs.some((pendingBlog) => pendingBlog.url === blog.url)
  );

  return { x, podcasts, blogs };
}

function pruneSeenMap(map, cutoff) {
  return Object.fromEntries(
    Object.entries(map).filter(([, timestamp]) => timestamp >= cutoff)
  );
}

export function buildNextDeliveryState(
  rawState,
  content,
  deliveredAt = new Date()
) {
  const state = normalizeDeliveryState(rawState);
  const deliveredTimestamp = deliveredAt.getTime();
  const cutoff =
    deliveredTimestamp - STATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const next = {
    lastDeliveredAt: deliveredAt.toISOString(),
    seenTweets: pruneSeenMap(state.seenTweets, cutoff),
    seenVideos: pruneSeenMap(state.seenVideos, cutoff),
    seenArticles: pruneSeenMap(state.seenArticles, cutoff),
    pending: { x: [], podcasts: [], blogs: [] }
  };

  for (const builder of content.x || []) {
    for (const tweet of builder.tweets || []) {
      if (tweet.id) next.seenTweets[tweet.id] = deliveredTimestamp;
    }
  }

  for (const podcast of content.podcasts || []) {
    const key = podcastKey(podcast);
    if (key) next.seenVideos[key] = deliveredTimestamp;
  }

  for (const blog of content.blogs || []) {
    if (blog.url) next.seenArticles[blog.url] = deliveredTimestamp;
  }

  return next;
}

export function mergePendingContent(current = {}, incoming = {}) {
  const tweetIds = new Set();
  const xByBuilder = new Map();

  for (const builder of [...(current.x || []), ...(incoming.x || [])]) {
    const key = builder.handle || builder.name;
    if (!xByBuilder.has(key)) xByBuilder.set(key, { ...builder, tweets: [] });
    const target = xByBuilder.get(key);
    for (const tweet of builder.tweets || []) {
      if (!tweet.id || tweetIds.has(tweet.id)) continue;
      tweetIds.add(tweet.id);
      target.tweets.push(tweet);
    }
  }

  const mergeByKey = (left, right, keyFor) => {
    const byKey = new Map();
    for (const item of [...left, ...right]) {
      const key = keyFor(item);
      if (key && !byKey.has(key)) byKey.set(key, item);
    }
    return [...byKey.values()];
  };

  return {
    x: [...xByBuilder.values()].filter((builder) => builder.tweets.length > 0),
    podcasts: mergeByKey(
      current.podcasts || [],
      incoming.podcasts || [],
      podcastKey
    ),
    blogs: mergeByKey(
      current.blogs || [],
      incoming.blogs || [],
      (blog) => blog.url
    )
  };
}

export function getDigestStats(content) {
  return {
    podcastEpisodes: (content.podcasts || []).length,
    xBuilders: (content.x || []).length,
    totalTweets: (content.x || []).reduce(
      (sum, builder) => sum + (builder.tweets || []).length,
      0
    ),
    blogPosts: (content.blogs || []).length
  };
}

export function hasDigestContent(content) {
  const stats = getDigestStats(content);
  return (
    stats.podcastEpisodes > 0 ||
    stats.totalTweets > 0 ||
    stats.blogPosts > 0
  );
}
