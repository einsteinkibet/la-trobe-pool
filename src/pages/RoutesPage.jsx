import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import LocationInput from '../components/LocationInput';
import { getLocationByName, VEHICLE_TYPES, LA_TROBE_CAMPUS } from '../utils/constants';
import { routesApi } from '../utils/api';
import '../index.css';

/**
 * RoutesPage — the route-centric core of the app. A "route" is a recurring
 * commute (home <-> La Trobe) with a per-weekday schedule: which days you
 * travel, when you leave home, and optionally when you head back. Verified
 * students create routes here; the app then matches drivers and riders whose
 * corridors and commute days overlap.
 */

const WEEKDAYS = [
  { w: 0, label: 'Mon' },
  { w: 1, label: 'Tue' },
  { w: 2, label: 'Wed' },
  { w: 3, label: 'Thu' },
  { w: 4, label: 'Fri' },
  { w: 5, label: 'Sat' },
  { w: 6, label: 'Sun' },
];

const GRADE_COLORS = {
  'A+': '#16a34a', A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#ef4444',
};

const emptyDays = () => {
  const o = {};
  for (let w = 0; w < 7; w += 1) o[w] = { on: false, start: '08:00', ret: '' };
  return o;
};

const RoutesPage = ({ onBack, showToast, user, onNavigate }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / edit form state
  const [editingId, setEditingId] = useState(null);
  const [role, setRole] = useState(user?.hasVehicle ? 'driver' : 'rider');
  const [originName, setOriginName] = useState('');
  const [originLoc, setOriginLoc] = useState(null); // selected place: {name,suburb,lat,lng}
  const [vehicleType, setVehicleType] = useState(user?.vehicleType || 'sedan');
  const [notes, setNotes] = useState('');
  const [days, setDays] = useState(emptyDays());
  const [saving, setSaving] = useState(false);
  // Once the user has a route, collapse the create form to an "Edit route" CTA.
  const [showForm, setShowForm] = useState(false);

  // Matches panel state
  const [matchesFor, setMatchesFor] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [requestedIds, setRequestedIds] = useState(new Set()); // counterpart routeIds already requested
  const [requestingId, setRequestingId] = useState(null);

  const verified = !!user?.verified;

  const loadRoutes = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      setRoutes(await routesApi.getMine());
    } catch (err) {
      showToast?.(err.message || 'Could not load your routes');
    }
    setLoading(false);
  }, [user, showToast]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  // New users (no routes) see the form open; once a route exists it collapses to
  // an "Edit route" button so "Create" doesn't linger after setup.
  useEffect(() => { setShowForm(routes.length === 0); }, [routes.length]);

  const resetForm = () => {
    setEditingId(null);
    setRole(user?.hasVehicle ? 'driver' : 'rider');
    setOriginName('');
    setOriginLoc(null);
    setVehicleType(user?.vehicleType || 'sedan');
    setNotes('');
    setDays(emptyDays());
  };

  const loadIntoForm = (route) => {
    setEditingId(route.id);
    setRole(route.role);
    setOriginName(route.origin?.name || '');
    setOriginLoc(
      route.origin && route.origin.lat != null
        ? { name: route.origin.name, suburb: route.origin.suburb || route.origin.name, lat: route.origin.lat, lng: route.origin.lng }
        : null,
    );
    setVehicleType(route.vehicle_type || 'sedan');
    setNotes(route.notes || '');
    const d = emptyDays();
    (route.days || []).forEach((rd) => {
      d[rd.weekday] = { on: true, start: rd.start_time || '08:00', ret: rd.return_time || '' };
    });
    setDays(d);
    setMatchesFor(null);
    setShowForm(true);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const toggleDay = (w) =>
    setDays((prev) => ({ ...prev, [w]: { ...prev[w], on: !prev[w].on } }));
  const setDayField = (w, field, value) =>
    setDays((prev) => ({ ...prev, [w]: { ...prev[w], [field]: value } }));

  const selectWeekdays = () =>
    setDays((prev) => {
      const next = { ...prev };
      for (let w = 0; w < 5; w += 1) next[w] = { ...next[w], on: true };
      return next;
    });

  const buildDaysPayload = () =>
    Object.entries(days)
      .filter(([, d]) => d.on)
      .map(([w, d]) => ({ weekday: Number(w), start_time: d.start || null, return_time: d.ret || null }));

  const handleSubmit = async () => {
    if (!user) {
      showToast?.('Log in to create a commute route');
      onNavigate?.('login');
      return;
    }
    // Prefer the place the user picked from autocomplete (real coords). Fall
    // back to the static list only if the typed name matches exactly.
    const loc = originLoc || getLocationByName(originName);
    if (!loc || loc.lat == null || loc.lng == null) {
      showToast?.('Start typing your home address and pick a suggestion');
      return;
    }
    const payload = {
      role,
      direction: 'to_campus',
      origin: { name: loc.name, suburb: loc.suburb || loc.name, lat: loc.lat, lng: loc.lng },
      dest: { name: LA_TROBE_CAMPUS.name, suburb: 'Bundoora', lat: LA_TROBE_CAMPUS.lat, lng: LA_TROBE_CAMPUS.lng },
      vehicleType: role === 'driver' ? vehicleType : undefined,
      notes,
      days: buildDaysPayload(),
    };
    if (!payload.days.length) {
      showToast?.('Select at least one commute day');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await routesApi.update(editingId, payload);
        showToast?.('Route updated ✅');
      } else {
        await routesApi.create(payload);
        showToast?.('Route created 🚗 We\'ll match you with commuters along your way.');
      }
      resetForm();
      await loadRoutes();
    } catch (err) {
      if (err.code === 'NOT_VERIFIED') {
        showToast?.('Verify your student ID first to create routes');
        onNavigate?.('verification');
      } else {
        showToast?.(err.message || 'Could not save route');
      }
    }
    setSaving(false);
  };

  const handleTogglePause = async (route) => {
    try {
      await routesApi.update(route.id, { status: route.status === 'paused' ? 'active' : 'paused' });
      await loadRoutes();
    } catch (err) {
      showToast?.(err.message || 'Could not update route');
    }
  };

  const handleDelete = async (route) => {
    if (!window.confirm('Delete this route? This cannot be undone.')) return;
    try {
      await routesApi.remove(route.id);
      if (matchesFor === route.id) setMatchesFor(null);
      if (editingId === route.id) resetForm();
      await loadRoutes();
      showToast?.('Route deleted');
    } catch (err) {
      showToast?.(err.message || 'Could not delete route');
    }
  };

  const viewMatches = async (route) => {
    if (matchesFor === route.id) { setMatchesFor(null); return; }
    setMatchesFor(route.id);
    setMatchesLoading(true);
    setMatches([]);
    try {
      const res = await routesApi.getMatches(route.id);
      setMatches(res.matches || []);
    } catch (err) {
      showToast?.(err.message || 'Could not load matches');
    }
    setMatchesLoading(false);
  };

  // Send a "request to ride together" to a matched counterpart route.
  const requestRide = async (myRouteId, m) => {
    setRequestingId(m.routeId);
    try {
      await routesApi.connect(m.routeId, myRouteId);
      setRequestedIds((prev) => new Set(prev).add(m.routeId));
      showToast?.(`Request sent to ${m.user?.name || 'the student'} ✅ Track it under Requests.`);
    } catch (err) {
      if (err.code === 'DUPLICATE') {
        setRequestedIds((prev) => new Set(prev).add(m.routeId));
        showToast?.('You already have a request with this student.');
      } else {
        showToast?.(err.message || 'Could not send request');
      }
    }
    setRequestingId(null);
  };

  const vehicleOptions = Object.entries(VEHICLE_TYPES).map(([key, val]) => ({
    value: key,
    label: `${val.icon} ${val.label}`,
  }));

  const daysSummary = (route) =>
    (route.days || [])
      .map((d) => `${d.day}${d.start_time ? ` ${d.start_time}` : ''}${d.return_time ? `→${d.return_time}` : ''}`)
      .join(' · ') || 'No days set';

  // ---- Guests ----
  if (!user) {
    return (
      <>
        <div className="page-head">
          <button className="btn-icon" onClick={onBack}>←</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🛣️ My Commute Routes</h2>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>Log in to set up your recurring commute and get matched with fellow La Trobe students.</p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('login')}>Log in / Sign up</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🛣️ My Commute Routes</h2>
      </div>

      {!verified && (
        <div className="card" style={{ padding: '0.9rem', marginBottom: '1rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <strong>Verify to get started.</strong>
          <p style={{ fontSize: '0.85rem', color: '#92400e', margin: '0.35rem 0 0.6rem' }}>
            Only verified La Trobe students can create routes and be matched.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('verification')}>Verify student ID</button>
        </div>
      )}

      {/* ---- My routes ---- */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.6rem' }}>Your routes</h4>
        {loading ? (
          <p style={{ color: '#888', fontSize: '0.85rem' }}>Loading…</p>
        ) : routes.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.85rem' }}>No routes yet. Create one below to start matching.</p>
        ) : (
          routes.map((route) => (
            <div key={route.id} style={{ borderTop: '1px solid #eee', padding: '0.75rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>
                  {route.role === 'driver' ? '🚗' : '🧍'} {route.origin?.name} → La Trobe
                </div>
                <span style={{
                  fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '999px',
                  background: route.status === 'active' ? '#dcfce7' : '#f1f5f9',
                  color: route.status === 'active' ? '#166534' : '#64748b',
                }}>
                  {route.status}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#666', margin: '0.35rem 0' }}>{daysSummary(route)}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" onClick={() => viewMatches(route)}>
                  {matchesFor === route.id ? 'Hide matches' : 'View matches'}
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => loadIntoForm(route)}>Edit</button>
                <button className="btn btn-sm btn-outline" onClick={() => handleTogglePause(route)}>
                  {route.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(route)}>Delete</button>
              </div>

              {matchesFor === route.id && (
                <div style={{ marginTop: '0.6rem', background: '#f8fafc', borderRadius: '0.5rem', padding: '0.6rem' }}>
                  {matchesLoading ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Finding commuters along your way…</p>
                  ) : matches.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>
                      No {route.role === 'driver' ? 'riders' : 'drivers'} match this route yet. Check back soon.
                    </p>
                  ) : (
                    matches.map((m) => (
                      <div key={m.routeId} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #eef2f7' }}>
                        <span style={{
                          fontWeight: 700, color: '#fff', background: GRADE_COLORS[m.grade] || '#64748b',
                          borderRadius: '0.4rem', padding: '0.15rem 0.4rem', fontSize: '0.8rem', minWidth: '2rem', textAlign: 'center',
                        }}>{m.grade}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {m.user?.name || 'Student'} · ⭐ {m.user?.rating ?? '—'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {m.origin?.suburb || m.origin?.name} · +{m.detourKm} km detour · {m.sharedDays.map((d) => d.day).join(', ')}
                          </div>
                          {m.meetPoint?.name && (
                            <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '0.15rem' }}>
                              📍 Suggested pickup: <strong>{m.meetPoint.name}</strong>
                              {m.meetPoint.kmFromRiderHome != null ? ` (~${m.meetPoint.kmFromRiderHome} km from ${role === 'driver' ? 'their' : 'your'} home)` : ''}
                            </div>
                          )}
                        </div>
                        {requestedIds.has(m.routeId) ? (
                          <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Requested</span>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ whiteSpace: 'nowrap' }}
                            disabled={requestingId === m.routeId}
                            onClick={() => requestRide(route.id, m)}
                          >
                            {requestingId === m.routeId ? '…' : (route.role === 'rider' ? 'Request to ride' : 'Offer a ride')}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                    Send a request — once they accept, you&apos;ll both see the pickup spot and each other&apos;s contact to arrange it. Manage requests under <strong>Requests</strong>.
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ---- Collapsed CTA once a route exists ---- */}
      {!showForm && routes.length > 0 && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => loadIntoForm(routes[0])}>✏️ Edit route</button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { resetForm(); setShowForm(true); }}>➕ Add another</button>
        </div>
      )}

      {/* ---- Create / edit ---- */}
      {showForm && (
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0 }}>{editingId ? 'Edit route' : 'Create a route'}</h4>
          {routes.length > 0 && (
            <button className="btn btn-sm btn-outline" onClick={() => { resetForm(); setShowForm(false); }}>Close</button>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">I am a…</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['rider', 'driver'].map((r) => (
              <button
                key={r}
                type="button"
                className={`btn ${role === r ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1 }}
                onClick={() => setRole(r)}
              >
                {r === 'driver' ? '🚗 Driver' : '🧍 Rider'}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.4rem 0 0' }}>
            You can be both — set up a rider route and a driver route, and switch anytime.
          </p>
        </div>

        <LocationInput
          label="Home address"
          value={originName}
          onChange={setOriginName}
          onSelect={setOriginLoc}
          placeholder="Start typing your street or suburb"
          icon="🏠"
        />
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '-0.4rem 0 0.6rem' }}>
          Destination is La Trobe (Bundoora). We match you automatically with the nearest commuters who share your days — only your approximate suburb is shared, never your exact address.
        </p>

        {role === 'driver' && (
          <div className="form-group">
            <label className="form-label">Vehicle</label>
            <select className="form-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {vehicleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Commute days &amp; times</label>
            <button type="button" className="btn btn-sm btn-outline" onClick={selectWeekdays}>Mon–Fri</button>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.35rem 0 0.1rem' }}>
            Tick each day you travel. Set when you <strong>leave home</strong> in the morning, and — if you also
            want a ride <strong>back home</strong> — add a <strong>return time</strong> too. Return trips are matched &amp; booked just like the trip in.
          </p>
          {/* Column headers so the two time fields are unambiguous. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
            <span style={{ width: '4.5rem' }} />
            <span style={{ flex: 1 }}>🏠 Leave home</span>
            <span style={{ width: '0.8rem' }} />
            <span style={{ flex: 1 }}>🎓 Return from campus (optional)</span>
          </div>
          <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {WEEKDAYS.map(({ w, label }) => (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '4.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={days[w].on} onChange={() => toggleDay(w)} />
                  <span style={{ fontWeight: days[w].on ? 600 : 400 }}>{label}</span>
                </label>
                {days[w].on && (
                  <>
                    <input
                      type="time"
                      className="form-input"
                      style={{ padding: '0.3rem', flex: 1 }}
                      value={days[w].start}
                      onChange={(e) => setDayField(w, 'start', e.target.value)}
                      title="Time you leave home (trip to campus)"
                    />
                    <span style={{ color: '#94a3b8' }}>↩</span>
                    <input
                      type="time"
                      className="form-input"
                      style={{ padding: '0.3rem', flex: 1 }}
                      value={days[w].ret}
                      onChange={(e) => setDayField(w, 'ret', e.target.value)}
                      title="Time you head back from campus (return trip — optional)"
                      placeholder="return"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
            Leave the return blank if you only need the morning trip.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <input
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. flexible ±15 min, quiet ride, boot space for bags"
          />
        </div>

        <button
          className="btn btn-success"
          style={{ width: '100%', marginTop: '0.25rem' }}
          onClick={handleSubmit}
          disabled={saving || !verified}
        >
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create route'}
        </button>
        {role === 'driver' && (
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.6rem 0 0', textAlign: 'center' }}>
            One rider per trip (Australian carpool rules). Riders pay $0.50/km, held in escrow.
          </p>
        )}
      </div>
      )}
    </>
  );
};

RoutesPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  showToast: PropTypes.func,
  user: PropTypes.object,
  onNavigate: PropTypes.func,
};

export default RoutesPage;
