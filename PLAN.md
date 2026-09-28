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
- [x] Daily prompt notification (can be a fixed/randomized local notification
      for demo purposes — doesn't need a server-side scheduler for v1).
      See the detailed entry under "Should have" below (built 2026-09-28) —
      left the original scope note here since this item started as Tier A.
- [x] In-app camera capture (no gallery picker).
      **Verified on device 2026-09-27** — capture flow ran with no errors.
- [x] On-chain record per post: a Memo-program transaction carrying
      `hash + timestamp`, signed AND sent by the **user's own wallet** via
      MWA — no backend key custody, no relay. Program ID
      (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) verified independently
      against official docs + a live devnet `getAccountInfo` call, since the
      current `@solana/spl-memo` npm package ships a different address.
      **Verified on device 2026-09-27** with Solflare (devnet, faucet-funded)
      — post signed and sent successfully. First attempt (Phantom, 0 SOL
      balance) stalled on Phantom's own approval screen; fixed with a
      Home-screen balance check + one-tap devnet airdrop and a 90s timeout
      so a genuine stall now fails loudly instead of hanging. Also fixed a
      real bug this surfaced: the transaction's fee payer is now always
      taken from whichever wallet *actually authorizes that session*, not a
      possibly-stale cached account — matters if the user switches wallet
      apps between sessions (as happened here, Phantom → Solflare).
      *(Supersedes the earlier plain-`signMessage` step — the on-chain tx
      itself is now the signed proof, so there's no separate off-chain
      signature to also manage.)*
- [x] Backend endpoint (Vercel, `server/`): scoped to **feed/discovery
      only** — stores the photo + post metadata so a feed can be rendered.
      `POST /api/posts` (re-verifies the proof against devnet independently
      before storing anything — never trusts the client) and `GET
      /api/feed`. Deployed to `https://chainwitness-api.vercel.app` (Vercel
      project `chainwitness-api`, Blob store + Upstash Redis both live).
      **Verified end-to-end on device 2026-09-27**: a real capture went
      on-chain, the backend independently re-verified it, the photo landed
      in Blob storage (confirmed viewable), and the post appeared correctly
      in the live feed. The full pipeline — camera → hash → wallet signs
      and sends on devnet → backend re-verifies → stored → listed — is
      confirmed working with real data, not just a synthetic test.
- [x] Simple feed screen: posts, image, timestamp, wallet badge, link to
      the devnet transaction. **Built 2026-09-27** (`app/feed.tsx`) —
      pull-to-refresh, refetches on focus, uses expo-image for the photo
      grid. No wallet connection required just to browse. **Confirmed
      rendering correctly on device 2026-09-27** (after the expo-image
      native rebuild).
      *(No "friends" filtering yet — shows everyone's posts. Deferred:
      per-viewer curation wasn't in scope for this pass.)*
- [x] Tip button: send a small SOL transfer to a post's author via MWA.
      **Built 2026-09-27** (`solanaClient.sendTip`, wired into
      `app/feed.tsx`) — fixed 0.01 SOL, signed and sent by the tipper's own
      wallet (same no-custody `authorizeAndSend` core the proof flow uses,
      refactored out so both share the fee-payer self-healing logic
      instead of duplicating it). Hidden on your own posts; prompts to
      connect first if no wallet is active. Not yet confirmed on-device.
- [x] Seeker Genesis Token check → badge on posts from Genesis Token
      holders. **Built 2026-09-27** (`server/lib/sgt.ts`, checked once at
      post-creation time, stored on the post record as `hasSgt`, rendered
      as a small badge in `app/feed.tsx`).
      - Confirmed against mainnet against Solana Mobile's real Token-2022
        constants (metadata pointer + token group member, both must
        match), fetched directly from their own reference implementation
        rather than assumed — the Genesis Token indeed only exists on
        mainnet, confirming the Day 1 risk note above.
      - **Deliberately lighter than Solana Mobile's full SGT verification
        pattern**: their reference design adds a Sign-in-with-Solana step
        (server-issued nonce + signature check) on top of the mint check,
        because it's built for *gating rewards* — there, a bare "this
        address holds an SGT" claim could be submitted by anyone about
        anyone else's address. That doesn't apply here: `authorPubkey` is
        already proven to control the signing key by the on-chain proof
        transaction itself (see lib/solana.ts) before the SGT check ever
        runs, and the badge grants nothing — it's decoration on an
        already-authenticated post. So: no SIWS ceremony, just the
        mainnet mint check, run server-side only (never trust a
        client-reported badge).
      - Tested against real mainnet data, not synthetic: the wallet that
        posted ChainWitness's first real post genuinely holds a Seeker
        Genesis Token (confirmed `hasSgt: true` with a real mint address),
        and a negative-control address correctly returned `false`. The
        existing post was backfilled with the correct value.
      - Check is non-fatal — a mainnet RPC failure during posting logs a
        warning and defaults the badge to false rather than rejecting an
        otherwise-valid, already-verified post.
- [x] User-facing errors are plain English, not raw error codes/objects.
      **Built 2026-09-27** (`src/friendlyError.ts`) — maps MWA's typed error
      codes, common web3.js errors (expired blockhash, send/simulate
      failures), and network errors to short actionable sentences; anything
      unrecognized falls back to a generic "Something went wrong" rather
      than leaking a stack trace, while the raw error is still logged via
      console.warn for our own debugging.

- [x] Daily prompt notification. **Built 2026-09-28** (`app/src/dailyPrompt.ts`,
      wired into `app/app/settings.tsx` and `app/app/_layout.tsx`) — a pure
      on-device local schedule via `expo-notifications`, no server-side
      scheduler (per the explicit Tier A note that this doesn't need one for
      v1).
      - Settings screen gained a "Daily reminder" toggle + a row of time
        presets (9am/1pm/6pm/9pm); toggling on requests notification
        permission (needed at runtime on Android 13+, handled automatically
        via the module's own manifest permission once the config plugin is
        registered) and arms a recurring `DAILY` trigger. No separate
        persisted on/off setting — the scheduled trigger itself, read back
        from the OS via `getAllScheduledNotificationsAsync()`, is the single
        source of truth for what's actually armed, so the UI can't drift
        out of sync with reality.
      - "Send test notification now" button fires a one-off notification a
        few seconds out, so a demo (or the user) can see exactly what it
        looks like without waiting for the scheduled time to arrive.
      - Tapping the notification (cold start or warm) routes straight to
        the capture screen, handled in the root layout via
        `getLastNotificationResponseAsync` (cold start) and
        `addNotificationResponseReceivedListener` (warm), gated on a
        `data: { kind: "daily-prompt" }` marker so this only fires for our
        own notification, not any future notification type.
      - `expo-notifications` was already an unused dependency in
        `package.json` from Day 1 planning but had never been added to the
        `app.json` plugins list or referenced in code — confirmed via the
        generated `android/build/generated/autolinking/autolinking.json`
        that it wasn't actually linked into the last native build. Added
        the config plugin (notification icon: the existing monochrome
        adaptive-icon asset, already alpha-masked correctly for a status-bar
        icon; accent color `#8a6fe8` to match the app's existing purple
        accent). **Needs a native rebuild** (`npm run android`) — this is a
        genuinely new native module entering the build this time, not just
        a config change.
      - Lint was run for the first time on this project this round
        (`expo lint` had never been invoked before — it bootstrapped its own
        config on first run) and caught a handful of pre-existing
        unescaped-apostrophe / non-"simple-expression" hook-dependency
        issues unrelated to this feature; fixed all of them alongside the
        new code so the project now lints clean rather than leaving mixed
        signal for the next real lint run.

### Should have (only after Tier A is fully working end-to-end)
- [ ] Streak counter for consecutive daily posts.
- [ ] Nicer feed/animation polish, haptics on capture + sign success.
- [x] Visual polish pass. **Built 2026-09-27**: TikTok-style redesign, by
      user request, once the backend + feed were confirmed working —
      - **Feed is now the app's front door** (`app/index.tsx`): a
        full-screen vertical pager (one post per screen, snap-to-page),
        photo filling the whole screen, no native header. Author, badge,
        timestamp, and the tip action float as overlays on top of the
        photo instead of sitting in a scrolling card.
      - **Persistent bottom tab bar**: home/refresh icon, a large elevated
        circular **+** button dead-center for New Post (the "TikTok
        create button"), settings gear on the right. Icons via
        `@expo/vector-icons` (Ionicons) — no new native module, since it
        only needs `expo-font`, already linked since Day 1.
      - **Settings screen** (`app/settings.tsx`, new): wallet
        connect/reconnect, balance + airdrop, and the debug log/sign-test
        tools all moved here, out of the feed entirely, per user request.
      - `app/feed.tsx` retired — its content became the new `index.tsx`.
      - Status bar set to light content + `userInterfaceStyle: "dark"`
        app-wide, so system UI doesn't disappear against the dark,
        photo-filled screens.
      - **Needs a native rebuild** (`npm run android`) before testing —
        not because of a new native module this time, but because
        `userInterfaceStyle` is a native-config change (Android theme),
        which only takes effect through Continuous Native Generation on a
        full rebuild, same requirement as a new native module for a
        different reason.

      **2026-09-28 — on-device testing found a real bug and drove a design
      pivot, both fixed same day:**
      - **Bug**: opening the app fresh, tapping New Post with no wallet
        connected, connecting from the Settings prompt, then returning to
        Capture showed a permanently blank camera; taking a photo failed
        with a generic error. Root cause: `CameraView` was mounted purely
        based on `account` being present, with no check on whether the
        screen was actually the visible/focused route. Connecting a
        wallet launches an external wallet app (Phantom/Solflare) via an
        Android intent, which backgrounds/resumes this app's Activity;
        the resulting `account` update reaches every mounted consumer via
        context regardless of visibility, so Capture (still mounted,
        hidden behind Settings) rendered its camera branch for the first
        time while off-screen. Android's native camera preview surface
        never properly attached having been created while occluded, and
        `takePictureAsync()` against that broken session is what produced
        the generic error. **Fixed**: `app/capture.tsx` now gates
        `CameraView` mounting on `useFocusEffect`-tracked screen focus in
        addition to `account`, so the camera is only ever created while
        the screen is genuinely visible.
      - **Design pivot, by user request**: the TikTok-style one-post-per-
        screen swipe pager didn't fit — moved to an **Instagram-style**
        scrollable feed instead. `app/index.tsx` is back to a normal
        scrolling list of cards (author row above a 4:5 photo, tap
        anywhere to open); a new dynamic route `app/post/[id].tsx` shows
        the full-screen detail view (bigger image, badge, proof link, tip
        button) that used to be inline per feed item. Posts are handed to
        the detail screen via a small in-memory cache
        (`src/feedCache.ts`) populated when the feed loads, rather than a
        new backend endpoint — noted as the thing to build properly if
        deep-linking to a single post ever becomes a real requirement.
      - **Capture screen redesigned** per explicit feedback: the camera
        preview is now genuinely full-bleed (no padded container), with a
        circular camera-app-style shutter button floating above the
        bottom edge (safe-area inset + extra margin) instead of a plain
        `<Button>` in a row flush against it. Both Capture and the new
        post detail screen lost their native header in favor of an
        overlaid circular close (×) button, consistent with the
        edge-to-edge look everywhere else.
      - **Confirmed on device 2026-09-28**: the focus-mounting bug fix
        works — the exact repro scenario (fresh open → New Post →
        connect from prompt → return) now shows a working camera.

      **Same day, two more findings from that device test:**
      - **Not a ChainWitness bug**: posting failed with a wallet-reported
        network mismatch ("transaction is for mainnet" while the wallet
        was believed to be on devnet). Re-audited every chain reference in
        the client app — `grep -rn mainnet app/src app/app` returns
        nothing; `CHAIN = "solana:devnet"` is the only value ever passed
        to `authorize()`, in both `mwaClient.ts` and `solanaClient.ts`.
        The MWA protocol gives no field in `AuthorizationResult` that
        echoes back which network a wallet actually granted, so this
        can't be verified or corrected from our side — it's the connected
        wallet app's *own*, separate network setting (Phantom/Solflare
        have one independent of anything a dApp requests). Added a
        `friendlyError.ts` pattern for this so it reads as an actionable
        message pointing at the wallet app's own settings instead of a
        generic failure, plus a standing reminder on the Settings screen.
      - **Feed readability**: with no card background, posts were hard to
        tell apart on the dark screen. Each post is now a real card —
        `#16161f` background against the `#0d0d12` screen, rounded
        corners, a hairline border, and real margin between cards —
        instead of content sitting directly on the same background as
        everything else.

      **2026-09-28, second device-test pass — a systemic bug across every
      screen, plus the Genesis Token badge icon:**
      - **Bug, affecting every screen**: `SafeAreaView` was imported from
        `"react-native"` everywhere, not `"react-native-safe-area-context"`.
        RN's own built-in `SafeAreaView` is effectively a no-op on
        Android — it only does anything on iOS — so every screen's top
        content sat flush under the status bar (the Home title mixing
        with notification icons; the post detail screen's close button
        and photo crowding the status bar/camera cutout) and bottom
        content sat flush against the gesture-nav zone (the tip button
        "too far at the bottom"). Fixed across all four screens
        (`index.tsx`, `settings.tsx`, `capture.tsx`, `post/[id].tsx`) by
        importing `SafeAreaView`/`useSafeAreaInsets` from
        `react-native-safe-area-context` instead — the package
        `capture.tsx` was already correctly using for its shutter/close
        button positioning, which is why that screen didn't show the bug.
        Also added a translucent top scrim behind the post detail
        screen's close button, since full-bleed photo under system UI is
        a standard pattern (Instagram/TikTok/Snapchat all do it) but
        normally paired with a scrim/gradient for legibility against
        arbitrary photo content, which was missing.
      - **Genesis Token badge icon**: replaced the plain "Seeker ✓" text
        checkmark with the actual Solana logomark (`src/SeekerBadge.tsx`,
        asset at `app/assets/badges/solana-mark.png`) — sourced from
        Solana Labs' own `token-list` GitHub repo (the standard wrapped-
        SOL token icon), background keyed out to transparent since the
        source asset ships on solid black. No Seeker-specific logo was
        used — Solana Mobile doesn't publish one as a generic icon-font
        glyph or open asset the way Solana's own mark is commonly used
        across the ecosystem.
      - No new native module this round (`react-native-safe-area-context`
        was already linked; a static PNG needs no native code) — no
        rebuild needed, confirmed via `expo-doctor`.

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
   ├── Local notification scheduler (daily prompt) — built 2026-09-28
   └── Feed UI + tip button — built
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
| Any new native-module dependency (expo-image was the first case, 2026-09-27) breaks the app on-device with "Cannot find native module" until rebuilt | This isn't a code bug — the installed dev client APK predates the new native code. Run `npm run android` again after adding any package with native code (check `expo-module.config.json` in the package, or just try it) before assuming something's broken. |

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
