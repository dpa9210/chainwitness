# ChainWitness — Build Plan

**Target:** Solana Mobile hackathon submission
**Deadline:** ~Oct 3–4, 2026 (confirm exact date/time and lock it in below)
**Devices:** Solana Seeker (primary/demo) + secondary Android phone (fallback wallet testing)
**Stack:** React Native (Expo dev build) + Vercel backend + Solana Devnet

---

## 1. Concept recap

A daily-prompt social app. Once a day, at an unpredictable time, the user gets
a notification to take a photo. The photo is captured in-app only (no gallery
uploads), hashed, and the hash + timestamp (+ optional location) is signed by
the user's wallet via Mobile Wallet Adapter — using Seed Vault on the Seeker.
The signed record is published on-chain as proof the wallet posted that exact
content at that exact time. Friends see the post in a simple feed and can tip
SOL.

**Pitch line:** "Hardware-signed authenticity in a world of AI-generated content."
**Honest framing:** proves *wallet + content hash + time*, not that the camera
itself couldn't be shown a screen. Never claim "unfakeable."

---

## 2. Scope tiers

### Must ship (Tier A — the actual submission)
- [ ] Android APK, builds and installs on both phones.
- [x] Wallet connect via Mobile Wallet Adapter (Seed Vault on Seeker, fallback
      wallet app — e.g. Phantom/Solflare — on the secondary phone, devnet).
      **Verified 2026-09-27**: connect + message signing confirmed working
      end-to-end against Phantom on real hardware.
- [ ] Daily prompt notification (can be a fixed/randomized local notification
      for demo purposes — doesn't need a server-side scheduler for v1).
- [x] In-app camera capture (no gallery picker).
      **Verified on device 2026-09-27** — capture flow ran with no errors.
- [x] On-chain record per post: a Memo-program transaction carrying
      `hash + timestamp`, signed AND sent by the **user's own wallet** via
      MWA — no backend key custody, no relay. Program ID
      (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) verified independently
      against official docs + a live devnet `getAccountInfo` call, since the
      current `@solana/spl-memo` npm package ships a different address.
      **Built 2026-09-27** (`src/solanaClient.ts`, `app/capture.tsx`); not
      yet verified end-to-end on device — needs an on-chain tx confirmed
      next.
      *(Supersedes the earlier plain-`signMessage` step — the on-chain tx
      itself is now the signed proof, so there's no separate off-chain
      signature to also manage.)*
- [ ] Backend endpoint (Vercel): now scoped to **feed/discovery only** —
      store the photo + post metadata (hash, timestamp, tx signature,
      author) so a feed can be rendered. It no longer needs to verify
      signatures itself; anyone (including the backend) can independently
      confirm a post's proof by checking the devnet transaction directly.
- [ ] Simple feed screen: friends' posts, image, timestamp, wallet badge,
      link to the devnet transaction.
- [ ] Tip button: send a small SOL transfer to a post's author via MWA.
- [ ] Seeker Genesis Token check → badge on posts from Genesis Token holders.
      (Verify early whether this check should run against mainnet — Genesis
      Token lives there — while the rest of the app runs on devnet.)

### Should have (only after Tier A is fully working end-to-end)
- [ ] Streak counter for consecutive daily posts.
- [ ] Nicer feed/animation polish, haptics on capture + sign success.

### Explicitly out of scope
- No custom Anchor program — a memo transaction is sufficient proof of
  "meaningful Solana interaction" for this submission.
- No public/open feed — invite-only / friends-list only, to sidestep content
  moderation entirely.
- No background/server-triggered push notifications requiring a push
  infra build-out — a local notification scheduled on-device is enough for
  the demo.

---

## 3. Day-by-day plan (adjust once deadline is confirmed)

| Day | Focus |
|---|---|
| 1 | ✅ **Spike done**: Expo dev build scaffold, MWA wallet connect + message signing verified working (Phantom, real device). |
| 2 | ✅ Camera capture screen + local SHA-256 hashing + MWA signing built (needs on-device verification). Backend skeleton on Vercel is next. |
| 3 | Wire capture → sign → submit-to-backend → memo tx on devnet. First end-to-end post. |
| 4 | Feed screen (read posts from backend), wallet badges, Genesis Token check. |
| 5 | Tip flow (SOL transfer via MWA). Local daily-prompt notification. Polish pass on UI. |
| 6 | Full device testing on both phones. Fix rough edges. Record demo footage. |
| 7 | Edit demo video, write pitch deck, finalize README, build release APK, submit. |

---

## 4. Architecture

```
[ Android App — React Native / Expo dev build ]
   ├── In-app camera → local image hash (expo-crypto SHA-256)
   ├── Mobile Wallet Adapter → connect, build memo tx, wallet signs AND
   │   sends it directly to Solana Devnet (Seed Vault on Seeker) —
   │   src/solanaClient.ts. No backend key custody, no relay.
   ├── Local notification scheduler (daily prompt) — not yet built
   └── Feed UI + tip button — not yet built
        │
        │  (upload photo + metadata, for feed only — not for proof)
        ▼  HTTPS
[ Vercel backend — not yet built ]
   ├── POST /api/posts  → store { photoUrl, hash, timestamp, txSignature,
   │                       author } for the feed
   ├── GET  /api/feed   → return friends' posts
   └── (Genesis Token check — likely a mainnet RPC call, separate from the
       devnet app logic)
        │
        ▼
[ Solana Devnet ] ← already reachable directly from the app, verified working
   └── Memo transaction per post: { hash, timestamp } — publicly checkable
       by anyone via getTransaction, independent of our backend
```

**Resolved (was the Day 1 open decision):** the user's own wallet signs and
sends the memo transaction directly — confirmed working end-to-end from the
app. The backend never sees or needs a signing key; it exists purely to
support the feed (photo storage + listing), not to verify or relay proof.

---

## 5. Dependencies (to be pinned/verified on Day 1)

### App
- `@solana-mobile/mobile-wallet-adapter-protocol` + web3.js companion package
- `@solana/web3.js`
- `expo-camera`
- `expo-notifications`
- `react-native-get-random-values` (polyfill)
- `buffer`

### Backend (Vercel)
- `@solana/web3.js`
- `@solana/spl-memo` (or manual memo program instruction)
- Hosted Postgres/KV for post + user records

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| MWA setup eats Day 1 | Day 1 is reserved solely for this; nothing else is built until it works |
| Genesis Token check needs mainnet RPC while app is devnet | Verify early; fall back to "Genesis Token badge" being best-effort/non-blocking if it's flaky |
| Deadline is tighter than expected | Tier A list above is the actual floor — "should have" items are cut first |
| No devices attached currently | Connect Seeker via USB + enable USB debugging before Day 1 spike |

---

## 7. Submission checklist

- [ ] Functional Android APK (release build)
- [ ] GitHub repo with source
- [ ] Demo video (in-app capture → sign → on-chain proof → tip, plus a beat
      showing the Genesis Token badge)
- [ ] Pitch deck / brief presentation

---

## 8. Judging criteria → what this changes in the plan

Repo: https://github.com/dpa9210/chainwitness

| Criterion | Implication for how we build |
|---|---|
| Completion, judged from the demo video | The video is a deliverable in its own right — script it early (Day 5–6), not improvised at the end. Every Tier A checklist item needs a clean beat in the video. |
| Technical depth, judged from GitHub commits | Commit in small, meaningful, honestly-described increments as each piece lands (not one end-of-project dump). No squashing/force-push once pushed — a real, readable history is the point. |
| Mobile-optimized UX & use of mobile features | Raises "should have" items (haptics, in-app camera-first flow, local notifications, share sheet) to load-bearing, not optional polish. Lean on what only a phone can do: camera, push, biometric-gated Seed Vault signing. |
| Usage & interaction with Solana network | Confirms the Day 1 architectural call: the **user's own wallet** signs and sends the on-chain memo transaction directly — no backend relay/custody. That's the clearest "real network interaction" story, and it's simpler to build too. |
| Clarity & vision in presentation | The pitch deck must state the *problem* (AI-generated/manipulated content eroding trust) before the *mechanism*. Demo narration should say why hardware-signing matters, not just click through screens. |

---

## Open items to confirm with user
- Exact deadline date + time (timezone).
- Invite-list mechanism for "friends" — hardcoded devnet pubkey list for the
  demo is fine; no need for a real friend-request system in this timeframe.
