/**
 * Turns whatever the wallet adapter, web3.js, or our own code throws into a
 * short sentence a non-developer can act on. The raw error is always logged
 * via console.warn first, so nothing is lost for our own debugging — it's
 * just never shown to the user directly.
 */
import {
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from "@solana/web3.js";
import {
  SolanaMobileWalletAdapterError,
  SolanaMobileWalletAdapterErrorCode,
  SolanaMobileWalletAdapterProtocolError,
  SolanaMobileWalletAdapterProtocolErrorCode,
} from "@solana-mobile/mobile-wallet-adapter-protocol";

// Messages we wrote ourselves elsewhere in the app — already plain English,
// so pass them through as-is instead of re-wrapping them.
const OWN_MESSAGE_PREFIXES = [
  "Connect a wallet before",
  "Wallet didn't respond in time",
  "Airdrop failed —",
  "ChainWitness needs",
];

export function toFriendlyMessage(err: unknown): string {
  console.warn("[ChainWitness] raw error:", err);

  if (err instanceof SolanaMobileWalletAdapterError) {
    switch (err.code) {
      case SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND:
        return "No compatible Solana wallet app was found. Install Phantom or Solflare and try again.";
      case SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED:
        return "Cancelled — you closed the wallet before approving.";
      case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT:
        return "Your wallet took too long to respond. Please try again.";
      case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED:
        return "The connection to your wallet closed unexpectedly. Please try again.";
      default:
        return "Something went wrong talking to your wallet app. Please try again.";
    }
  }

  if (err instanceof SolanaMobileWalletAdapterProtocolError) {
    switch (err.code) {
      case SolanaMobileWalletAdapterProtocolErrorCode.ERROR_AUTHORIZATION_FAILED:
        return "Wallet connection was declined.";
      case SolanaMobileWalletAdapterProtocolErrorCode.ERROR_NOT_SIGNED:
        return "You declined the request in your wallet.";
      case SolanaMobileWalletAdapterProtocolErrorCode.ERROR_NOT_SUBMITTED:
        return "Your wallet couldn't submit this. Check it has enough devnet SOL to pay the fee, then try again.";
      default:
        return "Your wallet rejected this request. Please try again.";
    }
  }

  if (
    err instanceof TransactionExpiredBlockheightExceededError ||
    err instanceof TransactionExpiredTimeoutError
  ) {
    return "This request took too long and expired. Please try again.";
  }

  if (err instanceof SendTransactionError) {
    return "The network rejected this transaction. Check your wallet has enough devnet SOL, then try again.";
  }

  const message = err instanceof Error ? err.message : String(err);

  if (OWN_MESSAGE_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return message;
  }
  if (/no photo uri/i.test(message)) {
    return "The camera didn't capture a photo. Please try again.";
  }

  if (/network request failed|ECONNRESET|ETIMEDOUT|fetch/i.test(message)) {
    return "Couldn't reach the Solana network. Check your connection and try again.";
  }
  if (/insufficient/i.test(message)) {
    return "Your wallet doesn't have enough devnet SOL to pay the transaction fee.";
  }
  if (/blockhash/i.test(message)) {
    return "This request took too long and expired. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
