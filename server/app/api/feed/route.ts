import { listFeed } from "@/lib/store";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const posts = await listFeed(limit);
    return Response.json({ posts });
  } catch (err) {
    console.error("[ChainWitness] failed to list feed:", err);
    return Response.json({ error: "Failed to load feed." }, { status: 502 });
  }
}
