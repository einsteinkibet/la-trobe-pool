/**
 * payments.js — Stripe integration for UniPool.
 *
 * Design: real money only touches Stripe at the EDGES —
 *   - money IN:  rider tops up their wallet via Stripe Checkout (hosted).
 *   - money OUT: driver withdraws earnings via a Stripe Connect (Express) transfer.
 * The per-trip rider->driver escrow (hold on pay, release on "I rode") is an
 * internal wallet-ledger movement handled in server.js — NOT a Stripe charge per
 * trip (so Stripe's ~30c fixed fee never eats a small $3-8 fare).
 *
 * Everything here is gated on STRIPE_SECRET_KEY. When it's unset, `enabled` is
 * false and server.js returns 503 for /payments/* while the rest of the app
 * (internal balances) keeps working — handy for local/dev without keys.
 */

// --- Config (env-driven, sensible AU defaults) ---
const CURRENCY = (process.env.CURRENCY || 'aud').toLowerCase();
const PRICE_PER_KM = Number(process.env.PRICE_PER_KM || 0.5);
const MIN_FARE = Number(process.env.MIN_FARE || 3);
const PLATFORM_COMMISSION = Number(process.env.PLATFORM_COMMISSION || 0.1);
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');

const round2 = (n) => Math.round(n * 100) / 100;
const toCents = (dollars) => Math.round(dollars * 100);

// Fare for a trip given the rider's home->campus distance (km). Null distance
// (missing coords) falls back to the minimum fare.
const fareFor = (distanceKm) =>
  distanceKm == null ? MIN_FARE : Math.max(MIN_FARE, round2(distanceKm * PRICE_PER_KM));

// Split a fare into the driver's payout and the platform's commission.
const splitFare = (fare) => {
  const commission = round2(fare * PLATFORM_COMMISSION);
  return { commission, payout: round2(fare - commission) };
};

// --- Stripe client (runtime-configurable) ---
// Configured from env at load; an admin can also set the key via the UI (stored
// in the DB settings table), which calls configure() again at runtime.
const Stripe = require('stripe');
let stripe = null;
let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
let secretLast4 = null;
let configuredFromEnv = false;

function configure(secretKey, whSecret, { fromEnv = false } = {}) {
  if (secretKey) {
    stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    secretLast4 = String(secretKey).slice(-4);
    configuredFromEnv = fromEnv;
  } else {
    stripe = null;
    secretLast4 = null;
    configuredFromEnv = false;
  }
  if (whSecret !== undefined) webhookSecret = whSecret || '';
}
if (process.env.STRIPE_SECRET_KEY) {
  configure(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET, { fromEnv: true });
}

// Masked status for the admin UI — never exposes the full key.
const status = () => ({ enabled: !!stripe, secretLast4, hasWebhookSecret: !!webhookSecret, fromEnv: configuredFromEnv });

// Create a hosted Checkout session for a wallet top-up. Returns the Stripe
// session ({ id, url }); server.js stores the id for idempotent crediting.
async function createTopupSession({ userId, email, amount }) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: toCents(amount),
          product_data: { name: `UniPool wallet top-up ($${round2(amount)})` },
        },
      },
    ],
    // Wallet balance is stored value, so we (the platform) are the merchant of
    // record here — funds land in the platform balance, ready to pay drivers.
    metadata: { kind: 'topup', userId: String(userId), amount: String(amount) },
    success_url: `${APP_BASE_URL}/?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE_URL}/?topup=cancel`,
  });
}

const retrieveSession = (sessionId) => stripe.checkout.sessions.retrieve(sessionId);

// Create (once) an Express connected account for a driver's payouts.
async function getOrCreateConnectAccount(user) {
  if (user.stripeAccountId) return user.stripeAccountId;
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'AU',
    email: user.email,
    capabilities: { transfers: { requested: true } },
    business_type: 'individual',
    metadata: { userId: String(user.id) },
  });
  return account.id;
}

// Hosted onboarding link for a connected account.
const createAccountLink = (accountId) =>
  stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_BASE_URL}/?onboard=refresh`,
    return_url: `${APP_BASE_URL}/?onboard=done`,
    type: 'account_onboarding',
  });

async function getAccountStatus(accountId) {
  if (!accountId) return { chargesEnabled: false, payoutsEnabled: false };
  const a = await stripe.accounts.retrieve(accountId);
  return { chargesEnabled: !!a.charges_enabled, payoutsEnabled: !!a.payouts_enabled };
}

// Move earnings from the platform balance to the driver's connected account.
const createPayout = ({ accountId, amount }) =>
  stripe.transfers.create({
    amount: toCents(amount),
    currency: CURRENCY,
    destination: accountId,
  });

// Verify + parse a webhook event from the raw request body.
const constructEvent = (rawBody, signature) =>
  stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

module.exports = {
  configure,
  status,
  CURRENCY,
  PRICE_PER_KM,
  MIN_FARE,
  PLATFORM_COMMISSION,
  fareFor,
  splitFare,
  round2,
  createTopupSession,
  retrieveSession,
  getOrCreateConnectAccount,
  createAccountLink,
  getAccountStatus,
  createPayout,
  constructEvent,
};
// Live getters so `pay.enabled` / `pay.hasWebhookSecret` reflect runtime config.
Object.defineProperty(module.exports, 'enabled', { get: () => !!stripe });
Object.defineProperty(module.exports, 'hasWebhookSecret', { get: () => !!webhookSecret });
