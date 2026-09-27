import { PublicKey } from "@solana/web3.js";

/** MWA account addresses are base64-encoded 32-byte public keys. */
export function toPublicKey(base64Address: string): PublicKey {
  return new PublicKey(Buffer.from(base64Address, "base64"));
}
