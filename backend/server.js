/**
 * car-pool backend — API server backed by SQLite (better-sqlite3).
 *
 * Implements every endpoint the React frontend (src/utils/api.js) calls.
 * Phase 0 of the route-centric rebuild swapped the old in-memory store for a
 * durable SQLite database (see db.js): data now survives a restart, but every
 * response shape is unchanged. better-sqlite3 is synchronous, so the handler
 * bodies stay synchronous — the only difference from the old version is that
 * reads/writes go through the `store` accessor instead of a plain JS object.
 *
 * Vite proxies /api -> http://localhost:3000 (see ../vite.config.js), so all
 * routes here are mounted under /api.
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const store = require('./db');
const pay = require('./payments');

// If Stripe wasn't configured via env, load an admin-entered key from settings.
if (!pay.status().enabled) {
  const k = store.getSetting('stripe_secret_key');
  if (k) pay.configure(k, store.getSetting('stripe_webhook_secret') || undefined);
}

const PORT = process.env.PORT || 3000;
const app = express();

// CORS: in production, restrict to an explicit allowlist from CORS_ORIGINS
// (comma-separated, e.g. "https://unipool.app,https://www.unipool.app"). When
// the var is unset (local dev) we allow all origins so the Vite proxy + local
// tooling keep working. Setting CORS_ORIGINS is required before a public deploy.
const allowlist = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors(
    allowlist.length
      ? {
          origin: (origin, cb) =>
            // Allow same-origin / curl (no Origin header) and any listed origin.
            !origin || allowlist.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS')),
        }
      : {},
  ),
);
// Idempotently credit a PAID top-up Checkout session to the user's wallet.
// Shared by the webhook and the redirect-confirm endpoint (both safe to re-run).
const creditTopupSession = (session) => {
  if (!session || session.payment_status !== 'paid') return false;
  const rec = store.getTopup(session.id);
  if (!rec || rec.status === 'credited') return false;
  store.raw.transaction(() => {
    const user = store.getUser(rec.user_id);
    if (!user) return;
    const balance = pay.round2((user.walletBalance || 0) + rec.amount);
    store.setUserField(user.id, 'walletBalance', balance);
    store.addLedger(user.id, 'topup', rec.amount, 'Wallet top-up (Stripe)', session.id);
    store.markTopupCredited(session.id);
  })();
  return true;
};

// Stripe webhook — MUST get the raw body for signature verification, so it is
// mounted BEFORE express.json(). Credits wallet top-ups idempotently.
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  if (!pay.enabled || !pay.hasWebhookSecret) return res.status(503).end();
  let event;
  try {
    event = pay.constructEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') creditTopupSession(event.data.object);
  res.json({ received: true });
});

app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage() });

const CAMPUS = store.CAMPUS;

// Null-safe great-circle distance (km). Returns null when either endpoint is
// missing coordinates so callers never crash on incomplete ride/location data.
const haversine = (a, b) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Strip secrets before sending a user to the client.
const publicUser = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
};

// Build a new user record from registration/seed input, then persist it.
const makeUser = (data) => {
  const user = store.createUser({
    name: data.name || 'User',
    email: (data.email || '').toLowerCase(),
    password: data.password || 'password',
    role: data.role || (data.hasVehicle ? 'driver' : 'rider'),
    university: data.university || 'La Trobe University',
    hasVehicle: !!data.hasVehicle,
    vehicleType: data.vehicleType || (data.hasVehicle ? 'sedan' : null),
    vehicleSeats: data.vehicleSeats || (data.hasVehicle ? 4 : null),
    verified: !!data.verified,
    isAdmin: !!data.isAdmin,
    rating: data.rating ?? 5,
    reviewCount: data.reviewCount ?? 0,
    walletBalance: data.walletBalance ?? 0,
    avatar: data.avatar || null,
    phone: data.phone || '',
    homeLocation: data.homeLocation || null,
    createdAt: new Date().toISOString(),
  });
  // Default name uses the assigned id when the caller didn't supply one.
  if (!data.name) store.setUserField(user.id, 'name', `User ${user.id}`);
  return store.getUser(user.id);
};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const issueToken = (user) => {
  const token = crypto.randomBytes(24).toString('hex');
  store.saveToken(token, user.id);
  return token;
};

const userById = (id) => store.getUser(id);

// Attaches req.user when a valid Bearer token is present (does not reject).
const withUser = (req, _res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const uid = token ? store.userIdForToken(token) : null;
  req.user = uid ? userById(uid) : null;
  next();
};

// Rejects when no authenticated user.
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only', code: 'FORBIDDEN' });
  next();
};

// Product rule: only verified La Trobe students may offer/seek routes; unverified
// accounts stay browse-only. (Must run after requireAuth so req.user exists.)
const requireVerified = (req, res, next) => {
  if (!req.user?.verified)
    return res.status(403).json({ error: 'Verify your student account to use this feature', code: 'NOT_VERIFIED' });
  next();
};

const api = express.Router();
api.use(withUser);

// ---------------------------------------------------------------------------
// Geocoding — as-you-type address autocomplete over real Australian places.
// We proxy OpenStreetMap's Nominatim (keyless) from the server so we can set a
// proper User-Agent, restrict to Australia, and cache results (Nominatim asks
// for <=1 req/sec + a UA). The client never talks to Nominatim directly.
// ---------------------------------------------------------------------------
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const geocodeCache = new Map(); // lowercased query -> { at, results }
const GEOCODE_TTL = 24 * 60 * 60 * 1000; // a place's coords don't move

// Collapse a Nominatim result to the compact {name, suburb, lat, lng} the app
// stores. `name` is a human label; `suburb` is the approximate area we may
// share with a match (never the house number / precise address).
const shapePlace = (r) => {
  const a = r.address || {};
  const suburb = a.suburb || a.city || a.town || a.village || a.municipality || a.county || null;
  const road = a.road || a.neighbourhood || null;
  const label = [
    a.house_number && road ? `${a.house_number} ${road}` : road,
    suburb,
    a.state,
    a.postcode,
  ].filter(Boolean).join(', ') || r.display_name;
  return {
    name: label,
    suburb: suburb || label,
    lat: Number(r.lat),
    lng: Number(r.lon),
    type: r.type || r.class || 'place',
  };
};

api.get('/geocode', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  const key = q.toLowerCase();
  const hit = geocodeCache.get(key);
  if (hit && Date.now() - hit.at < GEOCODE_TTL) return res.json(hit.results);
  try {
    const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&countrycodes=au&limit=6&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'UniPool-LaTrobe-Carpool/1.0 (student project)',
        'Accept-Language': 'en-AU',
      },
    });
    if (!r.ok) return res.status(502).json({ error: 'Geocoder unavailable', code: 'GEOCODE_FAIL' });
    const raw = await r.json();
    const results = (Array.isArray(raw) ? raw : [])
      .map(shapePlace)
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    geocodeCache.set(key, { at: Date.now(), results });
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Geocoder unavailable', code: 'GEOCODE_FAIL' });
  }
});

// Decorate a ride with driver + derived fields the UI likes to show.
const decorateRide = (ride) => {
  const driver = userById(ride.driverId);
  const distanceKm = haversine(ride.from, ride.to);
  return {
    ...ride,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
    driver: driver
      ? { id: driver.id, name: driver.name, rating: driver.rating, avatar: driver.avatar, vehicleType: driver.vehicleType, verified: driver.verified }
      : null,
  };
};

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
api.post('/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password are required' });
  if (store.getUserByEmail(email))
    return res.status(409).json({ error: 'An account with that email already exists', code: 'EMAIL_TAKEN' });
  const user = makeUser(req.body);
  const token = issueToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

api.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = store.getUserByEmail(email);
  if (!user || !store.verifyPassword(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
  // Transparently upgrade any legacy plaintext password to a hash on login.
  if (!store.isHashed(user.password)) store.setUserField(user.id, 'password', password);
  const token = issueToken(user);
  res.json({ token, user: publicUser(user) });
});

api.post('/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!store.verifyPassword(currentPassword, req.user.password))
    return res.status(400).json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  store.setUserField(req.user.id, 'password', newPassword);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
api.get('/users/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

api.put('/users/me', requireAuth, (req, res) => {
  const editable = ['name', 'phone', 'avatar', 'vehicleType', 'vehicleSeats', 'hasVehicle', 'role', 'homeLocation'];
  for (const k of editable) if (k in (req.body || {})) store.setUserField(req.user.id, k, req.body[k]);
  res.json(publicUser(store.getUser(req.user.id)));
});

api.delete('/users/me', requireAuth, (req, res) => {
  store.deleteUser(req.user.id);
  res.json({ ok: true });
});

api.get('/users/locations', withUser, (_req, res) => {
  res.json(
    store.allUsers()
      .filter((u) => u.homeLocation)
      .map((u) => ({ id: u.id, name: u.name, role: u.role, location: u.homeLocation })),
  );
});

api.get('/users/:id/reviews', (req, res) => {
  const uid = Number(req.params.id);
  res.json(store.reviewsAbout(uid));
});

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------
api.get('/rides', (req, res) => {
  let rides = store.activeRides();
  if (req.query.from) rides = rides.filter((r) => r.from?.name?.toLowerCase().includes(String(req.query.from).toLowerCase()));
  if (req.query.to) rides = rides.filter((r) => r.to?.name?.toLowerCase().includes(String(req.query.to).toLowerCase()));
  res.json(rides.map(decorateRide));
});

api.get('/rides/my', requireAuth, (req, res) => {
  res.json(store.ridesByDriver(req.user.id).map(decorateRide));
});

api.get('/rides/:id', (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  res.json(decorateRide(ride));
});

// Coerce a location to a valid {name,lat,lng} point, or return null. Rejects
// bare strings (the old bug source) — coordinates are required.
const toPoint = (v, fallback) => {
  if (v && typeof v === 'object' && v.lat != null && v.lng != null && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
    return { name: v.name ?? null, lat: Number(v.lat), lng: Number(v.lng) };
  return fallback;
};

api.post('/rides', requireAuth, requireVerified, (req, res) => {
  const b = req.body || {};
  const from = toPoint(b.from, toPoint({ name: b.fromName, lat: b.fromLat, lng: b.fromLng }, null));
  if (!from)
    return res.status(400).json({ error: 'A pickup location with coordinates is required', code: 'BAD_LOCATION' });
  const ride = store.createRide({
    driverId: req.user.id,
    from,
    to: toPoint(b.to, CAMPUS),
    departureTime: b.departureTime || new Date().toISOString(),
    // One rider per vehicle (Australian carpool rules) — never a multi-seat ride.
    seatsTotal: 1,
    seatsAvailable: 1,
    fare: b.fare ?? 5,
    vehicleType: b.vehicleType || req.user.vehicleType || 'sedan',
    status: 'active',
    notes: b.notes || '',
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(decorateRide(ride));
});

api.put('/rides/:id', requireAuth, (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  const { id, driverId, ...patch } = req.body || {};
  const updated = store.updateRide(ride.id, patch);
  res.json(decorateRide(updated));
});

api.delete('/rides/:id', requireAuth, (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  store.updateRide(ride.id, { status: 'cancelled' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
const decorateBooking = (bk) => {
  const ride = store.getRide(bk.rideId);
  const dRide = ride ? decorateRide(ride) : null;
  const rider = userById(bk.riderId);
  const driver = userById(bk.driverId);
  const dt = ride?.departureTime ? new Date(ride.departureTime) : null;
  const escrow_status = bk.status === 'completed' ? 'released'
    : ['cancelled', 'rejected', 'declined'].includes(bk.status) ? 'refunded'
      : bk.escrow > 0 ? 'held' : 'none';
  return {
    ...bk,
    ride: dRide,
    // Denormalised fields the UI reads directly, so pages stay simple.
    from_location: dRide?.from?.name ?? null,
    to_location: dRide?.to?.name ?? null,
    date: ride?.departureTime ?? null,
    time: dt ? dt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : null,
    distance_km: dRide?.distanceKm ?? null,
    escrow_status,
    driver_payout: Math.round(bk.fare * 0.9 * 100) / 100,
    reviewed: store.bookingReviewed(bk.id),
    driver: driver ? { id: driver.id, name: driver.name, rating: driver.rating, avatar: driver.avatar } : null,
    driver_name: driver?.name ?? null,
    driver_rating: driver?.rating ?? null,
    rider: rider ? { id: rider.id, name: rider.name, rating: rider.rating, avatar: rider.avatar } : null,
    passenger_name: rider?.name ?? null,
    passenger_rating: rider?.rating ?? null,
  };
};

api.get('/bookings', requireAuth, (req, res) => {
  res.json(store.bookingsByRider(req.user.id).map(decorateBooking));
});

api.get('/rides/:id/bookings', requireAuth, (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  res.json(store.bookingsByRide(ride.id).map(decorateBooking));
});

// Rider books a ride — fare held in escrow (debited from wallet).
api.post('/rides/:id/book', requireAuth, requireVerified, (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId === req.user.id) return res.status(400).json({ error: "You can't book your own ride" });
  if (ride.seatsAvailable < 1) return res.status(409).json({ error: 'Ride is full', code: 'RIDE_FULL' });
  if (req.user.walletBalance < ride.fare)
    return res.status(402).json({ error: 'Insufficient wallet balance', code: 'INSUFFICIENT_FUNDS' });

  const booking = store.raw.transaction(() => {
    const newBalance = Math.round((req.user.walletBalance - ride.fare) * 100) / 100;
    store.setUserField(req.user.id, 'walletBalance', newBalance);
    store.updateRide(ride.id, { seatsAvailable: ride.seatsAvailable - 1 });
    return store.createBooking({
      rideId: ride.id, riderId: req.user.id, driverId: ride.driverId,
      status: 'pending', fare: ride.fare, escrow: ride.fare,
      createdAt: new Date().toISOString(),
    });
  })();
  res.status(201).json(decorateBooking(booking));
});

// Driver invites a matched rider to a ride.
api.post('/rides/:id/invite', requireAuth, (req, res) => {
  const ride = store.getRide(Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  const rider = userById(Number(req.body?.riderId));
  if (!rider) return res.status(404).json({ error: 'Rider not found' });
  const booking = store.createBooking({
    rideId: ride.id, riderId: rider.id, driverId: ride.driverId,
    status: 'invited', fare: ride.fare, escrow: 0,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(decorateBooking(booking));
});

const findBooking = (req, res) => {
  const bk = store.getBooking(Number(req.params.id));
  if (!bk) res.status(404).json({ error: 'Booking not found' });
  return bk;
};

// Driver accepts/rejects a pending booking.
api.put('/bookings/:id/status', requireAuth, (req, res) => {
  const bk = findBooking(req, res); if (!bk) return;
  if (bk.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  const { status } = req.body || {};
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  store.raw.transaction(() => {
    // Rejecting refunds the rider's escrow and frees the seat.
    if (status === 'rejected' && bk.escrow > 0) {
      const rider = userById(bk.riderId);
      if (rider) store.setUserField(rider.id, 'walletBalance', rider.walletBalance + bk.escrow);
      store.updateBooking(bk.id, { escrow: 0 });
      const ride = store.getRide(bk.rideId);
      if (ride) store.updateRide(ride.id, { seatsAvailable: ride.seatsAvailable + 1 });
    }
    store.updateBooking(bk.id, { status });
  })();
  res.json(decorateBooking(store.getBooking(bk.id)));
});

// Rider responds to a driver invitation (accept holds escrow).
api.put('/bookings/:id/respond', requireAuth, (req, res) => {
  const bk = findBooking(req, res); if (!bk) return;
  if (bk.riderId !== req.user.id) return res.status(403).json({ error: 'Not your invitation', code: 'FORBIDDEN' });
  const accept = !!req.body?.accept;
  if (!accept) { store.updateBooking(bk.id, { status: 'declined' }); return res.json(decorateBooking(store.getBooking(bk.id))); }
  const ride = store.getRide(bk.rideId);
  if (!ride || ride.seatsAvailable < 1) return res.status(409).json({ error: 'Ride is full', code: 'RIDE_FULL' });
  if (req.user.walletBalance < bk.fare)
    return res.status(402).json({ error: 'Insufficient wallet balance', code: 'INSUFFICIENT_FUNDS' });
  store.raw.transaction(() => {
    store.setUserField(req.user.id, 'walletBalance', Math.round((req.user.walletBalance - bk.fare) * 100) / 100);
    store.updateBooking(bk.id, { escrow: bk.fare, status: 'accepted' });
    store.updateRide(ride.id, { seatsAvailable: ride.seatsAvailable - 1 });
  })();
  res.json(decorateBooking(store.getBooking(bk.id)));
});

// Driver marks the ride done → escrow released to driver.
api.post('/bookings/:id/complete', requireAuth, (req, res) => {
  const bk = findBooking(req, res); if (!bk) return;
  if (bk.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride', code: 'FORBIDDEN' });
  store.raw.transaction(() => {
    if (bk.escrow > 0) {
      const driver = userById(bk.driverId);
      if (driver) store.setUserField(driver.id, 'walletBalance', Math.round((driver.walletBalance + bk.escrow) * 100) / 100);
      store.updateBooking(bk.id, { escrow: 0 });
    }
    store.updateBooking(bk.id, { status: 'completed' });
  })();
  res.json(decorateBooking(store.getBooking(bk.id)));
});

api.post('/bookings/:id/review', requireAuth, (req, res) => {
  const bk = findBooking(req, res); if (!bk) return;
  const { rating, comment } = req.body || {};
  const aboutUserId = req.user.id === bk.riderId ? bk.driverId : bk.riderId;
  const review = store.createReview({
    bookingId: bk.id, byUserId: req.user.id, aboutUserId,
    rating: Number(rating) || 5, comment: comment || '', createdAt: new Date().toISOString(),
  });
  // Recompute the reviewed user's average rating.
  const about = userById(aboutUserId);
  if (about) {
    const theirs = store.reviewsAbout(aboutUserId);
    store.setUserField(about.id, 'reviewCount', theirs.length);
    store.setUserField(about.id, 'rating', Math.round((theirs.reduce((s, r) => s + r.rating, 0) / theirs.length) * 10) / 10);
  }
  res.status(201).json(review);
});

api.delete('/bookings/:id', requireAuth, (req, res) => {
  const bk = findBooking(req, res); if (!bk) return;
  if (bk.riderId !== req.user.id) return res.status(403).json({ error: 'Not your booking', code: 'FORBIDDEN' });
  store.raw.transaction(() => {
    if (bk.escrow > 0) {
      store.setUserField(req.user.id, 'walletBalance', req.user.walletBalance + bk.escrow);
      store.updateBooking(bk.id, { escrow: 0 });
    }
    const ride = store.getRide(bk.rideId);
    if (ride && ['pending', 'accepted'].includes(bk.status)) store.updateRide(ride.id, { seatsAvailable: ride.seatsAvailable + 1 });
    store.updateBooking(bk.id, { status: 'cancelled' });
  })();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Wallet — balance + history. Money in/out flows through /payments/* (Stripe);
// this endpoint just reports the current wallet state from the ledger.
// ---------------------------------------------------------------------------
api.get('/wallet', requireAuth, (req, res) => {
  const entries = store.ledgerForUser(req.user.id);
  const totalEarnings = entries
    .filter((e) => e.kind === 'earning')
    .reduce((s, e) => s + e.amount, 0);
  const transactions = entries.map((e) => ({
    id: e.id,
    type: e.kind,
    note: e.note,
    amount: e.amount,
    status: e.kind,
    createdAt: e.createdAt,
  }));
  res.json({
    balance: pay.round2(req.user.walletBalance || 0),
    currency: pay.CURRENCY.toUpperCase(),
    in_escrow: pay.round2(store.heldEscrowForRider(req.user.id)),
    total_earnings: pay.round2(totalEarnings),
    // Lets the client hide top-up / payout UI (and skip the /payments/* calls
    // that 503) until Stripe keys are configured.
    paymentsEnabled: !!pay.enabled,
    ledger: transactions,
    transactions,
  });
});

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
api.get('/schedule', requireAuth, (req, res) => {
  res.json(store.getSchedule(req.user.id));
});

api.put('/schedule', requireAuth, (req, res) => {
  const { days, arriveBy, leaveAt } = req.body || {};
  res.json(store.setSchedule(req.user.id, { days, arriveBy, leaveAt }));
});

// ---------------------------------------------------------------------------
// Routes — recurring commute templates (home <-> campus) with a per-weekday
// schedule (outbound start_time + optional return_time). A route is the durable
// "I commute Mon/Wed/Fri ~8am" object; concrete trips are derived from it.
// ---------------------------------------------------------------------------
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Coarsen a client-supplied location to the shape routes store.
const normPoint = (p) => {
  if (!p) return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  return {
    name: p.name ?? null,
    suburb: p.suburb ?? null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
};

// Validate + normalise the per-weekday schedule from a request body.
const normDays = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6)
    .map((d) => ({ weekday: d.weekday, start_time: d.start_time || null, return_time: d.return_time || null }));

const gradeForDetour = (km) => (km <= 1 ? 'A+' : km <= 2 ? 'A' : km <= 4 ? 'B' : km <= 6 ? 'C' : 'D');

// Named landmarks used to label a suggested meet point in human terms (no
// external geocoder needed for the heuristic MVP).
const KNOWN_POINTS = [
  { name: 'La Trobe University (Bundoora)', lat: -37.7217, lng: 145.0463 },
  { name: 'Reservoir', lat: -37.7154, lng: 145.0421 },
  { name: 'Preston', lat: -37.7406, lng: 145.0172 },
  { name: 'Bundoora', lat: -37.7000, lng: 145.0600 },
  { name: 'Thomastown', lat: -37.6830, lng: 145.0150 },
  { name: 'Epping', lat: -37.6400, lng: 145.0300 },
  { name: 'South Morang', lat: -37.6389, lng: 145.0741 },
  { name: 'Doreen', lat: -37.6512, lng: 145.0866 },
  { name: 'Craigieburn', lat: -37.6029, lng: 144.9281 },
  { name: 'Whittlesea', lat: -37.5140, lng: 145.1219 },
  { name: 'Melbourne CBD', lat: -37.8136, lng: 144.9631 },
  { name: 'Reservoir Station', lat: -37.7167, lng: 145.0075 },
];

const nearestNamed = (pt) => {
  let best = null, bd = Infinity;
  for (const k of KNOWN_POINTS) {
    const d = haversine(pt, k);
    if (d != null && d < bd) { bd = d; best = k; }
  }
  return best?.name ?? null;
};

// Closest point on segment a->b to p (planar approx; fine over a few km). This
// is the "most favourable pickup" — the spot on the driver's route that costs
// them the least detour to collect the rider.
const projectOntoSegment = (a, b, p) => {
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { lat: a.lat + t * dy, lng: a.lng + t * dx };
};

// The suggested meet/pickup point for a driver corridor + rider home.
const suggestMeetPoint = (driverOrigin, driverDest, riderOrigin) => {
  const pt = projectOntoSegment(driverOrigin, driverDest, riderOrigin);
  const walkKm = haversine(riderOrigin, pt);
  return {
    name: nearestNamed(pt),
    lat: Math.round(pt.lat * 1e5) / 1e5,
    lng: Math.round(pt.lng * 1e5) / 1e5,
    kmFromRiderHome: walkKm == null ? null : Math.round(walkKm * 10) / 10,
  };
};

// Find opposite-role routes that share >=1 commute weekday and whose corridor
// detour is small. The corridor is always the DRIVER's origin->dest; the rider's
// origin is the pickup. Only approximate location (name/suburb) is returned —
// never the counterpart's precise coordinates.
const routeMatches = (myRoute) => {
  const oppRole = myRoute.role === 'driver' ? 'rider' : 'driver';
  const myDays = new Set(myRoute.days.map((d) => d.weekday));
  const out = [];
  for (const c of store.routesByRole(oppRole)) {
    if (c.user_id === myRoute.user_id || !c.origin || !myRoute.origin) continue;
    const shared = c.days.map((d) => d.weekday).filter((w) => myDays.has(w));
    if (!shared.length) continue;
    const driverR = myRoute.role === 'driver' ? myRoute : c;
    const riderR = myRoute.role === 'driver' ? c : myRoute;
    const dOrigin = driverR.origin, dDest = driverR.dest || CAMPUS, rOrigin = riderR.origin;
    if (!dOrigin || !rOrigin || dOrigin.lat == null || rOrigin.lat == null) continue;
    const legA = haversine(dOrigin, rOrigin), legB = haversine(rOrigin, dDest), base = haversine(dOrigin, dDest);
    if (legA == null || legB == null || base == null) continue;
    const detourKm = Math.round(Math.max(0, legA + legB - base) * 10) / 10;
    if (detourKm > 8) continue;
    const u = userById(c.user_id);
    out.push({
      routeId: c.id,
      role: c.role,
      direction: c.direction,
      origin: { name: c.origin?.name, suburb: c.origin?.suburb }, // approximate only
      detourKm,
      grade: gradeForDetour(detourKm),
      // System-suggested pickup: the most favourable spot on the driver's route.
      meetPoint: suggestMeetPoint(dOrigin, dDest, rOrigin),
      sharedDays: shared.sort((a, b) => a - b).map((w) => {
        const cd = c.days.find((d) => d.weekday === w);
        return { weekday: w, day: WEEKDAY_LABELS[w], start_time: cd?.start_time ?? null, return_time: cd?.return_time ?? null };
      }),
      user: u
        ? { id: u.id, name: u.name, rating: u.rating, avatar: u.avatar, verified: u.verified, vehicleType: u.vehicleType }
        : null,
    });
  }
  return out.sort((a, b) => a.detourKm - b.detourKm);
};

// Create a recurring commute route (verified students only).
api.post('/routes', requireAuth, requireVerified, (req, res) => {
  const b = req.body || {};
  const role = b.role === 'driver' || b.role === 'rider' ? b.role : (req.user.hasVehicle ? 'driver' : 'rider');
  const direction = b.direction === 'from_campus' ? 'from_campus' : 'to_campus';
  const origin = normPoint(b.origin);
  if (!origin || origin.lat == null || origin.lng == null)
    return res.status(400).json({ error: 'A home/origin location with coordinates is required' });
  const dest = normPoint(b.dest) || { name: CAMPUS.name, suburb: 'Bundoora', lat: CAMPUS.lat, lng: CAMPUS.lng };
  const days = normDays(b.days);
  if (!days.length)
    return res.status(400).json({ error: 'Select at least one commute day', code: 'NO_DAYS' });
  const route = store.createRoute({
    user_id: req.user.id,
    role,
    direction,
    origin,
    dest,
    seats: 1, // AU policy: at most one rider per trip
    vehicle_type: role === 'driver' ? (b.vehicleType || req.user.vehicleType || 'sedan') : null,
    notes: b.notes || '',
    status: 'active',
    days,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(route);
});

// My routes. Registered before /routes/:id so "mine"/"matches" aren't captured.
api.get('/routes/mine', requireAuth, (req, res) => {
  res.json(store.routesByUser(req.user.id));
});

// Suggested matches for one of my routes (?routeId=, else my newest active route).
api.get('/routes/matches', requireAuth, (req, res) => {
  const myRoute = req.query.routeId
    ? store.getRoute(Number(req.query.routeId))
    : store.routesByUser(req.user.id).find((r) => r.status === 'active');
  if (!myRoute) return res.status(400).json({ error: 'Create a route first to see matches', code: 'NO_ROUTE' });
  if (myRoute.user_id !== req.user.id) return res.status(403).json({ error: 'Not your route', code: 'FORBIDDEN' });
  res.json({ route: myRoute, matches: routeMatches(myRoute) });
});

api.get('/routes/:id', requireAuth, (req, res) => {
  const r = store.getRoute(Number(req.params.id));
  if (!r || r.status === 'deleted') return res.status(404).json({ error: 'Route not found' });
  res.json(r);
});

// Edit a route's fields and/or replace its weekday schedule.
api.put('/routes/:id', requireAuth, requireVerified, (req, res) => {
  const r = store.getRoute(Number(req.params.id));
  if (!r || r.status === 'deleted') return res.status(404).json({ error: 'Route not found' });
  if (r.user_id !== req.user.id) return res.status(403).json({ error: 'Not your route', code: 'FORBIDDEN' });
  const b = req.body || {};
  const patch = {};
  if (b.direction === 'to_campus' || b.direction === 'from_campus') patch.direction = b.direction;
  if (b.origin) { const o = normPoint(b.origin); if (o?.lat != null) patch.origin = o; }
  if (b.dest) { const d = normPoint(b.dest); if (d?.lat != null) patch.dest = d; }
  if (b.vehicleType != null) patch.vehicle_type = b.vehicleType;
  if (b.notes != null) patch.notes = b.notes;
  if (b.status === 'active' || b.status === 'paused') patch.status = b.status;
  if (Object.keys(patch).length) store.updateRoute(r.id, patch);
  if (Array.isArray(b.days)) {
    const days = normDays(b.days);
    if (!days.length) return res.status(400).json({ error: 'Select at least one commute day', code: 'NO_DAYS' });
    store.setRouteDays(r.id, days);
  }
  res.json(store.getRoute(r.id));
});

api.delete('/routes/:id', requireAuth, (req, res) => {
  const r = store.getRoute(Number(req.params.id));
  if (!r || r.status === 'deleted') return res.status(404).json({ error: 'Route not found' });
  if (r.user_id !== req.user.id) return res.status(403).json({ error: 'Not your route', code: 'FORBIDDEN' });
  store.updateRouteStatus(r.id, 'deleted');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Route connections — "request to ride together". No money moves at soft-launch;
// once accepted, both sides see the suggested pickup + each other's contact and
// settle payment (cash/PayID) themselves.
// ---------------------------------------------------------------------------

// Shared commute weekdays between two routes, with the counterpart's times.
const sharedDaysBetween = (mine, theirs) => {
  const myDays = new Set((mine.days || []).map((d) => d.weekday));
  return (theirs.days || [])
    .filter((d) => myDays.has(d.weekday))
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => ({ weekday: d.weekday, day: WEEKDAY_LABELS[d.weekday], start_time: d.start_time ?? null, return_time: d.return_time ?? null }));
};

// Shape a stored connection for the client, from the perspective of `meId`.
const decorateConnection = (c, meId) => {
  const iAmDriver = c.driver_id === meId;
  const counterpartId = iAmDriver ? c.rider_id : c.driver_id;
  const counterpart = userById(counterpartId);
  const myRole = iAmDriver ? 'driver' : 'rider';
  const requestedByMe = c.requested_by === myRole;
  const myRoute = store.getRoute(iAmDriver ? c.driver_route_id : c.rider_route_id);
  const theirRoute = store.getRoute(iAmDriver ? c.rider_route_id : c.driver_route_id);
  const accepted = c.status === 'accepted';
  return {
    id: c.id,
    status: c.status,
    myRole,
    requestedByMe,
    // The recipient (didn't initiate) is the one who can accept/decline.
    canRespond: c.status === 'pending' && !requestedByMe,
    createdAt: c.createdAt,
    respondedAt: c.respondedAt,
    meetPoint: c.meet_name || c.meet_lat != null
      ? { name: c.meet_name, lat: c.meet_lat, lng: c.meet_lng }
      : null,
    sharedDays: myRoute && theirRoute ? sharedDaysBetween(myRoute, theirRoute) : [],
    direction: theirRoute?.direction ?? null,
    counterpart: counterpart
      ? {
          id: counterpart.id,
          name: counterpart.name,
          rating: counterpart.rating,
          avatar: counterpart.avatar,
          role: iAmDriver ? 'rider' : 'driver',
          vehicleType: iAmDriver ? null : counterpart.vehicleType,
          // Approximate location only until accepted.
          suburb: theirRoute?.origin?.suburb ?? theirRoute?.origin?.name ?? null,
          // Contact details are revealed ONLY once both sides have agreed.
          contact: accepted ? { phone: counterpart.phone || null, email: counterpart.email } : null,
        }
      : null,
  };
};

// Request to ride with the route at :id (the matched counterpart route).
api.post('/routes/:id/connect', requireAuth, requireVerified, (req, res) => {
  const theirRoute = store.getRoute(Number(req.params.id));
  if (!theirRoute || theirRoute.status === 'deleted')
    return res.status(404).json({ error: 'Route not found' });
  const myRoute = req.body?.myRouteId
    ? store.getRoute(Number(req.body.myRouteId))
    : store.routesByUser(req.user.id).find((r) => r.status === 'active');
  if (!myRoute) return res.status(400).json({ error: 'Create a route first', code: 'NO_ROUTE' });
  if (myRoute.user_id !== req.user.id) return res.status(403).json({ error: 'Not your route', code: 'FORBIDDEN' });
  if (theirRoute.user_id === req.user.id) return res.status(400).json({ error: "You can't connect to your own route" });
  if (myRoute.role === theirRoute.role)
    return res.status(400).json({ error: 'A rider can only connect with a driver (and vice versa)', code: 'ROLE_MISMATCH' });
  if (!sharedDaysBetween(myRoute, theirRoute).length)
    return res.status(400).json({ error: 'These routes share no commute days', code: 'NO_SHARED_DAYS' });

  const driverRoute = myRoute.role === 'driver' ? myRoute : theirRoute;
  const riderRoute = myRoute.role === 'driver' ? theirRoute : myRoute;
  if (store.activeConnectionForRoutes(riderRoute.id, driverRoute.id))
    return res.status(409).json({ error: 'A request already exists between these routes', code: 'DUPLICATE' });

  const meet = suggestMeetPoint(driverRoute.origin, driverRoute.dest || CAMPUS, riderRoute.origin);
  const conn = store.createConnection({
    rider_route_id: riderRoute.id,
    driver_route_id: driverRoute.id,
    rider_id: riderRoute.user_id,
    driver_id: driverRoute.user_id,
    requested_by: myRoute.role,
    status: 'pending',
    meet,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(decorateConnection(conn, req.user.id));
});

// All my connections (incoming requests + ones I sent), newest first.
api.get('/connections', requireAuth, (req, res) => {
  res.json(store.connectionsForUser(req.user.id).map((c) => decorateConnection(c, req.user.id)));
});

// Recipient accepts or declines a pending request.
api.put('/connections/:id', requireAuth, (req, res) => {
  const c = store.getConnection(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Connection not found' });
  if (c.rider_id !== req.user.id && c.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Not your connection', code: 'FORBIDDEN' });
  const myRole = c.driver_id === req.user.id ? 'driver' : 'rider';
  if (c.requested_by === myRole)
    return res.status(403).json({ error: 'Only the recipient can respond', code: 'NOT_RECIPIENT' });
  if (c.status !== 'pending') return res.status(409).json({ error: `Already ${c.status}`, code: 'NOT_PENDING' });
  const action = req.body?.action;
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const updated = store.setConnectionStatus(c.id, action === 'accept' ? 'accepted' : 'declined');
  res.json(decorateConnection(updated, req.user.id));
});

// Requester cancels a request they sent (or either side withdraws).
api.delete('/connections/:id', requireAuth, (req, res) => {
  const c = store.getConnection(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Connection not found' });
  if (c.rider_id !== req.user.id && c.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Not your connection', code: 'FORBIDDEN' });
  store.setConnectionStatus(c.id, 'cancelled');
  res.json({ ok: true });
});

// --- Recurring trips on an accepted connection ---
// The concrete upcoming rides generated from the two routes' shared weekdays.
const TRIP_WINDOW_DAYS = 14;
// Local YYYY-MM-DD (avoid UTC rollover from toISOString in AU timezones).
const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Per-trip fare = rider's home->campus distance priced by payments.js.
const fareForConnection = (conn) => {
  const riderRoute = store.getRoute(conn.rider_route_id);
  const dist = riderRoute?.origin ? haversine(riderRoute.origin, CAMPUS) : null;
  return pay.fareFor(dist);
};
const tripRef = (connId, date, direction) => `trip:${connId}:${date}:${direction}`;

// Expand an accepted connection into its next TRIP_WINDOW_DAYS of trips. Uses the
// DRIVER route's per-day times, one outbound (to_campus) and, when a return_time
// is set, one return (from_campus). Stored per-trip overrides (status/fare/escrow)
// are merged; untouched trips default to scheduled at the standard fare.
const upcomingTripsForConnection = (conn, viewerId) => {
  const driverRoute = store.getRoute(conn.driver_route_id);
  const riderRoute = store.getRoute(conn.rider_route_id);
  if (!driverRoute || !riderRoute) return [];
  const riderWeekdays = new Set((riderRoute.days || []).map((d) => d.weekday));
  const dayByWeekday = {};
  for (const d of driverRoute.days || []) if (riderWeekdays.has(d.weekday)) dayByWeekday[d.weekday] = d;
  const map = store.connectionTripMap(conn.id);
  const defaultFare = fareForConnection(conn);
  const iAmRider = viewerId === conn.rider_id;
  const trips = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < TRIP_WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const weekday = (d.getDay() + 6) % 7; // JS Sun=0 -> app Mon=0..Sun=6
    const rd = dayByWeekday[weekday];
    if (!rd) continue;
    const date = ymdLocal(d);
    const add = (direction, time) => {
      const rec = map[`${date}|${direction}`];
      trips.push({
        date,
        weekday,
        day: WEEKDAY_LABELS[weekday],
        direction,
        time: time || null,
        status: rec?.status || 'scheduled',
        fare: rec?.fare ?? defaultFare,
        escrowStatus: rec?.escrowStatus || 'none',
        iAmRider,
      });
    };
    add('to_campus', rd.start_time);
    if (rd.return_time) add('from_campus', rd.return_time);
  }
  return trips;
};

// Load an accepted connection I'm a party to, or send the right error.
const myAcceptedConnection = (req, res) => {
  const c = store.getConnection(Number(req.params.id));
  if (!c) { res.status(404).json({ error: 'Connection not found' }); return null; }
  if (c.rider_id !== req.user.id && c.driver_id !== req.user.id) {
    res.status(403).json({ error: 'Not your connection', code: 'FORBIDDEN' }); return null;
  }
  if (c.status !== 'accepted') { res.status(409).json({ error: 'Connection is not accepted', code: 'NOT_ACCEPTED' }); return null; }
  return c;
};
const validTripBody = (req, res) => {
  const { date, direction } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { res.status(400).json({ error: 'A valid trip date (YYYY-MM-DD) is required' }); return null; }
  if (!['to_campus', 'from_campus'].includes(direction)) { res.status(400).json({ error: 'Invalid direction' }); return null; }
  return { date, direction };
};

// The trips (per date) of one of my accepted connections.
api.get('/connections/:id/trips', requireAuth, (req, res) => {
  const c = store.getConnection(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Connection not found' });
  if (c.rider_id !== req.user.id && c.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Not your connection', code: 'FORBIDDEN' });
  if (c.status !== 'accepted') return res.json({ status: c.status, trips: [] });
  res.json({ status: c.status, trips: upcomingTripsForConnection(c, req.user.id) });
});

// Rider pays a trip's fare into escrow (held from their wallet balance).
api.post('/connections/:id/trips/pay', requireAuth, (req, res) => {
  const c = myAcceptedConnection(req, res); if (!c) return;
  if (c.rider_id !== req.user.id) return res.status(403).json({ error: 'Only the rider pays for a trip', code: 'NOT_RIDER' });
  const body = validTripBody(req, res); if (!body) return;
  const { date, direction } = body;
  const trip = upcomingTripsForConnection(c, req.user.id).find((t) => t.date === date && t.direction === direction);
  if (!trip) return res.status(404).json({ error: 'That trip is not in the upcoming schedule' });
  if (trip.escrowStatus === 'held') return res.status(409).json({ error: 'Trip already paid', code: 'ALREADY_PAID' });
  if (trip.status === 'completed') return res.status(409).json({ error: 'Trip already completed' });
  const fare = fareForConnection(c);
  if ((req.user.walletBalance || 0) < fare)
    return res.status(402).json({ error: 'Insufficient wallet balance — top up to pay', code: 'INSUFFICIENT_FUNDS', fare, balance: pay.round2(req.user.walletBalance || 0) });
  store.raw.transaction(() => {
    store.setUserField(req.user.id, 'walletBalance', pay.round2(req.user.walletBalance - fare));
    store.setConnectionTrip(c.id, date, direction, { status: 'confirmed', fare, escrowStatus: 'held' });
    store.addLedger(req.user.id, 'spend', -fare, 'Trip fare held in escrow', tripRef(c.id, date, direction));
  })();
  res.json({ ok: true, date, direction, status: 'confirmed', escrowStatus: 'held', fare });
});

// Rider confirms the ride happened -> release escrow to the driver.
api.post('/connections/:id/trips/release', requireAuth, (req, res) => {
  const c = myAcceptedConnection(req, res); if (!c) return;
  if (c.rider_id !== req.user.id) return res.status(403).json({ error: 'Only the rider confirms the ride', code: 'NOT_RIDER' });
  const body = validTripBody(req, res); if (!body) return;
  const { date, direction } = body;
  const stored = store.getConnectionTrip(c.id, date, direction);
  if (!stored || stored.escrow_status !== 'held')
    return res.status(409).json({ error: 'No held payment to release for this trip', code: 'NOT_HELD' });
  const { payout } = pay.splitFare(stored.fare);
  store.raw.transaction(() => {
    const driver = store.getUser(c.driver_id);
    if (driver) {
      store.setUserField(driver.id, 'walletBalance', pay.round2((driver.walletBalance || 0) + payout));
      store.addLedger(driver.id, 'earning', payout, 'Trip payout', tripRef(c.id, date, direction));
    }
    store.setConnectionTrip(c.id, date, direction, { status: 'completed', escrowStatus: 'released' });
  })();
  res.json({ ok: true, date, direction, status: 'completed', escrowStatus: 'released', payout });
});

// Skip a trip (either party) or restore a skipped one. A paid trip is refunded.
api.put('/connections/:id/trips', requireAuth, (req, res) => {
  const c = myAcceptedConnection(req, res); if (!c) return;
  const body = validTripBody(req, res); if (!body) return;
  const { date, direction } = body;
  const { status } = req.body || {};
  if (!['scheduled', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Use pay / release for confirming or completing a trip' });
  const stored = store.getConnectionTrip(c.id, date, direction);
  if (status === 'cancelled') {
    if (stored?.status === 'completed') return res.status(409).json({ error: 'Trip already completed' });
    store.raw.transaction(() => {
      if (stored && stored.escrow_status === 'held') {
        const rider = store.getUser(c.rider_id);
        if (rider) {
          store.setUserField(rider.id, 'walletBalance', pay.round2((rider.walletBalance || 0) + stored.fare));
          store.addLedger(rider.id, 'refund', stored.fare, 'Trip cancelled — refund', tripRef(c.id, date, direction));
        }
        store.setConnectionTrip(c.id, date, direction, { status: 'cancelled', escrowStatus: 'refunded' });
      } else {
        store.setConnectionTrip(c.id, date, direction, { status: 'cancelled' });
      }
    })();
    return res.json({ ok: true, date, direction, status: 'cancelled' });
  }
  // restore
  if (stored && stored.status !== 'cancelled')
    return res.status(409).json({ error: 'Only a skipped trip can be restored' });
  store.setConnectionTrip(c.id, date, direction, { status: 'scheduled', escrowStatus: 'none', fare: null });
  res.json({ ok: true, date, direction, status: 'scheduled' });
});

// ---------------------------------------------------------------------------
// Payments (Stripe) — money IN (rider top-up) and money OUT (driver payout).
// Gated on STRIPE_SECRET_KEY; return 503 when payments aren't configured.
// ---------------------------------------------------------------------------
const requirePayments = (_req, res, next) => {
  if (!pay.enabled) return res.status(503).json({ error: 'Payments are not configured yet', code: 'PAYMENTS_DISABLED' });
  next();
};

// Rider tops up their wallet -> hosted Stripe Checkout session.
api.post('/payments/topup/checkout', requireAuth, requirePayments, async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!(amount > 0) || amount > 2000) return res.status(400).json({ error: 'Enter an amount between $1 and $2000' });
  try {
    const session = await pay.createTopupSession({ userId: req.user.id, email: req.user.email, amount: pay.round2(amount) });
    store.recordTopup(session.id, req.user.id, pay.round2(amount));
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(502).json({ error: 'Could not start checkout', code: 'STRIPE_ERROR', detail: err.message });
  }
});

// Confirm a top-up after redirect back from Checkout (idempotent).
api.post('/payments/topup/confirm', requireAuth, requirePayments, async (req, res) => {
  const sessionId = String(req.body?.sessionId || '');
  const rec = store.getTopup(sessionId);
  if (!rec || rec.user_id !== req.user.id) return res.status(404).json({ error: 'Unknown top-up' });
  try {
    const session = await pay.retrieveSession(sessionId);
    const credited = creditTopupSession(session);
    const user = store.getUser(req.user.id);
    res.json({ credited, paid: session.payment_status === 'paid', balance: pay.round2(user.walletBalance || 0) });
  } catch (err) {
    res.status(502).json({ error: 'Could not confirm top-up', code: 'STRIPE_ERROR', detail: err.message });
  }
});

// Driver starts Stripe Connect onboarding -> hosted account link.
api.post('/payments/connect/onboard', requireAuth, requirePayments, async (req, res) => {
  try {
    let accountId = req.user.stripeAccountId;
    if (!accountId) {
      accountId = await pay.getOrCreateConnectAccount(req.user);
      store.setUserStripeAccount(req.user.id, accountId);
    }
    const link = await pay.createAccountLink(accountId);
    res.json({ url: link.url });
  } catch (err) {
    res.status(502).json({ error: 'Could not start payout setup', code: 'STRIPE_ERROR', detail: err.message });
  }
});

api.get('/payments/connect/status', requireAuth, requirePayments, async (req, res) => {
  try {
    const status = await pay.getAccountStatus(req.user.stripeAccountId);
    res.json({ hasAccount: !!req.user.stripeAccountId, ...status });
  } catch (err) {
    res.status(502).json({ error: 'Could not check payout status', code: 'STRIPE_ERROR', detail: err.message });
  }
});

// Driver withdraws earnings -> Stripe transfer to their connected account.
api.post('/payments/payout', requireAuth, requirePayments, async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be positive' });
  if (amount > (req.user.walletBalance || 0)) return res.status(402).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_FUNDS' });
  if (!req.user.stripeAccountId) return res.status(400).json({ error: 'Set up payouts first', code: 'NO_CONNECT_ACCOUNT' });
  const status = await pay.getAccountStatus(req.user.stripeAccountId).catch(() => ({ payoutsEnabled: false }));
  if (!status.payoutsEnabled) return res.status(400).json({ error: 'Your payout account is not ready yet', code: 'PAYOUTS_DISABLED' });
  try {
    await pay.createPayout({ accountId: req.user.stripeAccountId, amount: pay.round2(amount) });
  } catch (err) {
    return res.status(502).json({ error: 'Payout failed', code: 'STRIPE_ERROR', detail: err.message });
  }
  const balance = pay.round2((req.user.walletBalance || 0) - amount);
  store.setUserField(req.user.id, 'walletBalance', balance);
  store.addLedger(req.user.id, 'withdraw', -amount, 'Withdrawal to bank (Stripe)', null);
  res.json({ ok: true, balance });
});

// ---------------------------------------------------------------------------
// Students / matching
// ---------------------------------------------------------------------------
api.get('/students/nearby', (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 10;
  const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : CAMPUS;
  const nearby = store.allUsers()
    .filter((u) => u.homeLocation)
    .map((u) => {
      const d = haversine(origin, u.homeLocation);
      return { id: u.id, name: u.name, role: u.role, location: u.homeLocation, distanceKm: d == null ? null : Math.round(d * 10) / 10 };
    })
    .filter((u) => u.distanceKm != null && u.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  res.json(nearby);
});

// Riders whose home lies roughly along a from->to corridor.
const matchRiders = (from, to) => {
  const a = from || CAMPUS, b = to || CAMPUS;
  const base = haversine(a, b);
  return store.allUsers()
    .filter((u) => u.role === 'rider' && u.homeLocation)
    .map((u) => {
      const d1 = haversine(a, u.homeLocation), d2 = haversine(u.homeLocation, b);
      const detour = d1 == null || d2 == null || base == null ? null : d1 + d2 - base;
      return { id: u.id, name: u.name, rating: u.rating, avatar: u.avatar, location: u.homeLocation, detourKm: detour == null ? null : Math.round(detour * 10) / 10 };
    })
    .filter((m) => m.detourKm != null && m.detourKm <= 8)
    .sort((a2, b2) => a2.detourKm - b2.detourKm);
};

const parsePoint = (q, latKey, lngKey, nameKey) => {
  const lat = Number(q[latKey]), lng = Number(q[lngKey]);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { name: q[nameKey], lat, lng };
  return null;
};

api.get('/matches', (req, res) => {
  const from = parsePoint(req.query, 'fromLat', 'fromLng', 'from');
  const to = parsePoint(req.query, 'toLat', 'toLng', 'to') || CAMPUS;
  res.json(matchRiders(from, to));
});

api.get('/matches/riders', requireAuth, (req, res) => {
  const from = parsePoint(req.query, 'fromLat', 'fromLng', 'from') || req.user.homeLocation;
  const to = parsePoint(req.query, 'toLat', 'toLng', 'to') || CAMPUS;
  res.json(matchRiders(from, to).filter((m) => m.id !== req.user.id));
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
api.get('/verification/me', requireAuth, (req, res) => {
  res.json(store.getVerification(req.user.id));
});

api.post('/verification/upload', requireAuth, upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No document uploaded' });
  store.saveVerificationDoc(req.user.id, {
    status: 'pending',
    note: null,
    submittedAt: new Date().toISOString(),
    document: { filename: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, buffer: req.file.buffer },
  });
  res.status(201).json({ status: 'pending' });
});

// ---------------------------------------------------------------------------
// Admin — verification review queue
// ---------------------------------------------------------------------------
api.get('/admin/verifications', requireAuth, requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const list = store.allUsers()
    .map((u) => ({ u, v: store.getVerification(u.id) }))
    .filter(({ v }) => (v?.status || 'unverified') === status)
    .map(({ u, v }) => ({
      userId: u.id, name: u.name, email: u.email,
      status: v?.status,
      submittedAt: v?.submittedAt || null,
      hasDocument: !!v?.document,
    }));
  res.json(list);
});

api.put('/admin/verifications/:userId', requireAuth, requireAdmin, (req, res) => {
  const uid = Number(req.params.userId);
  const v = store.getVerification(uid);
  const user = userById(uid);
  if (!v || !user) return res.status(404).json({ error: 'Verification not found' });
  const { action, note } = req.body || {};
  let status;
  if (action === 'approve') { status = 'verified'; store.setUserField(uid, 'verified', true); }
  else if (action === 'reject') { status = 'rejected'; store.setUserField(uid, 'verified', false); }
  else return res.status(400).json({ error: 'Invalid action' });
  store.setVerificationStatus(uid, status, note || null);
  res.json({ userId: uid, status, note: note || null });
});

api.get('/admin/verifications/:userId/document', requireAuth, requireAdmin, (req, res) => {
  const v = store.getVerification(Number(req.params.userId));
  if (!v?.document) return res.status(404).json({ error: 'No document' });
  res.set('Content-Type', v.document.mimetype);
  res.send(v.document.buffer);
});

// Admin user directory — every registered user with their verification state.
api.get('/admin/users', requireAuth, requireAdmin, (_req, res) => {
  const list = store.allUsers().map((u) => {
    const v = store.getVerification(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      hasVehicle: !!u.hasVehicle,
      isAdmin: !!u.isAdmin,
      verified: !!u.verified,
      status: v?.status || (u.verified ? 'verified' : 'unverified'),
      hasDocument: !!v?.document,
      rating: u.rating,
      walletBalance: u.walletBalance,
      createdAt: u.createdAt,
    };
  });
  res.json(list);
});

// Admin: payment configuration status (masked — never returns the full key).
api.get('/admin/settings', requireAuth, requireAdmin, (_req, res) => {
  const s = pay.status();
  res.json({
    stripe: { configured: s.enabled, last4: s.secretLast4, fromEnv: s.fromEnv, hasWebhookSecret: s.hasWebhookSecret },
    secretsEncrypted: store.settingsEncrypted(),
  });
});

// Admin: set the Stripe secret + webhook secret (stored encrypted; env wins).
api.put('/admin/settings/stripe', requireAuth, requireAdmin, (req, res) => {
  if (pay.status().fromEnv)
    return res.status(409).json({ error: 'Stripe key is set via environment — change it there, not here.', code: 'ENV_LOCKED' });
  const { secretKey, webhookSecret } = req.body || {};
  if (secretKey !== undefined) {
    if (secretKey && !/^sk_(test|live)_/.test(secretKey))
      return res.status(400).json({ error: 'That doesn’t look like a Stripe secret key (sk_test_… / sk_live_…)' });
    store.setSetting('stripe_secret_key', secretKey || null);
  }
  if (webhookSecret !== undefined) store.setSetting('stripe_webhook_secret', webhookSecret || null);
  // Re-configure the live client from the new stored values.
  pay.configure(store.getSetting('stripe_secret_key'), store.getSetting('stripe_webhook_secret') || undefined);
  res.json({ ok: true, status: pay.status() });
});

// Directly set a user's verified flag (admin override — no document required).
api.put('/admin/users/:userId/verified', requireAuth, requireAdmin, (req, res) => {
  const uid = Number(req.params.userId);
  const user = userById(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const verified = !!req.body?.verified;
  store.setUserField(uid, 'verified', verified);
  store.setVerificationStatus(uid, verified ? 'verified' : 'unverified', null);
  res.json({ userId: uid, verified });
});

// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, users: store.allUsers().length, rides: store.activeRides().length }));
app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`car-pool backend listening on 0.0.0.0:${PORT}`);
  console.log(`Seed logins (password in parens):`);
  console.log(`  admin@latrobe.edu.au (admin123)  — admin + driver`);
  console.log(`  sarah@latrobe.edu.au (password)  — verified driver`);
  console.log(`  tom@latrobe.edu.au   (password)  — verified rider`);
});
