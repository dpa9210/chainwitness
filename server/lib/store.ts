/**
 * Storage for the feed: post metadata in Upstash Redis (via a Vercel
 * Marketplace Redis integration — auto-injects UPSTASH_REDIS_REST_URL/TOKEN
 * or the legacy KV_REST_API_URL/TOKEN names, both read by Redis.fromEnv()),
 * photos in Vercel Blob. Neither holds any signing key — the on-chain memo
 * transaction (see lib/solana.ts) is the actual proof; this is just what
 * lets us render a feed instead of everyone re-scanning devnet themselves.
 */
import { Redis } from "@upstash/redis";
import { put } from "@vercel/blob";

const FEED_KEY = "chainwitness:feed";

export type Post = {
  id: string;
  authorPubkey: string;
  imageUrl: string;
  imageHash: string;
  capturedAtMs: number;
  txSignature: string;
  createdAt: number;
  /** Seeker Genesis Token badge — see lib/sgt.ts. Checked once at post-creation time. */
  hasSgt: boolean;
};

function redis(): Redis {
  return Redis.fromEnv();
}

export async function uploadPhoto(
  id: string,
  imageBase64: string,
  contentType: string,
): Promise<string> {
  const bytes = Buffer.from(imageBase64, "base64");
  const blob = await put(`posts/${id}.jpg`, bytes, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function savePost(post: Post): Promise<void> {
  const r = redis();
  await r.set(`post:${post.id}`, post);
  await r.lpush(FEED_KEY, post.id);
}

export async function listFeed(limit: number): Promise<Post[]> {
  const r = redis();
  const ids = await r.lrange<string>(FEED_KEY, 0, Math.max(0, limit - 1));
  if (ids.length === 0) return [];

  const posts = await Promise.all(
    ids.map((id) => r.get<Post>(`post:${id}`)),
  );
  return posts.filter((p): p is Post => p !== null);
}
