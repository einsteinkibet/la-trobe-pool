import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import RideCard from '../components/RideCard';
import Loading from '../components/Loading';
import { ridesApi, bookingsApi, routesApi } from '../utils/api';
import { LA_TROBE_CAMPUS } from '../utils/constants';
import '../index.css';

/**
 * Find a Ride — this is a commute app, so a trip is always between the student's
 * home and La Trobe (no arbitrary from/to, no drop-offs in between). The user
 * only picks the DIRECTION; pickup/drop details are agreed on the phone later.
 */
const CAMPUS = LA_TROBE_CAMPUS.name;

const FindRidePage = ({ onBack, onNavigate, user, showToast }) => {
  const [direction, setDirection] = useState('to_campus'); // 'to_campus' | 'from_campus'
  const [home, setHome] = useState(user?.homeLocation?.name || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Resolve the student's home from their routes (most reliable) or profile.
  useEffect(() => {
    if (!user) return;
    if (home) return;
    routesApi.getMine()
      .then((rs) => {
        const withOrigin = (rs || []).find((r) => r.origin?.name);
        if (withOrigin) setHome(withOrigin.origin.name);
      })
      .catch(() => {});
  }, [user, home]);

  const from = direction === 'to_campus' ? home : CAMPUS;
  const to = direction === 'to_campus' ? CAMPUS : home;

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const result = await ridesApi.getAll({ from, to });
      const list = Array.isArray(result) ? result : result.rides || [];
      setRides(
        list.map((r) => ({
          ...r,
          from_location: r.from?.name || r.from_location || 'Pickup',
          to_location: r.to?.name || r.to_location || CAMPUS,
          time: r.departureTime ? new Date(r.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          price: r.fare ?? r.price ?? 0,
        })),
      );
    } catch (err) {
      setError(err.message || 'Could not load rides. Please try again.');
      setRides([]);
    }
    setLoading(false);
  }, [from, to]);

  const handleBook = async (rideId) => {
    if (!user) { showToast?.('Please log in to book a ride'); return; }
    try {
      const res = await bookingsApi.create(rideId);
      showToast?.(res?.message || 'Booking requested — fare held in escrow. See it under Bookings.');
      handleSearch();
    } catch (err) {
      if (err.code === 'NOT_VERIFIED') { showToast?.('Verify your student ID first to book'); onNavigate?.('verification'); }
      else if (err.code === 'INSUFFICIENT_FUNDS') { showToast?.('Not enough wallet balance — top up in Wallet'); onNavigate?.('wallet'); }
      else showToast?.(err.message || 'Booking failed');
    }
  };

  const Endpoint = ({ icon, label, place }) => (
    <div style={{ flex: 1, background: '#f8fafc', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {icon} {place || '—'}
      </div>
    </div>
  );
  Endpoint.propTypes = { icon: PropTypes.string, label: PropTypes.string, place: PropTypes.string };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🔍 Find a Ride</h2>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#6d6d6d', margin: '-0.25rem 0 0.75rem' }}>
        Every trip runs between your home and La Trobe. Pick a direction — you and the driver sort out the
        exact pickup spot &amp; time on the phone. For automatic matching, set up a{' '}
        <button className="link-btn" onClick={() => onNavigate?.('routes')}>commute route</button>.
      </p>

      <div className="search-section">
        {/* Direction toggle — the only choice; endpoints are fixed. */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[['to_campus', '➡️ To campus'], ['from_campus', '⬅️ Back home']].map(([d, lbl]) => (
            <button
              key={d}
              type="button"
              className={`btn ${direction === d ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setDirection(d)}
            >
              {lbl}
            </button>
          ))}
        </div>

        {!home ? (
          <div className="card" style={{ padding: '0.9rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <p style={{ fontSize: '0.85rem', color: '#92400e', margin: '0 0 0.6rem' }}>
              Set your home first so we know where you travel from.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate?.('routes')}>Set up my route</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Endpoint icon="📍" label="From" place={from} />
              <span style={{ color: '#94a3b8' }}>→</span>
              <Endpoint icon="🎓" label="To" place={to} />
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : '🔍 Search Rides'}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <Loading text="Searching for rides..." />
      ) : hasSearched ? (
        rides.length > 0 ? (
          <div className="rides-section">
            <h3>🚗 Available Rides ({rides.length})</h3>
            {rides.map((ride) => (
              <RideCard key={ride.id} ride={ride} onBook={handleBook} onView={() => onNavigate?.('bookings')} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No rides found</h3>
            <p>No drivers on this route yet — set up a commute route to get auto-matched.</p>
          </div>
        )
      ) : null}

      {error && <div className="error-message">{error}</div>}
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
