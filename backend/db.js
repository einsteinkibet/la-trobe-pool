/**
 * db.js — SQLite persistence layer for the car-pool backend.
 *
 * Phase 0 of the route-centric rebuild: replace the in-memory store in
 * server.js with a durable SQLite database (better-sqlite3) WITHOUT changing
 * any API response shape. The schema here mirrors exactly the JS objects the
 * old `const db = {...}` held (users, rides, bookings, reviews, schedules,
 * verifications, tokens) so the handlers can stay structurally identical.
 *
 * better-sqlite3 is synchronous, so handler bodies remain synchronous — no
 * async rewrite. This module owns the schema, the seed, and a set of helper
 * accessors that return plain JS objects in the same shape the old code used.
 */
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// --- Password hashing (scrypt, built into Node — no external dependency) ---
// Stored form: "scrypt$<saltHex>$<hashHex>". Anything not in that form is
// treated as a legacy plaintext password (from before hashing was added) so
// existing accounts still log in; those get transparently re-hashed on their
// next successful login (see server.js) or password change.
const hashPassword = (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${dk}`;
};
const isHashed = (stored) => typeof stored === 'string' && stored.startsWith('scrypt$');
const verifyPassword = (plain, stored) => {
  if (!stored) return false;
  if (!isHashed(stored)) return stored === plain; // legacy plaintext fallback
  const [, salt, dk] = stored.split('$');
  const test = crypto.scryptSync(String(plain), salt, 64);
  const dkBuf = Buffer.from(dk, 'hex');
  return dkBuf.length === test.length && crypto.timingSafeEqual(dkBuf, test);
};

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const CAMPUS = { name: 'La Trobe University (Bundoora)', lat: -37.7217, lng: 145.0463 };

// ---------------------------------------------------------------------------
// Schema — mirrors the old in-memory shapes 1:1 so response bodies are
// byte-for-byte the same after JS reshaping (see row->object helpers below).
// Location points (from/to/homeLocation) are stored as flat columns and
// reassembled into { name, lat, lng } objects on read.
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password        TEXT NOT NULL,
  role            TEXT NOT NULL,
  university      TEXT,
  hasVehicle      INTEGER NOT NULL DEFAULT 0,
  vehicleType     TEXT,
  vehicleSeats    INTEGER,
  verified        INTEGER NOT NULL DEFAULT 0,
  isAdmin         INTEGER NOT NULL DEFAULT 0,
  rating          REAL NOT NULL DEFAULT 5,
  reviewCount     INTEGER NOT NULL DEFAULT 0,
  walletBalance   REAL NOT NULL DEFAULT 0,
  avatar          TEXT,
  phone           TEXT,
  home_name       TEXT,
  home_lat        REAL,
  home_lng        REAL,
  createdAt       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rides (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  driverId        INTEGER NOT NULL REFERENCES users(id),
  from_name       TEXT,
  from_lat        REAL,
  from_lng        REAL,
  to_name         TEXT,
  to_lat          REAL,
  to_lng          REAL,
  departureTime   TEXT,
  seatsTotal      INTEGER NOT NULL DEFAULT 3,
  seatsAvailable  INTEGER NOT NULL DEFAULT 3,
  fare            REAL NOT NULL DEFAULT 5,
  vehicleType     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  notes           TEXT,
  createdAt       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rideId          INTEGER NOT NULL REFERENCES rides(id),
  riderId         INTEGER NOT NULL REFERENCES users(id),
  driverId        INTEGER NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL,
  fare            REAL NOT NULL DEFAULT 0,
  escrow          REAL NOT NULL DEFAULT 0,
  createdAt       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingId       INTEGER,
  byUserId        INTEGER NOT NULL REFERENCES users(id),
  aboutUserId     INTEGER NOT NULL REFERENCES users(id),
  rating          INTEGER NOT NULL DEFAULT 5,
  comment         TEXT,
  createdAt       TEXT NOT NULL
);

-- schedules: one row per user (old db.schedules[userId] = { days, arriveBy, leaveAt }).
-- days stored as a JSON array string.
CREATE TABLE IF NOT EXISTS schedules (
  userId          INTEGER PRIMARY KEY REFERENCES users(id),
  days            TEXT NOT NULL DEFAULT '[]',
  arriveBy        TEXT,
  leaveAt         TEXT
);

-- verifications: one row per user (old db.verifications[userId]).
-- The uploaded document is stored as a BLOB plus its metadata.
CREATE TABLE IF NOT EXISTS verifications (
  userId          INTEGER PRIMARY KEY REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'unverified',
  note            TEXT,
  submittedAt     TEXT,
  doc_filename    TEXT,
  doc_mimetype    TEXT,
  doc_size        INTEGER,
  doc_buffer      BLOB
);

CREATE TABLE IF NOT EXISTS tokens (
  token           TEXT PRIMARY KEY,
  userId          INTEGER NOT NULL REFERENCES users(id)
);
`);

// ---------------------------------------------------------------------------
// Phase 1 — Route concept. A Route is a recurring commute template a verified
// student offers (driver) or seeks (rider). route_days holds the per-weekday
// schedule (0=Mon..6=Sun) with an outbound start_time and an optional
// return_time. trip_occurrences are the concrete (route, date, direction)
// instances, created lazily (insert-or-ignore) when first needed; a driver
// occurrence is "opened" into a single ride (rides.occurrence_id UNIQUE).
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS routes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  role            TEXT NOT NULL,                 -- 'driver' | 'rider'
  direction       TEXT NOT NULL DEFAULT 'to_campus', -- 'to_campus' | 'from_campus'
  origin_name     TEXT,
  origin_suburb   TEXT,
  origin_lat      REAL,
  origin_lng      REAL,
  dest_name       TEXT,
  dest_suburb     TEXT,
  dest_lat        REAL,
  dest_lng        REAL,
  seats           INTEGER NOT NULL DEFAULT 3,
  vehicle_type    TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  createdAt       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS route_days (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id        INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  weekday         INTEGER NOT NULL,              -- 0=Mon .. 6=Sun
  start_time      TEXT,                          -- outbound HH:MM
  return_time     TEXT,                          -- nullable = no return trip
  UNIQUE(route_id, weekday)
);

CREATE TABLE IF NOT EXISTS trip_occurrences (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id        INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  trip_date       TEXT NOT NULL,                 -- YYYY-MM-DD
  direction       TEXT NOT NULL,                 -- 'to_campus' | 'from_campus'
  depart_time     TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  UNIQUE(route_id, trip_date, direction)
);
`);

// Guarded migrations for columns added to pre-existing tables. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so check pragma table_info first.
const hasColumn = (table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
if (!hasColumn('rides', 'occurrence_id')) {
  db.exec('ALTER TABLE rides ADD COLUMN occurrence_id INTEGER REFERENCES trip_occurrences(id)');
}
if (!hasColumn('bookings', 'rider_occurrence_id')) {
  db.exec('ALTER TABLE bookings ADD COLUMN rider_occurrence_id INTEGER REFERENCES trip_occurrences(id)');
}

// One ride per driver occurrence; one active booking per rider per trip occurrence.
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ride_occurrence
  ON rides(occurrence_id) WHERE occurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rider_active_trip
  ON bookings(riderId, rider_occurrence_id)
  WHERE rider_occurrence_id IS NOT NULL AND status IN ('pending','invited','accepted');
`);

// route_connections — a lightweight "request to ride together" between a rider
// route and a driver route. No money moves through the platform at soft-launch:
// once accepted, both parties see the suggested pickup + each other's contact
// and arrange payment (cash/PayID) themselves.
db.exec(`
CREATE TABLE IF NOT EXISTS route_connections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_route_id  INTEGER NOT NULL REFERENCES routes(id),
  driver_route_id INTEGER NOT NULL REFERENCES routes(id),
  rider_id        INTEGER NOT NULL REFERENCES users(id),
  driver_id       INTEGER NOT NULL REFERENCES users(id),
  requested_by    TEXT NOT NULL,                 -- 'rider' | 'driver' (who initiated)
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled
  meet_name       TEXT,
  meet_lat        REAL,
  meet_lng        REAL,
  createdAt       TEXT NOT NULL,
  respondedAt     TEXT
);
-- At most one active connection per rider-route + driver-route pair.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_connection
  ON route_connections(rider_route_id, driver_route_id)
  WHERE status IN ('pending','accepted');
`);

// connection_trips — concrete per-date instances of an accepted connection's
// recurring commute. Rows are created lazily: a trip only gets a row once
// someone acts on it (confirm/cancel/complete); everything else defaults to
// 'scheduled'. This is the recurring-trip booking ledger (no money yet).
db.exec(`
CREATE TABLE IF NOT EXISTS connection_trips (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id  INTEGER NOT NULL REFERENCES route_connections(id),
  trip_date      TEXT NOT NULL,                  -- YYYY-MM-DD
  direction      TEXT NOT NULL,                  -- 'to_campus' | 'from_campus'
  status         TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | confirmed | cancelled | completed
  updatedAt      TEXT NOT NULL,
  UNIQUE(connection_id, trip_date, direction)
);
`);

// In-app chat — one thread per accepted connection so riders & drivers coordinate
// entirely in the app (no phone/email exchange needed). read_at marks when the
// recipient has seen a message (for unread badges).
db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id  INTEGER NOT NULL REFERENCES route_connections(id),
  sender_id      INTEGER NOT NULL REFERENCES users(id),
  body           TEXT NOT NULL,
  createdAt      TEXT NOT NULL,
  read_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conn ON messages(connection_id);
`);

// --- Payments schema (real money via Stripe at the edges; internal ledger for
// the per-trip rider->driver escrow). ---
// Stripe Connect account id for a driver's payouts.
if (!hasColumn('users', 'stripe_account_id')) {
  db.exec('ALTER TABLE users ADD COLUMN stripe_account_id TEXT');
}
// Per-trip fare (dollars) and escrow lifecycle: none|held|released|refunded.
if (!hasColumn('connection_trips', 'fare')) {
  db.exec('ALTER TABLE connection_trips ADD COLUMN fare REAL');
}
if (!hasColumn('connection_trips', 'escrow_status')) {
  db.exec("ALTER TABLE connection_trips ADD COLUMN escrow_status TEXT NOT NULL DEFAULT 'none'");
}

// --- Referral / invite system ---
// referral_code: this user's own shareable code. referred_by: the id of whoever
// invited them (set once, at signup).
if (!hasColumn('users', 'referral_code')) db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT');
if (!hasColumn('users', 'referred_by')) db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL');

// Generate a short, unambiguous code (no 0/O/1/I) that isn't already taken.
const genReferralCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const exists = db.prepare('SELECT 1 FROM users WHERE referral_code = ?');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!exists.get(code)) return code;
  }
  return `R${Date.now().toString(36).toUpperCase()}`; // fallback, effectively unique
};

// Backfill codes for any pre-existing users that don't have one yet.
for (const row of db.prepare('SELECT id FROM users WHERE referral_code IS NULL').all()) {
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(genReferralCode(), row.id);
}

db.exec(`
-- Money-movement history for a user's wallet (topup/spend/earning/refund/withdraw).
CREATE TABLE IF NOT EXISTS ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,                       -- topup|spend|earning|refund|withdraw|fee
  amount     REAL NOT NULL,                       -- signed dollars (+credit / -debit)
  note       TEXT,
  ref        TEXT,                                -- e.g. "trip:12:2026-09-07:to_campus" or a session id
  createdAt  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);

-- Stripe top-up checkout sessions, for idempotent crediting on success.
CREATE TABLE IF NOT EXISTS stripe_topups (
  session_id TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  amount     REAL NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',     -- pending | credited
  createdAt  TEXT NOT NULL
);

-- App settings (key/value) — used to hold secrets (e.g. the Stripe key) when an
-- admin enters them via the UI instead of env vars. Values are stored ENCRYPTED
-- (see below) and are NEVER returned to the client (server.js exposes only a
-- masked status). Prefer env vars in production.
CREATE TABLE IF NOT EXISTS settings (
  key       TEXT PRIMARY KEY,
  value     TEXT,
  updatedAt TEXT NOT NULL
);
`);

// Secrets at rest: AES-256-GCM when SETTINGS_SECRET is set, else base64 (with a
// startup warning). A stored value is tagged 'enc:'/'plain:' so decrypt can tell.
const SETTINGS_SECRET = process.env.SETTINGS_SECRET || '';
const settingsKey = SETTINGS_SECRET ? crypto.scryptSync(SETTINGS_SECRET, 'unipool-settings', 32) : null;
if (!settingsKey) {
  // eslint-disable-next-line no-console
  console.warn('[settings] SETTINGS_SECRET not set — stored secrets are only base64-obfuscated, not encrypted. Set SETTINGS_SECRET (or use env vars) in production.');
}
const encryptSecret = (plain) => {
  if (plain == null) return null;
  if (!settingsKey) return `plain:${Buffer.from(String(plain), 'utf8').toString('base64')}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', settingsKey, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `enc:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
};
const decryptSecret = (stored) => {
  if (!stored) return null;
  if (stored.startsWith('plain:')) return Buffer.from(stored.slice(6), 'base64').toString('utf8');
  if (stored.startsWith('enc:')) {
    if (!settingsKey) return null; // encrypted previously but no key available now
    const [, ivh, tagh, cth] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', settingsKey, Buffer.from(ivh, 'hex'));
    decipher.setAuthTag(Buffer.from(tagh, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(cth, 'hex')), decipher.final()]).toString('utf8');
  }
  return stored;
};

// ---------------------------------------------------------------------------
// Row <-> object helpers. The old code passed around objects with a nested
// homeLocation/from/to and JS booleans; SQLite gives us flat columns and
// 0/1 ints, so we reshape on read to keep every response body identical.
// ---------------------------------------------------------------------------
const point = (name, lat, lng) =>
  lat == null && lng == null && name == null ? null : { name: name ?? undefined, lat, lng };

const rowToUser = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password: r.password,
    role: r.role,
    university: r.university,
    hasVehicle: !!r.hasVehicle,
    vehicleType: r.vehicleType,
    vehicleSeats: r.vehicleSeats,
    verified: !!r.verified,
    isAdmin: !!r.isAdmin,
    rating: r.rating,
    reviewCount: r.reviewCount,
    walletBalance: r.walletBalance,
    stripeAccountId: r.stripe_account_id || null,
    avatar: r.avatar,
    phone: r.phone || '',
    homeLocation: r.home_lat == null && r.home_lng == null && r.home_name == null
      ? null
      : { name: r.home_name, lat: r.home_lat, lng: r.home_lng },
    referralCode: r.referral_code || null,
    referredBy: r.referred_by || null,
    createdAt: r.createdAt,
  };
};

const rowToRide = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    driverId: r.driverId,
    from: point(r.from_name, r.from_lat, r.from_lng),
    to: point(r.to_name, r.to_lat, r.to_lng),
    departureTime: r.departureTime,
    seatsTotal: r.seatsTotal,
    seatsAvailable: r.seatsAvailable,
    fare: r.fare,
    vehicleType: r.vehicleType,
    status: r.status,
    notes: r.notes || '',
    createdAt: r.createdAt,
  };
};

const rowToBooking = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    rideId: r.rideId,
    riderId: r.riderId,
    driverId: r.driverId,
    status: r.status,
    fare: r.fare,
    escrow: r.escrow,
    createdAt: r.createdAt,
  };
};

const rowToReview = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    bookingId: r.bookingId,
    byUserId: r.byUserId,
    aboutUserId: r.aboutUserId,
    rating: r.rating,
    comment: r.comment || '',
    createdAt: r.createdAt,
  };
};

const rowToVerification = (r) => {
  if (!r) return { status: 'unverified', document: null, note: null };
  return {
    status: r.status,
    note: r.note ?? null,
    submittedAt: r.submittedAt ?? undefined,
    document: r.doc_buffer
      ? { filename: r.doc_filename, mimetype: r.doc_mimetype, size: r.doc_size, buffer: r.doc_buffer }
      : null,
  };
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const rowToRouteDay = (r) => ({
  weekday: r.weekday,
  day: WEEKDAY_LABELS[r.weekday] ?? String(r.weekday),
  start_time: r.start_time ?? null,
  return_time: r.return_time ?? null,
});

// A route plus its per-weekday schedule. Location columns reassemble into
// origin/dest point objects; `days` is the ordered route_days list.
const rowToRoute = (r, days = []) => {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    role: r.role,
    direction: r.direction,
    origin: r.origin_lat == null && r.origin_lng == null && r.origin_name == null
      ? null : { name: r.origin_name, suburb: r.origin_suburb, lat: r.origin_lat, lng: r.origin_lng },
    dest: r.dest_lat == null && r.dest_lng == null && r.dest_name == null
      ? null : { name: r.dest_name, suburb: r.dest_suburb, lat: r.dest_lat, lng: r.dest_lng },
    seats: r.seats,
    vehicle_type: r.vehicle_type,
    notes: r.notes || '',
    status: r.status,
    days: days.map(rowToRouteDay),
    createdAt: r.createdAt,
  };
};

const rowToOccurrence = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    route_id: r.route_id,
    trip_date: r.trip_date,
    direction: r.direction,
    depart_time: r.depart_time ?? null,
    status: r.status,
  };
};

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (name, email, password, role, university, hasVehicle, vehicleType,
      vehicleSeats, verified, isAdmin, rating, reviewCount, walletBalance, avatar, phone,
      home_name, home_lat, home_lng, createdAt)
    VALUES (@name, @email, @password, @role, @university, @hasVehicle, @vehicleType,
      @vehicleSeats, @verified, @isAdmin, @rating, @reviewCount, @walletBalance, @avatar, @phone,
      @home_name, @home_lat, @home_lng, @createdAt)
  `),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  allUsers: db.prepare('SELECT * FROM users'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  updateUserField: (field) => db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`),

  insertRide: db.prepare(`
    INSERT INTO rides (driverId, from_name, from_lat, from_lng, to_name, to_lat, to_lng,
      departureTime, seatsTotal, seatsAvailable, fare, vehicleType, status, notes, createdAt)
    VALUES (@driverId, @from_name, @from_lat, @from_lng, @to_name, @to_lat, @to_lng,
      @departureTime, @seatsTotal, @seatsAvailable, @fare, @vehicleType, @status, @notes, @createdAt)
  `),
  rideById: db.prepare('SELECT * FROM rides WHERE id = ?'),
  ridesByDriver: db.prepare('SELECT * FROM rides WHERE driverId = ?'),
  activeRides: db.prepare("SELECT * FROM rides WHERE status = 'active'"),

  insertBooking: db.prepare(`
    INSERT INTO bookings (rideId, riderId, driverId, status, fare, escrow, createdAt)
    VALUES (@rideId, @riderId, @driverId, @status, @fare, @escrow, @createdAt)
  `),
  bookingById: db.prepare('SELECT * FROM bookings WHERE id = ?'),
  bookingsByRider: db.prepare('SELECT * FROM bookings WHERE riderId = ?'),
  bookingsByRide: db.prepare('SELECT * FROM bookings WHERE rideId = ?'),
  bookingsForUser: db.prepare('SELECT * FROM bookings WHERE riderId = ? OR driverId = ?'),

  insertReview: db.prepare(`
    INSERT INTO reviews (bookingId, byUserId, aboutUserId, rating, comment, createdAt)
    VALUES (@bookingId, @byUserId, @aboutUserId, @rating, @comment, @createdAt)
  `),
  reviewsAbout: db.prepare('SELECT * FROM reviews WHERE aboutUserId = ?'),
  reviewById: db.prepare('SELECT * FROM reviews WHERE id = ?'),
  reviewByBooking: db.prepare('SELECT 1 FROM reviews WHERE bookingId = ? LIMIT 1'),

  getSchedule: db.prepare('SELECT * FROM schedules WHERE userId = ?'),
  upsertSchedule: db.prepare(`
    INSERT INTO schedules (userId, days, arriveBy, leaveAt)
    VALUES (@userId, @days, @arriveBy, @leaveAt)
    ON CONFLICT(userId) DO UPDATE SET days = @days, arriveBy = @arriveBy, leaveAt = @leaveAt
  `),

  getVerification: db.prepare('SELECT * FROM verifications WHERE userId = ?'),
  insertVerificationDefault: db.prepare(`
    INSERT OR IGNORE INTO verifications (userId, status) VALUES (?, ?)
  `),
  upsertVerificationDoc: db.prepare(`
    INSERT INTO verifications (userId, status, note, submittedAt, doc_filename, doc_mimetype, doc_size, doc_buffer)
    VALUES (@userId, @status, @note, @submittedAt, @doc_filename, @doc_mimetype, @doc_size, @doc_buffer)
    ON CONFLICT(userId) DO UPDATE SET status=@status, note=@note, submittedAt=@submittedAt,
      doc_filename=@doc_filename, doc_mimetype=@doc_mimetype, doc_size=@doc_size, doc_buffer=@doc_buffer
  `),
  setVerificationStatus: db.prepare('UPDATE verifications SET status = ?, note = ? WHERE userId = ?'),

  insertToken: db.prepare('INSERT INTO tokens (token, userId) VALUES (?, ?)'),
  tokenUser: db.prepare('SELECT userId FROM tokens WHERE token = ?'),

  // --- routes ---
  insertRoute: db.prepare(`
    INSERT INTO routes (user_id, role, direction, origin_name, origin_suburb, origin_lat, origin_lng,
      dest_name, dest_suburb, dest_lat, dest_lng, seats, vehicle_type, notes, status, createdAt)
    VALUES (@user_id, @role, @direction, @origin_name, @origin_suburb, @origin_lat, @origin_lng,
      @dest_name, @dest_suburb, @dest_lat, @dest_lng, @seats, @vehicle_type, @notes, @status, @createdAt)
  `),
  routeById: db.prepare('SELECT * FROM routes WHERE id = ?'),
  routesByUser: db.prepare("SELECT * FROM routes WHERE user_id = ? AND status != 'deleted' ORDER BY id DESC"),
  routesByRole: db.prepare("SELECT * FROM routes WHERE role = ? AND status = 'active'"),
  updateRouteStatus: db.prepare('UPDATE routes SET status = ? WHERE id = ?'),
  deleteRouteRow: db.prepare('DELETE FROM routes WHERE id = ?'),

  insertRouteDay: db.prepare(`
    INSERT INTO route_days (route_id, weekday, start_time, return_time)
    VALUES (@route_id, @weekday, @start_time, @return_time)
    ON CONFLICT(route_id, weekday) DO UPDATE SET start_time=@start_time, return_time=@return_time
  `),
  daysForRoute: db.prepare('SELECT * FROM route_days WHERE route_id = ? ORDER BY weekday'),
  deleteDaysForRoute: db.prepare('DELETE FROM route_days WHERE route_id = ?'),

  // --- occurrences ---
  insertOccurrence: db.prepare(`
    INSERT OR IGNORE INTO trip_occurrences (route_id, trip_date, direction, depart_time, status)
    VALUES (@route_id, @trip_date, @direction, @depart_time, 'scheduled')
  `),
  getOccurrence: db.prepare('SELECT * FROM trip_occurrences WHERE route_id = ? AND trip_date = ? AND direction = ?'),
  occurrenceById: db.prepare('SELECT * FROM trip_occurrences WHERE id = ?'),
  rideByOccurrence: db.prepare('SELECT * FROM rides WHERE occurrence_id = ?'),
};

// ---------------------------------------------------------------------------
// Accessor API — what server.js consumes. Each returns reshaped plain objects.
// ---------------------------------------------------------------------------
const toUserParams = (u) => ({
  name: u.name,
  email: u.email,
  password: u.password,
  role: u.role,
  university: u.university,
  hasVehicle: u.hasVehicle ? 1 : 0,
  vehicleType: u.vehicleType ?? null,
  vehicleSeats: u.vehicleSeats ?? null,
  verified: u.verified ? 1 : 0,
  isAdmin: u.isAdmin ? 1 : 0,
  rating: u.rating,
  reviewCount: u.reviewCount,
  walletBalance: u.walletBalance,
  avatar: u.avatar ?? null,
  phone: u.phone ?? '',
  home_name: u.homeLocation?.name ?? null,
  home_lat: u.homeLocation?.lat ?? null,
  home_lng: u.homeLocation?.lng ?? null,
  createdAt: u.createdAt,
});

const data = {
  CAMPUS,
  raw: db, // escape hatch for transactions in later phases

  // --- users ---
  hashPassword,
  verifyPassword,
  isHashed,

  createUser(u) {
    // Never persist a plaintext password: hash on the way in (idempotent —
    // an already-hashed value is left as-is).
    if (u.password != null && !isHashed(u.password)) u = { ...u, password: hashPassword(u.password) };
    const info = stmts.insertUser.run(toUserParams(u));
    const id = info.lastInsertRowid;
    stmts.insertVerificationDefault.run(id, u.verified ? 'verified' : 'unverified');
    // Every user gets their own shareable referral code.
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(genReferralCode(), id);
    return rowToUser(stmts.userById.get(id));
  },
  getUser: (id) => rowToUser(stmts.userById.get(id)),
  getUserByEmail: (email) => rowToUser(stmts.userByEmail.get((email || '').toLowerCase())),
  getUserByReferralCode: (code) =>
    rowToUser(db.prepare('SELECT * FROM users WHERE referral_code = ?').get((code || '').toUpperCase())),
  // Link a new user to whoever invited them (set once).
  setReferredBy: (userId, referrerId) =>
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrerId, userId),
  // Users this person has successfully invited (newest first).
  referralsForUser: (userId) =>
    db.prepare('SELECT id, name, createdAt FROM users WHERE referred_by = ? ORDER BY id DESC').all(userId),
  allUsers: () => stmts.allUsers.all().map(rowToUser),
  // Cascade-delete a user and everything tied to them. These child tables were
  // created without ON DELETE CASCADE, so a plain DELETE users hit a FOREIGN KEY
  // constraint (any user who'd created a route could never delete their account).
  // We clear the whole graph in one transaction. FK enforcement is toggled off
  // for the duration so intra-graph ordering can't trip us up — better-sqlite3 is
  // synchronous, so nothing else runs in between (pragma must be set outside the
  // transaction; it's a no-op inside one).
  deleteUser: (id) => {
    const routeIds = db.prepare('SELECT id FROM routes WHERE user_id = ?').all(id).map((r) => r.id);
    const rideIds = db.prepare('SELECT id FROM rides WHERE driverId = ?').all(id).map((r) => r.id);
    const inList = (arr) => (arr.length ? `(${arr.join(',')})` : '(NULL)');
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        const connSel = `SELECT id FROM route_connections WHERE rider_id=? OR driver_id=? OR rider_route_id IN ${inList(routeIds)} OR driver_route_id IN ${inList(routeIds)}`;
        db.prepare(`DELETE FROM messages WHERE sender_id=? OR connection_id IN (${connSel})`).run(id, id, id);
        db.prepare(`DELETE FROM connection_trips WHERE connection_id IN (${connSel})`).run(id, id);
        db.prepare(`DELETE FROM route_connections WHERE rider_id=? OR driver_id=? OR rider_route_id IN ${inList(routeIds)} OR driver_route_id IN ${inList(routeIds)}`).run(id, id);
        db.prepare(`DELETE FROM bookings WHERE riderId=? OR driverId=? OR rideId IN ${inList(rideIds)}`).run(id, id);
        db.prepare('DELETE FROM rides WHERE driverId=?').run(id);
        db.prepare(`DELETE FROM route_days WHERE route_id IN ${inList(routeIds)}`).run();
        db.prepare(`DELETE FROM trip_occurrences WHERE route_id IN ${inList(routeIds)}`).run();
        db.prepare('DELETE FROM routes WHERE user_id=?').run(id);
        db.prepare('DELETE FROM reviews WHERE byUserId=? OR aboutUserId=?').run(id, id);
        db.prepare('DELETE FROM schedules WHERE userId=?').run(id);
        db.prepare('DELETE FROM verifications WHERE userId=?').run(id);
        db.prepare('DELETE FROM tokens WHERE userId=?').run(id);
        db.prepare('DELETE FROM ledger WHERE user_id=?').run(id);
        db.prepare('DELETE FROM stripe_topups WHERE user_id=?').run(id);
        db.prepare('DELETE FROM users WHERE id=?').run(id);
      })();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  },
  // Persist a single edited field on a user (mirrors mutating req.user in place).
  setUserField(id, field, value) {
    const col = {
      name: 'name', phone: 'phone', avatar: 'avatar', vehicleType: 'vehicleType',
      vehicleSeats: 'vehicleSeats', hasVehicle: 'hasVehicle', role: 'role',
      password: 'password', verified: 'verified', walletBalance: 'walletBalance',
      rating: 'rating', reviewCount: 'reviewCount',
    }[field];
    if (field === 'homeLocation') {
      db.prepare('UPDATE users SET home_name = ?, home_lat = ?, home_lng = ? WHERE id = ?')
        .run(value?.name ?? null, value?.lat ?? null, value?.lng ?? null, id);
      return;
    }
    if (!col) return;
    let v = value;
    if (col === 'hasVehicle' || col === 'verified') v = value ? 1 : 0;
    // A password set through here must also be hashed (change-password, rehash).
    if (col === 'password' && !isHashed(v)) v = hashPassword(v);
    stmts.updateUserField(col).run(v, id);
  },

  // --- rides ---
  createRide(r) {
    const info = stmts.insertRide.run({
      driverId: r.driverId,
      from_name: r.from?.name ?? null, from_lat: r.from?.lat ?? null, from_lng: r.from?.lng ?? null,
      to_name: r.to?.name ?? null, to_lat: r.to?.lat ?? null, to_lng: r.to?.lng ?? null,
      departureTime: r.departureTime ?? null,
      seatsTotal: r.seatsTotal, seatsAvailable: r.seatsAvailable,
      fare: r.fare, vehicleType: r.vehicleType ?? null,
      status: r.status, notes: r.notes ?? '', createdAt: r.createdAt,
    });
    const id = info.lastInsertRowid;
    // occurrence_id was added by migration, so it isn't in the insert column
    // list — set it separately when a lazily-opened ride is tied to a trip.
    if (r.occurrence_id != null) {
      db.prepare('UPDATE rides SET occurrence_id = ? WHERE id = ?').run(r.occurrence_id, id);
    }
    return rowToRide(stmts.rideById.get(id));
  },
  getRide: (id) => rowToRide(stmts.rideById.get(id)),
  ridesByDriver: (driverId) => stmts.ridesByDriver.all(driverId).map(rowToRide),
  activeRides: () => stmts.activeRides.all().map(rowToRide),
  // Apply an arbitrary patch to a ride (used by PUT /rides/:id and seat/status moves).
  updateRide(id, patch) {
    const cols = {
      from: null, to: null, departureTime: 'departureTime', seatsTotal: 'seatsTotal',
      seatsAvailable: 'seatsAvailable', fare: 'fare', vehicleType: 'vehicleType',
      status: 'status', notes: 'notes',
    };
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'from' || k === 'to') {
        sets.push(`${k}_name = ?`, `${k}_lat = ?`, `${k}_lng = ?`);
        vals.push(v?.name ?? null, v?.lat ?? null, v?.lng ?? null);
      } else if (cols[k]) {
        sets.push(`${cols[k]} = ?`);
        vals.push(v);
      }
    }
    if (sets.length) {
      db.prepare(`UPDATE rides SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    }
    return rowToRide(stmts.rideById.get(id));
  },

  // --- bookings ---
  createBooking(b) {
    const info = stmts.insertBooking.run({
      rideId: b.rideId, riderId: b.riderId, driverId: b.driverId,
      status: b.status, fare: b.fare, escrow: b.escrow, createdAt: b.createdAt,
    });
    return rowToBooking(stmts.bookingById.get(info.lastInsertRowid));
  },
  getBooking: (id) => rowToBooking(stmts.bookingById.get(id)),
  bookingsByRider: (riderId) => stmts.bookingsByRider.all(riderId).map(rowToBooking),
  bookingsByRide: (rideId) => stmts.bookingsByRide.all(rideId).map(rowToBooking),
  bookingsForUser: (userId) => stmts.bookingsForUser.all(userId, userId).map(rowToBooking),
  updateBooking(id, patch) {
    const allowed = ['status', 'fare', 'escrow'];
    const sets = [];
    const vals = [];
    for (const k of allowed) if (k in patch) { sets.push(`${k} = ?`); vals.push(patch[k]); }
    if (sets.length) db.prepare(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return rowToBooking(stmts.bookingById.get(id));
  },

  // --- reviews ---
  createReview(r) {
    const info = stmts.insertReview.run({
      bookingId: r.bookingId ?? null, byUserId: r.byUserId, aboutUserId: r.aboutUserId,
      rating: r.rating, comment: r.comment ?? '', createdAt: r.createdAt,
    });
    return rowToReview(stmts.reviewById.get(info.lastInsertRowid));
  },
  reviewsAbout: (aboutUserId) => stmts.reviewsAbout.all(aboutUserId).map(rowToReview),
  bookingReviewed: (bookingId) => stmts.reviewByBooking.get(bookingId) != null,

  // --- schedules ---
  getSchedule(userId) {
    const r = stmts.getSchedule.get(userId);
    if (!r) return { days: [], arriveBy: null, leaveAt: null };
    return { days: JSON.parse(r.days || '[]'), arriveBy: r.arriveBy ?? null, leaveAt: r.leaveAt ?? null };
  },
  setSchedule(userId, { days, arriveBy, leaveAt }) {
    stmts.upsertSchedule.run({
      userId, days: JSON.stringify(days || []), arriveBy: arriveBy || null, leaveAt: leaveAt || null,
    });
    return this.getSchedule(userId);
  },

  // --- verifications ---
  getVerification: (userId) => rowToVerification(stmts.getVerification.get(userId)),
  saveVerificationDoc(userId, { status, note, submittedAt, document }) {
    stmts.upsertVerificationDoc.run({
      userId, status, note: note ?? null, submittedAt: submittedAt ?? null,
      doc_filename: document?.filename ?? null, doc_mimetype: document?.mimetype ?? null,
      doc_size: document?.size ?? null, doc_buffer: document?.buffer ?? null,
    });
  },
  setVerificationStatus: (userId, status, note) =>
    stmts.setVerificationStatus.run(status, note ?? null, userId),

  // --- tokens ---
  saveToken: (token, userId) => stmts.insertToken.run(token, userId),
  userIdForToken: (token) => stmts.tokenUser.get(token)?.userId ?? null,

  // --- routes (recurring commute templates) ---
  createRoute(r) {
    const info = stmts.insertRoute.run({
      user_id: r.user_id,
      role: r.role,
      direction: r.direction || 'to_campus',
      origin_name: r.origin?.name ?? null,
      origin_suburb: r.origin?.suburb ?? null,
      origin_lat: r.origin?.lat ?? null,
      origin_lng: r.origin?.lng ?? null,
      dest_name: r.dest?.name ?? null,
      dest_suburb: r.dest?.suburb ?? null,
      dest_lat: r.dest?.lat ?? null,
      dest_lng: r.dest?.lng ?? null,
      seats: r.seats ?? 3,
      vehicle_type: r.vehicle_type ?? null,
      notes: r.notes ?? '',
      status: r.status || 'active',
      createdAt: r.createdAt || new Date().toISOString(),
    });
    const id = info.lastInsertRowid;
    if (Array.isArray(r.days) && r.days.length) this.setRouteDays(id, r.days);
    return this.getRoute(id);
  },
  getRoute(id) {
    const r = stmts.routeById.get(id);
    if (!r) return null;
    return rowToRoute(r, stmts.daysForRoute.all(id));
  },
  routesByUser: (userId) =>
    stmts.routesByUser.all(userId).map((r) => rowToRoute(r, stmts.daysForRoute.all(r.id))),
  routesByRole: (role) =>
    stmts.routesByRole.all(role).map((r) => rowToRoute(r, stmts.daysForRoute.all(r.id))),
  updateRouteStatus(id, status) {
    stmts.updateRouteStatus.run(status, id);
    return this.getRoute(id);
  },
  // Apply an arbitrary patch to a route (origin/dest points reshape to flat cols).
  updateRoute(id, patch) {
    const cols = { direction: 'direction', seats: 'seats', vehicle_type: 'vehicle_type', notes: 'notes', status: 'status' };
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'origin' || k === 'dest') {
        sets.push(`${k}_name = ?`, `${k}_suburb = ?`, `${k}_lat = ?`, `${k}_lng = ?`);
        vals.push(v?.name ?? null, v?.suburb ?? null, v?.lat ?? null, v?.lng ?? null);
      } else if (cols[k]) {
        sets.push(`${cols[k]} = ?`);
        vals.push(v);
      }
    }
    if (sets.length) db.prepare(`UPDATE routes SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.getRoute(id);
  },
  deleteRoute: (id) => stmts.deleteRouteRow.run(id),
  // Replace the whole per-weekday schedule for a route in one transaction.
  setRouteDays(routeId, days) {
    db.transaction((rid, ds) => {
      stmts.deleteDaysForRoute.run(rid);
      for (const d of ds) {
        stmts.insertRouteDay.run({
          route_id: rid,
          weekday: d.weekday,
          start_time: d.start_time ?? null,
          return_time: d.return_time ?? null,
        });
      }
    })(routeId, days || []);
    return stmts.daysForRoute.all(routeId).map(rowToRouteDay);
  },
  daysForRoute: (routeId) => stmts.daysForRoute.all(routeId).map(rowToRouteDay),

  // --- trip occurrences (concrete route+date+direction instances) ---
  ensureOccurrence(routeId, tripDate, direction, departTime) {
    stmts.insertOccurrence.run({
      route_id: routeId, trip_date: tripDate, direction, depart_time: departTime ?? null,
    });
    return rowToOccurrence(stmts.getOccurrence.get(routeId, tripDate, direction));
  },
  getOccurrenceById: (id) => rowToOccurrence(stmts.occurrenceById.get(id)),
  rideByOccurrence: (occId) => rowToRide(stmts.rideByOccurrence.get(occId)),

  // --- route connections ("request to ride together") ---
  createConnection(c) {
    const info = db.prepare(`
      INSERT INTO route_connections
        (rider_route_id, driver_route_id, rider_id, driver_id, requested_by, status,
         meet_name, meet_lat, meet_lng, createdAt)
      VALUES (@rider_route_id, @driver_route_id, @rider_id, @driver_id, @requested_by, @status,
              @meet_name, @meet_lat, @meet_lng, @createdAt)
    `).run({
      rider_route_id: c.rider_route_id, driver_route_id: c.driver_route_id,
      rider_id: c.rider_id, driver_id: c.driver_id,
      requested_by: c.requested_by, status: c.status || 'pending',
      meet_name: c.meet?.name ?? null, meet_lat: c.meet?.lat ?? null, meet_lng: c.meet?.lng ?? null,
      createdAt: c.createdAt || new Date().toISOString(),
    });
    return this.getConnection(info.lastInsertRowid);
  },
  getConnection: (id) => db.prepare('SELECT * FROM route_connections WHERE id = ?').get(id) || null,
  // Any connection (pending/accepted) already linking these two routes.
  activeConnectionForRoutes: (riderRouteId, driverRouteId) =>
    db.prepare(
      "SELECT * FROM route_connections WHERE rider_route_id = ? AND driver_route_id = ? AND status IN ('pending','accepted')",
    ).get(riderRouteId, driverRouteId) || null,
  // Every connection this user is a party to, newest first.
  connectionsForUser: (userId) =>
    db.prepare('SELECT * FROM route_connections WHERE rider_id = ? OR driver_id = ? ORDER BY id DESC')
      .all(userId, userId),
  setConnectionStatus(id, status) {
    db.prepare('UPDATE route_connections SET status = ?, respondedAt = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id);
    return this.getConnection(id);
  },

  // --- in-app chat (one thread per connection) ---
  addMessage(connectionId, senderId, body) {
    const createdAt = new Date().toISOString();
    const info = db.prepare('INSERT INTO messages (connection_id, sender_id, body, createdAt) VALUES (?, ?, ?, ?)')
      .run(connectionId, senderId, body, createdAt);
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  },
  messagesForConnection: (connectionId) =>
    db.prepare('SELECT * FROM messages WHERE connection_id = ? ORDER BY id ASC').all(connectionId),
  lastMessageForConnection: (connectionId) =>
    db.prepare('SELECT * FROM messages WHERE connection_id = ? ORDER BY id DESC LIMIT 1').get(connectionId) || null,
  // Mark all messages the reader DIDN'T send as read (they've now seen them).
  markMessagesRead(connectionId, readerId) {
    db.prepare("UPDATE messages SET read_at = ? WHERE connection_id = ? AND sender_id != ? AND read_at IS NULL")
      .run(new Date().toISOString(), connectionId, readerId);
  },
  // Unread counts for this user across all their connections: { connId: n }.
  unreadByConnectionForUser(userId) {
    const rows = db.prepare(`
      SELECT m.connection_id AS cid, COUNT(*) AS n
      FROM messages m
      JOIN route_connections c ON c.id = m.connection_id
      WHERE (c.rider_id = ? OR c.driver_id = ?)
        AND m.sender_id != ? AND m.read_at IS NULL
      GROUP BY m.connection_id
    `).all(userId, userId, userId);
    const map = {};
    for (const r of rows) map[r.cid] = r.n;
    return map;
  },

  // --- recurring trips on a connection ---
  // Stored per-trip overrides for a connection, keyed "date|direction" ->
  // { status, fare, escrowStatus }.
  connectionTripMap(connectionId) {
    const map = {};
    for (const r of db.prepare('SELECT trip_date, direction, status, fare, escrow_status FROM connection_trips WHERE connection_id = ?').all(connectionId))
      map[`${r.trip_date}|${r.direction}`] = { status: r.status, fare: r.fare, escrowStatus: r.escrow_status || 'none' };
    return map;
  },
  getConnectionTrip: (connectionId, tripDate, direction) =>
    db.prepare('SELECT * FROM connection_trips WHERE connection_id = ? AND trip_date = ? AND direction = ?')
      .get(connectionId, tripDate, direction) || null,
  // Upsert a trip. `fields` may include status, fare, escrowStatus (only the
  // provided keys are written; existing values are kept otherwise).
  setConnectionTrip(connectionId, tripDate, direction, fields = {}) {
    const existing = this.getConnectionTrip(connectionId, tripDate, direction);
    const status = fields.status ?? existing?.status ?? 'scheduled';
    const fare = fields.fare ?? existing?.fare ?? null;
    const escrow = fields.escrowStatus ?? existing?.escrow_status ?? 'none';
    db.prepare(`
      INSERT INTO connection_trips (connection_id, trip_date, direction, status, fare, escrow_status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(connection_id, trip_date, direction)
      DO UPDATE SET status = excluded.status, fare = excluded.fare,
                    escrow_status = excluded.escrow_status, updatedAt = excluded.updatedAt
    `).run(connectionId, tripDate, direction, status, fare, escrow, new Date().toISOString());
  },
  // Sum of dollars currently held in escrow for a user's paid-but-not-released trips.
  heldEscrowForRider: (riderId) =>
    db.prepare(`
      SELECT COALESCE(SUM(t.fare), 0) AS held
      FROM connection_trips t JOIN route_connections c ON c.id = t.connection_id
      WHERE c.rider_id = ? AND t.escrow_status = 'held'
    `).get(riderId).held,

  // --- wallet ledger + Stripe top-ups + Connect account ---
  addLedger(userId, kind, amount, note, ref) {
    db.prepare('INSERT INTO ledger (user_id, kind, amount, note, ref, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, kind, amount, note ?? null, ref ?? null, new Date().toISOString());
  },
  ledgerForUser: (userId) =>
    db.prepare('SELECT * FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(userId),
  recordTopup(sessionId, userId, amount) {
    db.prepare('INSERT OR IGNORE INTO stripe_topups (session_id, user_id, amount, status, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, userId, amount, 'pending', new Date().toISOString());
  },
  getTopup: (sessionId) => db.prepare('SELECT * FROM stripe_topups WHERE session_id = ?').get(sessionId) || null,
  markTopupCredited: (sessionId) => db.prepare("UPDATE stripe_topups SET status = 'credited' WHERE session_id = ?").run(sessionId),
  setUserStripeAccount: (userId, accountId) => db.prepare('UPDATE users SET stripe_account_id = ? WHERE id = ?').run(accountId, userId),

  // --- settings (encrypted secrets) ---
  getSetting(key) {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return r ? decryptSecret(r.value) : null;
  },
  setSetting(key, value) {
    db.prepare('INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt')
      .run(key, value == null ? null : encryptSecret(value), new Date().toISOString());
  },
  settingsEncrypted: () => !!settingsKey,

  isEmpty: () => stmts.allUsers.all().length === 0,
};

// ---------------------------------------------------------------------------
// Seed — ported from the old in-memory seed(). Only runs when the DB is empty,
// so data survives restarts. Keeps the same demo logins and two seed rides.
// ---------------------------------------------------------------------------
function seed() {
  if (!data.isEmpty()) return;
  const now = () => new Date().toISOString();

  const admin = data.createUser({
    name: 'Admin', email: 'admin@latrobe.edu.au', password: 'admin123',
    role: 'driver', university: 'La Trobe University', hasVehicle: true,
    vehicleType: 'sedan', vehicleSeats: 4, verified: true, isAdmin: true,
    rating: 5, reviewCount: 0, walletBalance: 100, createdAt: now(),
  });
  const driver = data.createUser({
    name: 'Sarah Driver', email: 'sarah@latrobe.edu.au', password: 'password',
    role: 'driver', university: 'La Trobe University', hasVehicle: true,
    vehicleType: 'hybrid', vehicleSeats: 4, verified: true, isAdmin: false,
    rating: 4.8, reviewCount: 24, walletBalance: 45.5,
    homeLocation: { name: 'Reservoir', lat: -37.7154, lng: 145.0421 }, createdAt: now(),
  });
  data.createUser({
    name: 'Tom Rider', email: 'tom@latrobe.edu.au', password: 'password',
    role: 'rider', university: 'La Trobe University', hasVehicle: false,
    verified: true, isAdmin: false, rating: 4.9, reviewCount: 12, walletBalance: 30,
    homeLocation: { name: 'Preston', lat: -37.7406, lng: 145.0172 }, createdAt: now(),
  });
  data.createUser({
    name: 'Mia Student', email: 'mia@latrobe.edu.au', password: 'password',
    role: 'rider', university: 'La Trobe University', hasVehicle: false,
    verified: false, isAdmin: false, rating: 5, reviewCount: 0, walletBalance: 15,
    homeLocation: { name: 'Epping', lat: -37.64, lng: 145.03 }, createdAt: now(),
  });

  // One rider per vehicle (Australian carpool rules) — every ride is single-seat.
  data.createRide({
    driverId: driver.id,
    from: { name: 'Reservoir', lat: -37.7154, lng: 145.0421 },
    to: CAMPUS,
    departureTime: new Date(Date.now() + 36e5).toISOString(),
    seatsTotal: 1, seatsAvailable: 1, fare: 6.5,
    vehicleType: 'hybrid', status: 'active', notes: 'Leaving from Reservoir station.',
    createdAt: now(),
  });
  data.createRide({
    driverId: admin.id,
    from: { name: 'Craigieburn', lat: -37.6029, lng: 144.9281 },
    to: CAMPUS,
    departureTime: new Date(Date.now() + 72e5).toISOString(),
    seatsTotal: 1, seatsAvailable: 1, fare: 8,
    vehicleType: 'sedan', status: 'active', notes: '',
    createdAt: now(),
  });
}

seed();

module.exports = data;
