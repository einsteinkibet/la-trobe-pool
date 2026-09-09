import { API_URL } from './constants';

/**
 * Generic API request handler with error handling
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const config = {
    ...options,
    // headers must come AFTER ...options so a caller passing `headers` (e.g. the
    // FormData upload passes `headers: {}`) can't clobber the auth token — we
    // still merge their headers in via the spread below.
    headers: {
      // Let the browser set multipart boundaries for file uploads.
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    // Guard against a misconfigured API base (e.g. VITE_API_URL unset in prod, so
    // /api/* hits the SPA fallback and returns index.html with a 200). Without this
    // the HTML parses to {} and callers like login treat it as success.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const err = new Error(
        response.ok
          ? 'Server did not return JSON — check the API URL (VITE_API_URL) points at the backend.'
          : `Request failed (${response.status})`
      );
      err.status = response.status;
      throw err;
    }
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.error || 'Request failed');
      err.code = data.code;        // e.g. NOT_VERIFIED, INSUFFICIENT_FUNDS
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    // Only log genuinely unexpected failures (network/parse). HTTP error
    // responses are thrown with .status/.code for callers to handle, so we
    // don't flood the console with expected 401/403/409s.
    if (error.status == null) console.error(`API network error [${endpoint}]:`, error.message);
    throw error;
  }
};

/**
 * Auth API
 */
export const authApi = {
  register: (userData) => 
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  
  login: (credentials) => 
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

/**
 * Rides API
 */
export const ridesApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/rides${query ? `?${query}` : ''}`);
  },
  
  getMy: () => apiRequest('/rides/my'),
  
  getById: (id) => apiRequest(`/rides/${id}`),
  
  create: (rideData) => 
    apiRequest('/rides', {
      method: 'POST',
      body: JSON.stringify(rideData),
    }),
  
  update: (id, rideData) => 
    apiRequest(`/rides/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rideData),
    }),
  
  delete: (id) => 
    apiRequest(`/rides/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Bookings API
 */
export const bookingsApi = {
  getMy: () => apiRequest('/bookings'),

  // Bookings on one of my rides (driver view)
  getForRide: (rideId) => apiRequest(`/rides/${rideId}/bookings`),

  // Rider books a ride — fare is held in escrow. Backend: POST /rides/:id/book
  create: (rideId) =>
    apiRequest(`/rides/${rideId}/book`, { method: 'POST' }),

  // Driver accepts/rejects a pending booking
  updateStatus: (id, status) =>
    apiRequest(`/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Rider responds to a driver invitation (accept holds escrow)
  respond: (id, accept) =>
    apiRequest(`/bookings/${id}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ accept }),
    }),

  // Driver marks the ride done → escrow released to driver
  complete: (id) =>
    apiRequest(`/bookings/${id}/complete`, { method: 'POST' }),

  // Rate after a completed ride
  review: (id, rating, comment) =>
    apiRequest(`/bookings/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    }),

  cancel: (id) =>
    apiRequest(`/bookings/${id}`, { method: 'DELETE' }),
};

/**
 * Routes API — recurring commute templates (home <-> campus) with a per-weekday
 * schedule. This is the route-centric replacement for one-off ride offers.
 */
export const routesApi = {
  // My routes (drivers and riders both have routes).
  getMine: () => apiRequest('/routes/mine'),

  getById: (id) => apiRequest(`/routes/${id}`),

  // routeData: { role, direction, origin:{name,suburb,lat,lng}, dest?, vehicleType?,
  //   notes?, days:[{weekday,start_time,return_time}] }
  create: (routeData) =>
    apiRequest('/routes', { method: 'POST', body: JSON.stringify(routeData) }),

  update: (id, routeData) =>
    apiRequest(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(routeData) }),

  remove: (id) => apiRequest(`/routes/${id}`, { method: 'DELETE' }),

  // Suggested counterparts along one of my routes' corridors with shared days.
  // Returns { route, matches:[{ routeId, user, origin, detourKm, grade, sharedDays }] }.
  getMatches: (routeId) =>
    apiRequest(`/routes/matches${routeId ? `?routeId=${routeId}` : ''}`),

  // Request to ride with a matched counterpart route. `theirRouteId` is the
  // match's routeId; `myRouteId` is the route the request is made from.
  connect: (theirRouteId, myRouteId) =>
    apiRequest(`/routes/${theirRouteId}/connect`, {
      method: 'POST',
      body: JSON.stringify({ myRouteId }),
    }),
};

/**
 * Route connections — "request to ride together". No money moves at soft-launch;
 * once accepted both sides see the suggested pickup + each other's contact.
 * Each item: { id, status, myRole, requestedByMe, canRespond, meetPoint,
 *   sharedDays, counterpart:{ name, rating, suburb, role, contact? } }.
 */
export const connectionsApi = {
  list: () => apiRequest('/connections'),
  respond: (id, action) =>
    apiRequest(`/connections/${id}`, { method: 'PUT', body: JSON.stringify({ action }) }),
  cancel: (id) => apiRequest(`/connections/${id}`, { method: 'DELETE' }),

  // Recurring trips for an accepted connection (next ~2 weeks of shared days).
  // Returns { status, trips:[{ date, day, direction, time, status, fare, escrowStatus, iAmRider }] }.
  trips: (id) => apiRequest(`/connections/${id}/trips`),
  // Skip a trip / restore a skipped one: status 'cancelled' | 'scheduled'.
  setTrip: (id, date, direction, status) =>
    apiRequest(`/connections/${id}/trips`, {
      method: 'PUT',
      body: JSON.stringify({ date, direction, status }),
    }),
  // Rider pays a trip's fare into escrow (held from wallet balance).
  payTrip: (id, date, direction) =>
    apiRequest(`/connections/${id}/trips/pay`, { method: 'POST', body: JSON.stringify({ date, direction }) }),
  // Rider confirms the ride happened -> release escrow to the driver.
  releaseTrip: (id, date, direction) =>
    apiRequest(`/connections/${id}/trips/release`, { method: 'POST', body: JSON.stringify({ date, direction }) }),
};

/**
 * In-app chat — one thread per accepted connection (chat-only; no phone/email
 * is shared). Messages: { id, body, mine, createdAt }.
 */
export const messagesApi = {
  list: (connectionId) => apiRequest(`/connections/${connectionId}/messages`),
  send: (connectionId, body) =>
    apiRequest(`/connections/${connectionId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  // { total, byConnection } — for the nav badge.
  unread: () => apiRequest('/messages/unread'),
};

/**
 * Payments (Stripe) — money in (wallet top-up) and out (driver payout). All
 * gated on the backend having STRIPE_SECRET_KEY (else 503 PAYMENTS_DISABLED).
 */
export const paymentsApi = {
  // Start a hosted Checkout for a wallet top-up; returns { url, sessionId }.
  topupCheckout: (amount) =>
    apiRequest('/payments/topup/checkout', { method: 'POST', body: JSON.stringify({ amount }) }),
  // Idempotently credit a top-up after redirect back from Checkout.
  confirmTopup: (sessionId) =>
    apiRequest('/payments/topup/confirm', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  // Driver payout setup (Stripe Connect Express).
  connectOnboard: () => apiRequest('/payments/connect/onboard', { method: 'POST' }),
  connectStatus: () => apiRequest('/payments/connect/status'),
  // Driver withdraws earnings to their bank.
  payout: (amount) => apiRequest('/payments/payout', { method: 'POST', body: JSON.stringify({ amount }) }),
};

/**
 * Geocoding API — real Australian address autocomplete (OSM/Nominatim via our
 * backend). Returns [{ name, suburb, lat, lng, type }].
 */
export const geocodeApi = {
  search: (q) => apiRequest(`/geocode?q=${encodeURIComponent(q)}`),
};

/**
 * Wallet / payments API (internal escrow ledger)
 */
export const walletApi = {
  get: () => apiRequest('/wallet'),
  topUp: (amount) =>
    apiRequest('/wallet/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
  withdraw: (amount) =>
    apiRequest('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
};

/**
 * Commute schedule API (days/times a user travels to campus)
 */
export const scheduleApi = {
  get: () => apiRequest('/schedule'),
  save: ({ days, arriveBy, leaveAt }) =>
    apiRequest('/schedule', { method: 'PUT', body: JSON.stringify({ days, arriveBy, leaveAt }) }),
};

/**
 * Reviews API
 */
export const reviewsApi = {
  forUser: (userId) => apiRequest(`/users/${userId}/reviews`),
};

/**
 * Nearby Students API - for ride matching
 */
export const studentsApi = {
  getNearby: (params) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/students/nearby${query ? `?${query}` : ''}`);
  },
  
  getAllLocations: () => apiRequest('/users/locations'),
};

/**
 * Matching API — DRIVER-side: find riders whose home lies along a driver's route.
 */
export const matchesApi = {
  // Generic route match (location names or coords)
  findAlongRoute: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/matches${query ? `?${query}` : ''}`);
  },

  // DRIVER-side suggestions: riders on my home→campus corridor with overlapping commute days.
  suggestedRiders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/matches/riders${query ? `?${query}` : ''}`);
  },
};

/**
 * Rides API — driver invites a matched rider to a ride.
 */
export const inviteApi = {
  invite: (rideId, riderId) =>
    apiRequest(`/rides/${rideId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ riderId }),
    }),
};

/**
 * User / account API
 */
export const userApi = {
  getProfile: () => apiRequest('/users/me'),

  updateProfile: (userData) =>
    apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  changePassword: (currentPassword, newPassword) =>
    apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: () => apiRequest('/users/me', { method: 'DELETE' }),
};

/**
 * Student-ID verification API
 */
export const verificationApi = {
  status: () => apiRequest('/verification/me'),

  // file: a File object from an <input type="file">
  upload: (file) => {
    const form = new FormData();
    form.append('document', file);
    // NOTE: no Content-Type header — the browser sets the multipart boundary.
    return apiRequest('/verification/upload', { method: 'POST', body: form, headers: {} });
  },
};

/**
 * Admin API (user directory + verification review queue)
 */
export const adminApi = {
  // Full user directory with verification state.
  users: () => apiRequest('/admin/users'),
  // Admin override: verify / un-verify a user directly (no document needed).
  setVerified: (userId, verified) =>
    apiRequest(`/admin/users/${userId}/verified`, {
      method: 'PUT',
      body: JSON.stringify({ verified }),
    }),
  list: (status = 'pending') => apiRequest(`/admin/verifications?status=${status}`),
  decide: (userId, action, note) =>
    apiRequest(`/admin/verifications/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ action, note }),
    }),
  // Authenticated image URL needs the token; components fetch as blob via this helper.
  documentUrl: (userId) => `/api/admin/verifications/${userId}/document`,
  // Payment configuration (masked status only; secretKey is write-only).
  getSettings: () => apiRequest('/admin/settings'),
  setStripe: (secretKey, webhookSecret) =>
    apiRequest('/admin/settings/stripe', { method: 'PUT', body: JSON.stringify({ secretKey, webhookSecret }) }),
};

export default {
  auth: authApi,
  rides: ridesApi,
  routes: routesApi,
  connections: connectionsApi,
  messages: messagesApi,
  payments: paymentsApi,
  geocode: geocodeApi,
  bookings: bookingsApi,
  students: studentsApi,
  matches: matchesApi,
  invite: inviteApi,
  wallet: walletApi,
  schedule: scheduleApi,
  reviews: reviewsApi,
  user: userApi,
  verification: verificationApi,
  admin: adminApi,
};