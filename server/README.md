# ChainWitness backend

Feed/discovery API for the ChainWitness mobile app. It does **not** hold any
signing key and does **not** verify signatures itself — the on-chain memo
transaction (built and sent client-side by the user's own wallet) is the
actual proof. This backend's only jobs are:

1. Independently re-check that proof against devnet before accepting a post
   (`lib/solana.ts`), so nobody can POST fabricated metadata with an
   unrelated or missing transaction.
2. Store the photo (Vercel Blob) and post metadata (Upstash Redis) so a feed
   can be rendered without every client re-scanning devnet itself.

## Endpoints

- `POST /api/posts` — body `{ authorPubkey, imageBase64, imageHash, capturedAtMs, txSignature }`.
  Verifies the transaction on devnet, uploads the photo, stores the record.
  Returns `{ post }` (201) or `{ error }` (400/422/502).
- `GET /api/feed?limit=20` — returns `{ posts: Post[] }`, newest first.

## Infrastructure (Vercel project `chainwitness-api`, org `dt-eam8`)

- **Blob store**: `chainwitness-photos` — created and linked.
- **Redis**: Upstash for Redis (Marketplace integration) — installation
  requires accepting Upstash's terms in the browser once, as the account
  owner, before the CLI can finish provisioning:
  1. Visit the URL printed by `npx vercel integration add upstash/upstash-kv`
     (or find it under Vercel dashboard → Integrations → Marketplace).
  2. Accept Upstash's terms.
  3. Re-run `npx vercel integration add upstash/upstash-kv` to finish.
  4. Run `vercel env pull .env.local` to fetch the resulting
     `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

- **GitHub auto-deploy**: not yet connected — `vercel link` couldn't attach
  the `dpa9210/chainwitness` repo because this Vercel account has no GitHub
  login connection yet (Vercel dashboard → Account Settings → Login
  Connections). Not required to deploy; without it, ship with `vercel deploy
  --prod` instead of push-to-deploy.

## Local development

```bash
npm install
vercel env pull .env.local   # after the Redis integration is accepted
npm run dev
```

## Deploying

```bash
vercel deploy --prod
```

## Mobile app config

Once deployed, point the app at the live URL (see the app's environment/config
— not yet wired up as of this writing; the app currently has no backend calls,
since Day 3 shipped the on-chain proof flow before the feed).
