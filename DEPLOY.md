# UniPool — Deployment Guide (soft-launch)

The app is two deployable pieces:

- **Backend** — Node/Express + SQLite (`backend/`), a long-running server.
- **Frontend** — a static React/Vite bundle (`dist/` after `npm run build`).

## 1. Backend

Runs anywhere that supports a persistent Node process **and a persistent disk**
(Render, Railway, Fly.io, a VPS). It is **not** suitable for a purely serverless
host because it uses an on-disk SQLite file and in-process token/geocode caches.

Required environment (see `backend/.env.example`):

| Var            | Purpose                                                        |
|----------------|---------------------------------------------------------------|
| `PORT`         | Listen port (host usually injects this).                       |
| `DB_PATH`      | Absolute path to the SQLite file on a **persistent** disk.     |
| `CORS_ORIGINS` | Comma-separated allowlist of your frontend origin(s). **Set this** — without it CORS allows every origin. |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` dev / `sk_live_…` prod). Unset = payments off (top-up/payout return 503; internal escrow still works). |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (from `stripe listen` or the Dashboard). Recommended. |
| `APP_BASE_URL` | Public frontend URL — Stripe redirects back here after Checkout/onboarding. |
| `PRICE_PER_KM` / `MIN_FARE` / `PLATFORM_COMMISSION` / `CURRENCY` | Fare pricing (defaults: 0.5 / 3 / 0.1 / aud). |

```bash
cd backend
npm install --omit=dev
DB_PATH=/data/data.db CORS_ORIGINS=https://YOUR-FRONTEND \
  STRIPE_SECRET_KEY=sk_test_... APP_BASE_URL=https://YOUR-FRONTEND node server.js
```

On first boot with an empty DB it seeds demo accounts (printed to the log). For a
real launch, delete the seed block or change the seed credentials in `db.js`.

### Payments model (Stripe)
Real money only touches Stripe at the **edges**: riders **top up** their wallet via
hosted **Stripe Checkout** (cards + Apple Pay + Google Pay), and drivers **withdraw**
earnings to their bank via **Stripe Connect (Express)**. The per-trip rider→driver
escrow (pay-to-hold, "I rode" to release, cancel to refund) moves **internally** in
the wallet ledger — no per-trip Stripe charge. To go live you need: a Stripe account,
an **ABN** (sole trader is fine), Connect enabled, and each driver onboarded via the
in-app "Set up payouts" flow. Test mode needs only a `sk_test_…` key. For webhooks in
dev: `stripe listen --forward-to localhost:3000/api/payments/webhook`.

## 2. Frontend

```bash
# point the bundle at your deployed backend, then build
echo 'VITE_API_URL=https://YOUR-BACKEND/api' > .env
npm install
npm run build          # outputs static files to dist/
```

Host `dist/` on any static host (Netlify, Vercel, Cloudflare Pages, S3+CDN).
`VITE_API_URL` is baked in at build time, so rebuild if the backend URL changes.

> The existing `.vercel/` folder points at an old, unrelated project — ignore or
> delete it and create a fresh project.

## 3. Pre-launch checklist

- [x] Passwords hashed (scrypt) — done.
- [x] CORS allowlist via `CORS_ORIGINS` — done.
- [x] Payments built (Stripe top-up + Connect payout + internal per-trip escrow).
- [ ] `CORS_ORIGINS` actually set to the real frontend origin in prod.
- [ ] `DB_PATH` on a persistent disk (verify data survives a redeploy).
- [ ] Seed/demo accounts removed or credentials changed for a public launch.
- [ ] HTTPS in front of both (host-provided).
- [ ] Stripe: set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `APP_BASE_URL`;
      register an ABN and switch test → live keys; each driver completes payout setup.
