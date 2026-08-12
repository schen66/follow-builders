export const EMPTY_DIGEST = '今天暂无新的 Builder 更新';

export function collectSourceUrls(input) {
  const urls = [];
  for (const builder of input.x || []) {
    for (const tweet of builder.tweets || []) {
      if (tweet.url) urls.push(tweet.url);
    }
  }
  for (const blog of input.blogs || []) {
    if (blog.url) urls.push(blog.url);
  }
  for (const podcast of input.podcasts || []) {
    if (podcast.url) urls.push(podcast.url);
  }
  return [...new Set(urls)];
}

export function hasDigestContent(input) {
  return (
    (input.stats?.totalTweets || 0) > 0 ||
    (input.stats?.blogPosts || 0) > 0 ||
    (input.stats?.podcastEpisodes || 0) > 0
  );
}

export function validateDigest(input, digest) {
  const normalized = digest.trim();
  if (!hasDigestContent(input)) {
    if (normalized !== EMPTY_DIGEST) {
      throw new Error(`Empty digest must be exactly: ${EMPTY_DIGEST}`);
    }
    return { empty: true, sourceUrls: 0 };
  }

  const requiredUrls = collectSourceUrls(input);
  const missingUrls = requiredUrls.filter((url) => !normalized.includes(url));
  if (missingUrls.length > 0) {
    throw new Error(
      `Digest is missing ${missingUrls.length} source URL(s): ${missingUrls.join(', ')}`
    );
  }

  return { empty: false, sourceUrls: requiredUrls.length };
}
