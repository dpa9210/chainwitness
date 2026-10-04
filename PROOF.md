# ChainWitness — Proof Architecture

A precise, judge-auditable answer to: what's hashed, what's signed, what
lands on-chain, how timestamps are trusted, where images actually live, and
how anyone — not just this app — can verify a post from nothing but a
transaction signature. Every claim below links to the exact file and lines
that implement it, at commit
[`60908b8`](https://github.com/dpa9210/chainwitness/tree/60908b81369fd7f4866e3141d5ac177dbf76653e).

## 1. What's hashed

The raw bytes of the captured JPEG, as written to disk by the in-app
camera — nothing else (no EXIF, no filename, no location). SHA-256, computed
on-device.

`app/src/contentHash.ts:34-44` (`hashAndEncodePhoto`)

## 2. What's signed

Not the image, and not a bare hash — a small fixed-format string built from
the hash and the capture timestamp:

```
CHAINWITNESS_V1|<sha256-hex>|<capturedAtMs>
```

`app/src/contentHash.ts:22-27` (`buildSignedMessage`)

This string becomes the `data` of a single Solana Memo instruction. The
*transaction* is what actually gets signed — by the user's own wallet, via
Mobile Wallet Adapter's `signAndSendTransactions`, never by this app or its
backend. ChainWitness never has access to a private key at any point.

`app/src/solanaClient.ts:48-54` (memo instruction), `118-162`
(`authorizeAndSend` — the actual MWA sign+send call)

## 3. What's sent on-chain

A devnet transaction with exactly one instruction: a call to the canonical
SPL Memo program, `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`, carrying the
string from §2 as its instruction data. The transaction's fee payer is the
signing wallet itself — there is no separate relay, no backend-held fee
account.

That program ID was deliberately *not* taken from the `@solana/spl-memo` npm
package — version 0.3.0 of that package ships a different, incorrect,
upgradeable-loader-owned address. The ID used here was independently
confirmed against solana-program.com's own docs and a live devnet
`getAccountInfo` call (executable, owned by the non-upgradeable
`BPFLoader2`) before being hardcoded.

`app/src/solanaClient.ts:8-16, 35-37`

## 4. How timestamps are trusted — and the honest limit

The timestamp is **client-asserted at capture time**, embedded directly in
the signed memo (§2). Once that transaction is confirmed, the timestamp is
permanent and tamper-proof *after the fact* — nobody, including the
original poster, can later edit `capturedAtMs` without invalidating the
signature.

**What this does not do**: it does not cross-check `capturedAtMs` against
the transaction's own on-chain `blockTime`. A dishonest client could in
principle sign a memo claiming a timestamp earlier than when the
transaction was actually sent (it cannot claim a *later* one undetectably,
since the transaction has to exist by the time anyone checks it). This is a
real, acknowledged limitation of this build, not an oversight we're hiding —
closing it is straightforward (reject posts where `capturedAtMs` differs
from the transaction's `blockTime` by more than a few seconds) and is the
first thing we'd add in a v2. What the current design *does* guarantee
solidly: the content hash cannot be altered post-hoc, and the signature
cannot be forged by anyone other than the wallet holder.

`server/lib/solana.ts:76-91` (the backend check — matches memo text
exactly, but does not currently compare against `tx.blockTime`)

## 5. Where images actually live

The photo itself is **not** on-chain — only its hash is. The JPEG is
uploaded to Vercel Blob (public URL, content-addressed by post ID) purely
so the feed has something to render. If every server ChainWitness runs
disappeared tomorrow, the on-chain hash + signature would still be
independently checkable; only the *viewable feed* would be gone, not the
proof.

`server/lib/store.ts:30-42` (`uploadPhoto`), `44-48` (`savePost` — Upstash
Redis, metadata only)

## 6. How to verify a post from a transaction signature alone

This is the actual re-verification algorithm — anyone can run it against a
public devnet RPC, independent of ChainWitness's own backend:

1. `getTransaction(signature)` against devnet.
2. Confirm `tx.meta.err` is null (the transaction didn't fail on-chain).
3. Read the fee payer (first account key) — this is the proving wallet's
   address.
4. Find the instruction whose program ID is
   `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`; decode its data as UTF-8.
5. Parse it as `CHAINWITNESS_V1|<hash>|<timestamp>`.
6. Independently SHA-256 the photo in question and compare against `<hash>`.

Steps 1–5 are exactly what the backend does server-side before ever storing
a post — see `server/lib/solana.ts:37-93` (`verifyProof`), called from
`server/app/api/posts/route.ts:51-63` **before** the photo is uploaded or
the post is saved. A forged or tampered submission is rejected at this
point with a `422` and nothing is persisted.

## 7. Seeker-specific verification path

**Signing**: every proof and tip transaction is signed through Mobile
Wallet Adapter's `transact()` session (`app/src/solanaClient.ts:118-162`).
On a Seeker device with a Seed Vault–backed wallet, the private key never
leaves hardware — MWA hands the unsigned transaction to the wallet app,
which performs the actual signing inside Seed Vault and returns only the
signature. ChainWitness's code is identical whether the connected wallet is
Seed Vault-backed or a software wallet like Phantom/Solflare on a
non-Seeker phone — the hardware-backed guarantee comes from Seeker +
Seed Vault, not from any special-casing in this app.

**Seeker Genesis Token badge**: checked server-side only, against real
mainnet Token-2022 state — never trusted from a client-reported flag.

`server/lib/sgt.ts:49-76` (`findSgtMint`) — for every Token-2022 account the
target wallet holds with a non-zero balance, unpacks the mint and checks
**both** its metadata-pointer address and its token-group-member address
against the known Seeker Genesis Token constants
(`GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te`), independently confirmed
against Solana Mobile's own published reference implementation (linked in
the file header), not assumed from memory.

This check is deliberately lighter than Solana Mobile's full SGT-gating
pattern (no Sign-in-with-Solana nonce ceremony) — see the comment block at
the top of `server/lib/sgt.ts` for the specific reasoning: by the time this
check runs, the wallet has already proven key ownership via the on-chain
proof transaction itself (§2–3), so there's nothing left to gate. The badge
is decoration on an already-authenticated post, not a reward being granted.

## File map

| Concern | File |
|---|---|
| Content hashing | `app/src/contentHash.ts` |
| On-chain proof build + MWA signing | `app/src/solanaClient.ts` |
| Backend proof re-verification | `server/lib/solana.ts` |
| Post ingestion (ties it together) | `server/app/api/posts/route.ts` |
| Image/metadata storage | `server/lib/store.ts` |
| Seeker Genesis Token check | `server/lib/sgt.ts` |
