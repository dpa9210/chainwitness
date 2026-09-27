# Project Plan: Solana GeoBlinks (Mobile & Backend Architecture)
## Target: Solana Mobile (Seeker / Standard Android) Hackathon
**UI Framework:** React Native with Material Design (via React Native Paper)
**Environment:** Solana Devnet

---

## 📅 1. Execution Timeline & Phases

### Phase 1: Setup & Environment Prep (Day 1)
- [ ] Initialize React Native (Expo or Bare Workflow) project.
- [ ] Install Solana Mobile Stack (SMS) and Mobile Wallet Adapter (MWA) packages.
- [ ] Install `react-native-paper` and `react-native-vector-icons` for Material Design UI.
- [ ] Set up Next.js repository for the Blink/Actions API server.

### Phase 2: Core Backend - The Solana Action (Day 1-2)
- [ ] Deploy Next.js route for `api/actions/geoblink`.
- [ ] Implement `GET` endpoint responding with standard Action UI payload.
- [ ] Implement `POST` endpoint validating custom incoming location payloads and building the Devnet SOL transfer transaction.
- [ ] Deploy backend to a public URL (Vercel/Ngrok) so it can be picked up by Solana clients (e.g., Phantom/Dialect).

### Phase 3: Android App - Location & Wallet Integration (Day 2-3)
- [ ] Integrate React Native Geolocation API to fetch current latitude, longitude, and accuracy metrics.
- [ ] Connect `@solana-mobile/mobile-wallet-adapter-protocol` to request wallet pairing.
- [ ] Build the cryptographic payload wrapper: `hash(GPS + Timestamp)`.
- [ ] Trigger wallet signing for the location string using the user's private key (routing to Seeker Seed Vault natively or falling back to standard wallet apps).

### Phase 4: UI Polishing & Material Design (Day 3-4)
- [ ] Implement Material Design 3 theme via `Provider` from `react-native-paper`.
- [ ] View 1: Creator Dashboard (Input coordinates, set up a new GeoBlink perimeter).
- [ ] View 2: User Check-in Screen (Large action button, location validation status bar, signature trigger).
- [ ] View 3: Success Screen containing the shareable Solana Blink URL wrapper.

### Phase 5: Testing & Video Demo Capture (Day 4-5)
- [ ] Test end-to-end flow using the secondary standard Android device.
- [ ] Move codebase onto the Solana Seeker device to ensure Seed Vault compatibility.
- [ ] Record high-fidelity video showcasing the Seeker UI, the physical location trigger, and the instant Devnet token execution via a Blink interface.

---

## 🏗️ 2. Comprehensive System Architecture

```
[ React Native Android Client ]
        │
        ├── (1) Fetches precise GPS (Latitude / Longitude) via Core Location API
        ├── (2) Requests signature for Location Payload via MWA (Seed Vault / Mobile Wallet)
        │
        ▼
[ POST /api/actions/geoblink ] ──► Validates payload signature & geographic fence
        │
        ▼ (If Validated)
[ Generates Solana Transaction ] ──► Transfers 0.1 Devnet SOL from master faucet to user wallet
        │
        ▼
[ Blink Card Interface ] ──► Renders interaction natively inside Phantom/Dialect/X.com feeds
```

---

## 📦 3. Precise Dependencies (`package.json`)

### React Native App Dependencies
```json
{
  "dependencies": {
    "@solana-mobile/mobile-wallet-adapter-protocol": "^2.1.2",
    "@solana/web3.js": "^1.95.3",
    "react-native-paper": "^5.12.0",
    "react-native-vector-icons": "^10.1.0",
    "react-native-geolocation-service": "^5.3.1",
    "buffer": "^6.0.3",
    "fast-text-encoding": "^1.0.6"
  }
}
```

### Next.js Blink Server Dependencies
```json
{
  "dependencies": {
    "@solana/actions": "^1.6.4",
    "@solana/web3.js": "^1.95.3"
  }
}
```

---

## 🤖 4. Claude AI Coding Prompts

Copy and paste these prompts directly into Claude to generate your code files:

### Prompt 1: The Material Design App Interface
> "Write a React Native functional component using `react-native-paper` (Material Design 3). It should feature a clean, user-centric dashboard containing: a card showing current GPS coordinates (latitude, longitude, accuracy), a status indicator for 'Location Authorization', a prominent floating action button (FAB) titled 'Verify & Check-In', and a hidden logs layout for debugging Solana Devnet connections. Use proper Material Design themes and typography."

### Prompt 2: Mobile Wallet Adapter (MWA) Signature Bridge
> "Write a TypeScript utility function for a React Native app that integrates `@solana-mobile/mobile-wallet-adapter-protocol` and `@solana/web3.js`. The function must connect to a local Android wallet (utilizing the Solana Seeker Seed Vault if present), request authorization for a devnet account, take a message payload containing text string format `LAT_LNG_TIMESTAMP`, ask the wallet to sign that message, and return the public key along with the base58 encoded signature."

### Prompt 3: The Complete Location Validator Blink Server
> "Write a Next.js API route (`route.ts`) implementing the official `@solana/actions` SDK. The `GET` endpoint must serve metadata for a location-gated reward card ('Seeker GeoBlink'). The `POST` endpoint must receive an account public key, read a signature verification string sent in the custom headers or body metadata, verify that the transaction is being requested inside a valid geolocation tier, and build a `SystemProgram.transfer` transaction dispatching 0.1 SOL on Devnet from a master faucet keypair to the user."
