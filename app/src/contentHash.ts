/**
 * Turns a captured photo + the moment it was taken into the exact bytes that
 * get signed by the wallet. Signing this hash (not the raw image) keeps the
 * signed payload small and fixed-size, while the hash still commits to the
 * full image content.
 */
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

export type CapturedPost = {
  photoUri: string;
  capturedAtMs: number;
  latitude?: number;
  longitude?: number;
};

/**
 * The exact string that gets hashed and signed. Anyone re-verifying a post
 * (including our own backend) must reconstruct this same string from the
 * post's stored metadata to check the signature against it.
 */
export function buildSignedMessage(
  imageHashHex: string,
  capturedAtMs: number,
): string {
  return `CHAINWITNESS_V1|${imageHashHex}|${capturedAtMs}`;
}

/**
 * Reads the captured photo off disk once and returns both its SHA-256 hash
 * (hex) and its base64 encoding (for uploading to the feed backend) — one
 * file read instead of two.
 */
export async function hashAndEncodePhoto(
  photoUri: string,
): Promise<{ hashHex: string; base64: string }> {
  const file = new File(photoUri);
  const bytes = await file.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return {
    hashHex: Buffer.from(digest).toString("hex"),
    base64: Buffer.from(bytes).toString("base64"),
  };
}
