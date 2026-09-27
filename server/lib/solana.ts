/**
 * Independently verifies a post's on-chain proof by reading the claimed
 * transaction back from devnet — never by trusting whatever the client
 * says about it. Anyone (not just this backend) can run the same check
 * against a public RPC, which is the point of using a plain Memo tx as the
 * proof in the first place.
 *
 * MEMO_PROGRAM_ID matches the one used client-side (see the mobile app's
 * src/solanaClient.ts) — verified independently against solana-program.com
 * docs and a live devnet getAccountInfo call, since the current
 * @solana/spl-memo npm package ships a different, incorrect address.
 */
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export type ProofCheckInput = {
  txSignature: string;
  authorPubkey: string;
  imageHash: string;
  capturedAtMs: number;
};

export type ProofCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Must match app/src/contentHash.ts:buildSignedMessage exactly. */
function expectedMemo(imageHash: string, capturedAtMs: number): string {
  return `CHAINWITNESS_V1|${imageHash}|${capturedAtMs}`;
}

export async function verifyProof(
  input: ProofCheckInput,
): Promise<ProofCheckResult> {
  const { txSignature, authorPubkey, imageHash, capturedAtMs } = input;

  let tx;
  try {
    tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    console.warn("[ChainWitness] getTransaction failed:", err);
    return { ok: false, reason: "Invalid or malformed transaction signature." };
  }

  if (!tx) {
    return {
      ok: false,
      reason: "Transaction not found on devnet (not yet confirmed, or the wrong signature).",
    };
  }

  if (tx.meta?.err) {
    return {
      ok: false,
      reason: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`,
    };
  }

  const accountKeys = tx.transaction.message.getAccountKeys();
  const feePayer = accountKeys.get(0);
  if (!feePayer || feePayer.toBase58() !== authorPubkey) {
    return {
      ok: false,
      reason: "Transaction's fee payer doesn't match the claimed author.",
    };
  }

  const expected = expectedMemo(imageHash, capturedAtMs);
  const memoInstruction = tx.transaction.message.compiledInstructions.find(
    (ix) => accountKeys.get(ix.programIdIndex)?.equals(MEMO_PROGRAM_ID),
  );

  if (!memoInstruction) {
    return { ok: false, reason: "Transaction has no Memo instruction." };
  }

  const memoText = Buffer.from(memoInstruction.data).toString("utf8");
  if (memoText !== expected) {
    return {
      ok: false,
      reason: "Memo content doesn't match the claimed hash/timestamp.",
    };
  }

  return { ok: true };
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
