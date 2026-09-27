/**
 * Client for the ChainWitness feed backend (server/ in this repo, deployed
 * on Vercel). The backend independently re-verifies every post's on-chain
 * proof before storing it — see server/lib/solana.ts — so this call is
 * purely "add this already-proven post to the feed", never the source of
 * truth for the proof itself. If it fails, the on-chain transaction the
 * user already sent is still perfectly valid; only the feed listing is
 * affected.
 */
export const BACKEND_URL = "https://chainwitness-api.vercel.app";

export type SubmitPostInput = {
  authorPubkey: string;
  imageBase64: string;
  imageHash: string;
  capturedAtMs: number;
  txSignature: string;
};

export type FeedPost = {
  id: string;
  authorPubkey: string;
  imageUrl: string;
  imageHash: string;
  capturedAtMs: number;
  txSignature: string;
  createdAt: number;
  /** Seeker Genesis Token badge, checked server-side at post time. */
  hasSgt?: boolean;
};

async function parseJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitPostToFeed(input: SubmitPostInput): Promise<FeedPost> {
  const res = await fetch(`${BACKEND_URL}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = await parseJsonSafely(res);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Feed upload failed (${res.status}).`;
    throw new Error(message);
  }

  return (body as { post: FeedPost }).post;
}

export async function fetchFeed(limit = 20): Promise<FeedPost[]> {
  const res = await fetch(`${BACKEND_URL}/api/feed?limit=${limit}`);
  const body = await parseJsonSafely(res);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Couldn't load feed (${res.status}).`;
    throw new Error(message);
  }
  return (body as { posts: FeedPost[] }).posts;
}
