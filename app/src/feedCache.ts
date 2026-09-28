/**
 * In-memory lookup so the post detail screen can find a post by id without
 * a dedicated GET /api/posts/:id endpoint — the feed screen already has
 * the full list in memory every time it loads, so it just shares it here.
 * Lost on app restart; a direct/deep link to a post detail screen with a
 * cold cache falls back to null and the detail screen shows a short error
 * rather than crashing. A real single-post endpoint would be the more
 * correct fix if deep-linking to individual posts becomes a real feature.
 */
import type { FeedPost } from "./api";

let cache = new Map<string, FeedPost>();

export function setFeedCache(posts: FeedPost[]): void {
  cache = new Map(posts.map((post) => [post.id, post]));
}

export function getCachedPost(id: string): FeedPost | undefined {
  return cache.get(id);
}
