import { randomUUID } from "node:crypto";

import { verifyProof } from "@/lib/solana";
import { savePost, uploadPhoto, type Post } from "@/lib/store";

export const dynamic = "force-dynamic";

type CreatePostBody = {
  authorPubkey: string;
  imageBase64: string;
  imageHash: string;
  capturedAtMs: number;
  txSignature: string;
};

function isValidBody(body: unknown): body is CreatePostBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.authorPubkey === "string" &&
    typeof b.imageBase64 === "string" &&
    typeof b.imageHash === "string" &&
    typeof b.capturedAtMs === "number" &&
    typeof b.txSignature === "string"
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return Response.json(
      {
        error:
          "Missing/invalid fields. Required: authorPubkey, imageBase64, imageHash, capturedAtMs, txSignature.",
      },
      { status: 400 },
    );
  }

  // Verify the proof independently against devnet before ever trusting or
  // storing anything the client sent — this is the whole point of using an
  // on-chain memo tx as the proof instead of a raw signature we'd have to
  // trust blindly.
  const check = await verifyProof({
    txSignature: body.txSignature,
    authorPubkey: body.authorPubkey,
    imageHash: body.imageHash,
    capturedAtMs: body.capturedAtMs,
  });

  if (!check.ok) {
    return Response.json(
      { error: `Proof verification failed: ${check.reason}` },
      { status: 422 },
    );
  }

  const id = randomUUID();

  let imageUrl: string;
  try {
    imageUrl = await uploadPhoto(id, body.imageBase64, "image/jpeg");
  } catch (err) {
    console.error("[ChainWitness] photo upload failed:", err);
    return Response.json({ error: "Photo upload failed." }, { status: 502 });
  }

  const post: Post = {
    id,
    authorPubkey: body.authorPubkey,
    imageUrl,
    imageHash: body.imageHash,
    capturedAtMs: body.capturedAtMs,
    txSignature: body.txSignature,
    createdAt: Date.now(),
  };

  try {
    await savePost(post);
  } catch (err) {
    console.error("[ChainWitness] failed to save post record:", err);
    return Response.json({ error: "Failed to save post." }, { status: 502 });
  }

  return Response.json({ post }, { status: 201 });
}
