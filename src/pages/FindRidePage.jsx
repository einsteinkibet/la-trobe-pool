import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { routesApi } from '../utils/api';
import '../index.css';

/**
 * Find a Ride — this is a commute app, so a "search" means: show the real route
 * matches for one of MY routes (opposite-role commuters who share my days and are
 * on my corridor), ranked by detour, with a system-suggested pickup point. This
 * uses the SAME matching engine as Routes → View matches (GET /routes/matches),
 * so what you see here is exactly what can be booked. (The old page queried the
 * unused legacy `rides` table and always came up empty.)
 */
const GRADE_COLORS = { 'A+': '#16a34a', A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#ef4444' };

const FindRidePage = ({ onBack, onNavigate, user, showToast }) => {
  const [routes, setRoutes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [requestedIds, setRequestedIds] = useState(new Set());
  const [requestingId, setRequestingId] = useState(null);

  // Load my routes — matching is always relative to one of my own routes.
  useEffect(() => {
    if (!user) { setLoadingRoutes(false); return; }
    routesApi.getMine()
      .then((rs) => {
        const active = (rs || []).filter((r) => r.status !== 'deleted');
        setRoutes(active);
        if (active.length) setSelectedId((prev) => prev ?? active[0].id);
      })
      .catch((e) => showToast?.(e.message || 'Could not load your routes'))
      .finally(() => setLoadingRoutes(false));
  }, [user, showToast]);

  const selectedRoute = routes.find((r) => r.id === selectedId);

  const search = useCallback(async (routeId) => {
    if (!routeId) return;
    setLoading(true);
    setHasSearched(true);
    setMatches([]);
    try {
      const res = await routesApi.getMatches(routeId);
      setMatches(res.matches || []);
    } catch (err) {
      showToast?.(err.message || 'Could not load matches');
    }
    setLoading(false);
  }, [showToast]);

  // Auto-search whenever the selected route changes.
  useEffect(() => { if (selectedId) search(selectedId); }, [selectedId, search]);

  const request = async (m) => {
    setRequestingId(m.routeId);
    try {
      await routesApi.connect(m.routeId, selectedId);
      setRequestedIds((prev) => new Set(prev).add(m.routeId));
      showToast?.(`Request sent to ${m.user?.name || 'the student'} ✅ Track it under Requests.`);
    } catch (err) {
      if (err.code === 'DUPLICATE') {
        setRequestedIds((prev) => new Set(prev).add(m.routeId));
        showToast?.('You already have a request with this student.');
      } else if (err.code === 'NOT_VERIFIED') {
        showToast?.('Verify your student ID first');
        onNavigate?.('verification');
      } else {
        showToast?.(err.message || 'Could not send request');
      }
    }
    setRequestingId(null);
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
      <button className="btn-icon" onClick={onBack}>←</button>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🔍 Find a Ride</h2>
    </div>
  );

  if (!user) {
    return (
      <>
        {header}
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>Log in to find commuters going your way.</p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('login')}>Log in / Sign up</button>
        </div>
      </>
    );
  }

  if (loadingRoutes) {
    return (<>{header}<Loading text="Loading your routes…" /></>);
  }

  // No routes yet → matching needs at least one of your own routes to compare against.
  if (!routes.length) {
    return (
      <>
        {header}
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛣️</div>
          <h3 style={{ marginBottom: '0.4rem' }}>Set up a commute route first</h3>
          <p style={{ fontSize: '0.9rem', color: '#6d6d6d', marginBottom: '1rem' }}>
            Tell us your home suburb and the days you travel. We then match you with a
            student going the same way and suggest a pickup point.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('routes')}>Set up my route</button>
        </div>
      </>
    );
  }

  const iAmRider = selectedRoute?.role === 'rider';

  return (
    <>
      {header}
      <p style={{ fontSize: '0.82rem', color: '#6d6d6d', margin: '-0.25rem 0 0.75rem' }}>
        These are live matches for your route — students going your way who share your days.
        Send a request; once they accept you&apos;ll see the pickup spot &amp; contact under{' '}
        <button className="link-btn" onClick={() => onNavigate?.('connections')}>Requests</button>.
      </p>

      <div className="search-section">
        {/* Which of my routes to match against (a rider route finds drivers; a driver route finds riders). */}
        <label className="form-label">Matching for my route</label>
        <select
          className="form-input"
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role === 'driver' ? '🚗 Driver' : '🧍 Rider'} · {r.origin?.name || 'Home'} → La Trobe
            </option>
          ))}
        </select>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
          {iAmRider
            ? 'Showing drivers heading your way.'
            : 'Showing riders along your route you could pick up.'}
        </p>
        <button
          className="btn btn-primary"
          style={{ marginTop: '0.75rem', width: '100%' }}
          onClick={() => search(selectedId)}
          disabled={loading}
        >
          {loading ? 'Searching…' : '🔍 Refresh matches'}
        </button>
      </div>

      {loading ? (
        <Loading text="Finding commuters along your way…" />
      ) : hasSearched && matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No matches yet</h3>
          <p>
            No {iAmRider ? 'drivers' : 'riders'} sharing your days &amp; corridor right now. Try adding more
            commute days on your route, or check back soon as more students join.
          </p>
        </div>
      ) : matches.length > 0 ? (
        <div className="rides-section">
          <h3 style={{ fontSize: '1rem', margin: '0.25rem 0 0.75rem' }}>
            {iAmRider ? '🚗' : '🧍'} {matches.length} match{matches.length > 1 ? 'es' : ''} on your way
          </h3>
          {matches.map((m) => {
            const done = requestedIds.has(m.routeId);
            return (
              <div key={m.routeId} className="card" style={{ padding: '0.9rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <div style={{
                    flex: '0 0 auto', width: 38, height: 38, borderRadius: 10, color: '#fff',
                    fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: GRADE_COLORS[m.grade] || '#64748b',
                  }}>
                    {m.grade}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {m.user?.name || (iAmRider ? 'Driver' : 'Rider')}
                      {m.user?.rating ? <span style={{ color: '#ca8a04', fontWeight: 600, fontSize: '0.8rem' }}> ★ {Number(m.user.rating).toFixed(1)}</span> : null}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6d6d6d' }}>
                      📍 {m.origin?.suburb || m.origin?.name} · {m.detourKm} km detour
                    </div>
                  </div>
                </div>

                {m.meetPoint?.name && (
                  <div style={{ fontSize: '0.8rem', color: '#0e7c5a', marginTop: '0.5rem' }}>
                    📌 Suggested pickup: <strong>{m.meetPoint.name}</strong>
                    {m.meetPoint.kmFromRiderHome != null ? ` (~${m.meetPoint.kmFromRiderHome} km from home)` : ''}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                  {(m.sharedDays || []).map((d) => (
                    <span key={d.weekday} style={{
                      fontSize: '0.7rem', background: 'var(--primary-tint)', color: '#0e7c5a',
                      padding: '0.15rem 0.5rem', borderRadius: 999, fontWeight: 600,
                    }}>
                      {d.day}{d.start_time ? ` ${d.start_time}` : ''}
                    </span>
                  ))}
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', marginTop: '0.7rem' }}
                  disabled={done || requestingId === m.routeId}
                  onClick={() => request(m)}
                >
                  {done ? '✅ Requested' : requestingId === m.routeId ? '…' : (iAmRider ? 'Request to ride' : 'Offer a ride')}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

FindRidePage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
  user: PropTypes.object,
  showToast: PropTypes.func,
};

export default FindRidePage;
