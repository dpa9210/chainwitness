/**
 * Thin wrapper around the Mobile Wallet Adapter protocol for the Day 1 spike.
 *
 * Every `transact()` call opens a fresh MWA session (it launches the wallet
 * app / Seed Vault via intent and waits for the user). Within that session we
 * always call `authorize()` first: if we already hold an `auth_token` from a
 * previous session we pass it along so the wallet can skip re-prompting the
 * user for full approval (this is what the MWA spec calls "reauthorize").
 *
 * `authToken` is kept in memory only for this spike — it resets when the app
 * restarts. Persisting it (AsyncStorage) is a Day 2 task, not needed to prove
 * the signing flow works end to end.
 */
import { PublicKey } from "@solana/web3.js";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const APP_IDENTITY = {
  name: "Proof of Real",
  uri: "https://proofofreal.app",
  icon: "favicon.ico",
};

// Devnet for the entire build — see PLAN.md.
const CHAIN = "solana:devnet";

let authToken: string | undefined;

export type ConnectedAccount = {
  address: string; // base64-encoded, as returned by the wallet
  publicKey: PublicKey;
  label?: string;
};

function toPublicKey(base64Address: string): PublicKey {
  return new PublicKey(Buffer.from(base64Address, "base64"));
}

/**
 * Opens an MWA session and authorizes (or reauthorizes) the connected
 * wallet. Returns the first authorized account.
 */
export async function connectWallet(): Promise<ConnectedAccount> {
  return transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      chain: CHAIN,
      identity: APP_IDENTITY,
      auth_token: authToken,
    });

    authToken = authResult.auth_token;

    const account = authResult.accounts[0];
    return {
      address: account.address,
      publicKey: toPublicKey(account.address),
      label: account.label,
    };
  });
}

/**
 * Opens a fresh MWA session, reauthorizes using the cached auth_token, and
 * asks the wallet (Seed Vault on the Seeker) to sign an arbitrary message.
 * Returns the raw signature bytes.
 */
export async function signMessage(
  account: ConnectedAccount,
  message: string,
): Promise<Uint8Array> {
  const payload = new TextEncoder().encode(message);

  return transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      chain: CHAIN,
      identity: APP_IDENTITY,
      auth_token: authToken,
    });

    const signedMessages = await wallet.signMessages({
      addresses: [account.address],
      payloads: [payload],
    });

    return signedMessages[0];
  });
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
