/**
 * Builds and submits the on-chain proof for a post: a devnet transaction
 * carrying a Memo instruction with {imageHash, timestamp}, signed and sent
 * by the *user's own wallet* via Mobile Wallet Adapter — no backend key
 * custody, no relay. The transaction signature returned here is the public,
 * verifiable proof that this wallet posted this exact content at this time.
 *
 * MEMO_PROGRAM_ID below is the canonical SPL Memo program
 * (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`), verified independently
 * against solana-program.com's own docs AND a live devnet getAccountInfo
 * call (executable, owned by the non-upgradeable BPFLoader2) before use —
 * the current @solana/spl-memo npm package (v0.3.0) ships a *different*,
 * upgradeable-loader-owned address that is not this canonical program, so we
 * deliberately do not depend on that package and inline the instruction
 * builder ourselves instead.
 */
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

import type { ConnectedAccount } from "./mwaClient";
import { getAuthToken, setAuthToken } from "./mwaSession";
import { toPublicKey } from "./solanaAddress";

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const CHAIN = "solana:devnet";
const APP_IDENTITY = {
  name: "ChainWitness",
  uri: "https://chainwitness.app",
  icon: "favicon.ico",
};

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

function createMemoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(pubkey: PublicKey): string {
  return `https://explorer.solana.com/address/${pubkey.toBase58()}?cluster=devnet`;
}

/**
 * A wallet with 0 devnet SOL can't pay the transaction fee. Phantom's own
 * "sign and send" screen may simulate the transaction and stall or show a
 * quiet failure state on the wallet side rather than surfacing a clean
 * error back to us — so we check and top the account up *before* ever
 * asking the wallet to sign anything, rather than debugging a stuck wallet
 * screen after the fact.
 */
export async function getBalanceSol(pubkey: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(pubkey, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

export async function requestDevnetAirdrop(pubkey: PublicKey): Promise<void> {
  const signature = await connection.requestAirdrop(pubkey, LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash("confirmed");
  const result = await connection.confirmTransaction(
    { signature, ...latest },
    "confirmed",
  );
  if (result.value.err) {
    console.warn("[ChainWitness] devnet airdrop failed:", result.value.err);
    throw new Error(
      "Airdrop failed — devnet's public faucet is rate-limited. Wait a minute and try again, or use https://faucet.solana.com.",
    );
  }
}

export type ProofResult = {
  signature: string;
  /**
   * Whichever account actually authorized and signed *this* session — see
   * note below on why this can differ from the account passed in.
   */
  account: ConnectedAccount;
};

/**
 * Opens an MWA session, reauthorizes with the cached auth_token, builds a
 * single-instruction memo transaction, and asks the wallet to sign AND
 * broadcast it. Returns the transaction signature once the wallet accepts
 * it (not necessarily finalized on-chain yet — see confirmTransaction).
 *
 * The fee payer is always taken from *this session's own* authorize()
 * response, never from the `account` passed in. If the OS routes this
 * transact() call to a different wallet app than the one that produced the
 * cached account (e.g. the user switched their default wallet, or
 * uninstalled the previous one), the stale `auth_token` won't apply and the
 * wallet returns a fresh account — using that instead of the stale one
 * means the transaction's fee payer always matches whichever wallet is
 * actually about to sign it. The caller should treat the returned
 * `account` as the new source of truth (see walletContext.tsx).
 */
export async function submitProofToChain(
  account: ConnectedAccount,
  memo: string,
): Promise<ProofResult> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  return transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      chain: CHAIN,
      identity: APP_IDENTITY,
      auth_token: getAuthToken(),
    });
    setAuthToken(authResult.auth_token);

    const signer = authResult.accounts[0];
    const signerAccount: ConnectedAccount = {
      address: signer.address,
      publicKey: toPublicKey(signer.address),
      label: signer.label,
    };

    if (signer.address !== account.address) {
      console.warn(
        "[ChainWitness] Signing wallet changed since last connect:",
        `was ${account.publicKey.toBase58()}, now ${signerAccount.publicKey.toBase58()}`,
      );
    }

    const transaction = new Transaction({
      feePayer: signerAccount.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(createMemoInstruction(memo));

    const signatures = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });

    return { signature: signatures[0], account: signerAccount };
  });
}

export async function confirmTransaction(signature: string): Promise<boolean> {
  const latest = await connection.getLatestBlockhash("confirmed");
  const result = await connection.confirmTransaction(
    { signature, ...latest },
    "confirmed",
  );
  return !result.value.err;
}
