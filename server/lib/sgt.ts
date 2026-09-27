/**
 * Seeker Genesis Token (SGT) check — purely cosmetic ("does this post's
 * author hold an SGT, show a badge"), so this is deliberately lighter than
 * Solana Mobile's full SGT verification pattern:
 * https://github.com/solana-mobile/solana-mobile-skills/blob/main/skills/seeker-genesis-token/
 *
 * That pattern adds Sign-in-with-Solana (nonce + signature verification) on
 * top of the mint check, because it's designed for *gating rewards* —
 * there, proving the caller currently controls the wallet matters, because
 * a bare "this address holds an SGT" claim could be submitted by anyone
 * about anyone else's address to steal their reward.
 *
 * That threat doesn't apply here. By the time this runs, `authorPubkey` has
 * already been proven to control the signing key — it's the fee payer of a
 * real, independently-verified on-chain transaction (see lib/solana.ts).
 * We're not granting anything of value off the back of the SGT check; we're
 * decorating an already-authenticated post with one more true fact about
 * the same wallet. So: no SIWS ceremony, just the mint check, run
 * server-side (never trust a client-reported "I have a badge" claim).
 *
 * SGTs exist on mainnet only, unlike the rest of this app (devnet) — see
 * PLAN.md, this was flagged as a risk on Day 1.
 *
 * Constants and verification logic verified against Solana Mobile's own
 * reference implementation (fetched directly from
 * solana-mobile/solana-mobile-skills), not memory:
 * https://github.com/solana-mobile/solana-mobile-skills/blob/main/skills/seeker-genesis-token/references/sgt-verification.md
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenGroupMemberState,
  unpackMint,
} from "@solana/spl-token";

// Metadata pointer address and token-group address are intentionally the
// same value — confirmed against Solana Mobile's own reference doc.
const SGT_METADATA_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SGT_GROUP_MINT_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";

const MAINNET_RPC_URL =
  process.env.SGT_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";

const mainnetConnection = new Connection(MAINNET_RPC_URL, "confirmed");

const BATCH_SIZE = 100;

async function findSgtMint(mintPubkeys: PublicKey[]): Promise<string | null> {
  for (let i = 0; i < mintPubkeys.length; i += BATCH_SIZE) {
    const batch = mintPubkeys.slice(i, i + BATCH_SIZE);
    const infos = await mainnetConnection.getMultipleAccountsInfo(batch);

    for (let j = 0; j < infos.length; j++) {
      const info = infos[j];
      if (!info) continue;

      let mint;
      try {
        mint = unpackMint(batch[j], info, TOKEN_2022_PROGRAM_ID);
      } catch {
        continue; // Not a Token-2022 mint we can read; not an SGT.
      }

      const metadataPointer = getMetadataPointerState(mint);
      const groupMember = getTokenGroupMemberState(mint);

      const ok =
        metadataPointer?.metadataAddress?.toBase58() === SGT_METADATA_ADDRESS &&
        groupMember?.group?.toBase58() === SGT_GROUP_MINT_ADDRESS;

      if (ok) return mint.address.toBase58();
    }
  }
  return null;
}

/**
 * Checks whether `walletAddress` currently holds a Seeker Genesis Token.
 * Never throws for "no SGT" — only for actual RPC failure, so a transient
 * mainnet outage doesn't get silently recorded as "not a Seeker owner".
 */
export async function checkWalletForSGT(
  walletAddress: string,
): Promise<{ hasSgt: boolean; mintAddress: string | null }> {
  const owner = new PublicKey(walletAddress);

  const { value: tokenAccounts } = await mainnetConnection.getParsedTokenAccountsByOwner(
    owner,
    { programId: TOKEN_2022_PROGRAM_ID },
  );

  // A transferred-out SGT leaves its old token account open with a balance
  // of 0 — excluding zero-balance accounts is required, not optional, or
  // every wallet that ever held an SGT verifies as a current holder
  // forever. (Frozen accounts are NOT excluded: a legitimately held SGT
  // sits in a frozen ATA, since Solana Mobile holds the freeze authority.)
  const mintPubkeys = tokenAccounts
    .filter(
      (entry) => entry.account.data.parsed?.info?.tokenAmount?.amount !== "0",
    )
    .map((entry) => entry.account.data.parsed?.info?.mint)
    .filter((mint): mint is string => Boolean(mint))
    .map((mint) => new PublicKey(mint));

  const mintAddress = await findSgtMint(mintPubkeys);
  return { hasSgt: mintAddress !== null, mintAddress };
}
