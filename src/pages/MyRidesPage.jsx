import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { ridesApi, bookingsApi, matchesApi, inviteApi } from '../utils/api';
import '../index.css';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

/**
 * One offered ride (driver view): passenger management + rider matching/invites.
 */
const DriverRideCard = ({ ride, showToast, onChanged, onBalanceChange }) => {
  const [bookings, setBookings] = useState([]);
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(null);

  const loadBookings = async () => {
    try {
      const res = await bookingsApi.getForRide(ride.id);
      setBookings(Array.isArray(res) ? res : res.bookings || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadBookings(); }, [ride.id]);

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const res = await fn();
      showToast?.(res?.message || okMsg);
      onBalanceChange?.();
      await loadBookings();
    } catch (err) {
      showToast?.(err.message || 'Action failed');
    }
    setBusy(null);
  };

  const findRiders = async () => {
    setBusy('match');
    try {
      const res = await matchesApi.suggestedRiders();
      const list = Array.isArray(res) ? res : res.matches || [];
      setMatches(list);
      if (!list.length) showToast?.('No matching riders along your route yet');
    } catch (err) {
      showToast?.(err.message || 'Could not load matches');
    }
    setBusy(null);
  };

  const invite = (riderId, key) =>
    act(key, () => inviteApi.invite(ride.id, riderId), 'Rider invited');

  const active = bookings.filter((b) => !['cancelled', 'rejected', 'declined'].includes(b.status));

  return (
    <div className="ride-card" style={{ marginBottom: '0.75rem' }}>
      <div className="ride-card-header">
        <div className="ride-avatar">🚗</div>
        <div className="ride-driver-info">
          <div className="ride-driver-name">{ride.from?.name || 'Pickup'} → {ride.to?.name || 'La Trobe'}</div>
          <div className="ride-rating">
            🕐 {ride.departureTime ? new Date(ride.departureTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            {' · '}{ride.seatsAvailable > 0 ? '🟢 Open' : '🔴 Matched'}
          </div>
        </div>
      </div>

      {/* Rider */}
      {active.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {active.map((b) => (
            <div key={b.id} style={{ borderTop: '1px solid #f0f0f0', padding: '0.5rem 0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{b.rider?.name || 'Rider'} {b.rider?.rating ? `⭐ ${Number(b.rider.rating).toFixed(1)}` : ''}</span>
                <strong>{money((b.fare || 0) * 0.9)} <span style={{ fontWeight: 400, color: '#aaa' }}>to you</span></strong>
              </div>
              <div style={{ color: '#888', fontSize: '0.75rem' }}>{b.status}</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                {b.status === 'pending' && (
                  <>
                    <button className="btn btn-success btn-sm" disabled={busy === b.id}
                      onClick={() => act(b.id, () => bookingsApi.updateStatus(b.id, 'accepted'), 'Accepted')}>Accept</button>
                    <button className="btn btn-secondary btn-sm" disabled={busy === b.id}
                      onClick={() => act(b.id, () => bookingsApi.updateStatus(b.id, 'rejected'), 'Rejected')}>Reject</button>
                  </>
                )}
                {b.status === 'invited' && <span style={{ color: '#ca8a04' }}>Invited — awaiting rider</span>}
                {b.status === 'accepted' && (
                  <button className="btn btn-primary btn-sm" disabled={busy === b.id}
                    onClick={() => act(b.id, () => bookingsApi.complete(b.id), 'Ride completed — paid out')}>
                    Complete ride
                  </button>
                )}
                {b.status === 'completed' && <span style={{ color: '#15803d' }}>✓ Completed · {money(b.driver_payout)} earned</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Matching */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary btn-sm" disabled={busy === 'match'} onClick={findRiders}>
          🎯 Find riders
        </button>
        <button className="btn btn-danger btn-sm" onClick={onChanged}>Refresh</button>
      </div>

      {matches && matches.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {matches.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', padding: '0.45rem 0', fontSize: '0.85rem' }}>
              <div>
                {m.name} {m.rating ? `⭐ ${Number(m.rating).toFixed(1)}` : ''}
                <div style={{ color: '#888', fontSize: '0.72rem' }}>
                  📍 {m.location?.name || 'Nearby'} · +{m.detourKm} km detour
                </div>
              </div>
              <button className="btn btn-primary btn-sm" disabled={busy === `inv-${m.id}`}
                onClick={() => invite(m.id, `inv-${m.id}`)}>Invite</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

DriverRideCard.propTypes = {
  ride: PropTypes.object.isRequired,
  showToast: PropTypes.func,
  onChanged: PropTypes.func,
  onBalanceChange: PropTypes.func,
};

/**
 * My Rides — driver hub (manage offered rides) + pointer to bookings as a passenger.
 */
const MyRidesPage = ({ onBack, onNavigate, user, showToast, onBalanceChange }) => {
  const [tab, setTab] = useState('driver');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchMyRides = async () => {
    if (!user) { showToast?.('Please login to view your rides'); return; }
    setLoading(true);
    setHasLoaded(true);
    try {
      const res = await ridesApi.getMy();
      setRides(Array.isArray(res) ? res : res.rides || []);
    } catch {
      setRides([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (tab === 'driver' && user) fetchMyRides(); }, [tab, user]);

  const handleDelete = async (rideId) => {
    if (!confirm('Delete this ride?')) return;
    try {
      await ridesApi.delete(rideId);
      showToast?.('Ride deleted');
      fetchMyRides();
    } catch (err) {
      showToast?.(err.message || 'Failed to delete ride');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>📋 My Rides</h2>
      </div>

      <div className="segmented">
        <div className={`segment-item ${tab === 'driver' ? 'active' : ''}`} onClick={() => setTab('driver')}>As Driver</div>
        <div className={`segment-item ${tab === 'passenger' ? 'active' : ''}`} onClick={() => setTab('passenger')}>As Passenger</div>
      </div>

      {tab === 'passenger' ? (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h3>Your bookings</h3>
          <p>See and manage rides you've booked or been invited to.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem', maxWidth: '220px' }}
            onClick={() => onNavigate?.('bookings')}>Open My Bookings</button>
        </div>
      ) : loading ? (
        <Loading text="Loading rides..." />
      ) : rides.length > 0 ? (
        <div className="rides-section">
          {rides.map((ride) => (
            <div key={ride.id}>
              <DriverRideCard ride={ride} showToast={showToast} onChanged={fetchMyRides} onBalanceChange={onBalanceChange} />
              <button className="btn btn-danger btn-sm" style={{ marginBottom: '0.75rem' }} onClick={() => handleDelete(ride.id)}>
                Delete ride
              </button>
            </div>
          ))}
        </div>
      ) : hasLoaded ? (
        <div className="empty-state">
          <div className="empty-icon">🚗</div>
          <h3>No offered rides yet</h3>
          <p>Offer a ride to start earning $0.50/km</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem', maxWidth: '200px' }}
            onClick={() => (onNavigate ? onNavigate('offer') : onBack())}>Offer a Ride</button>
        </div>
      ) : null}
    </>
  );
};

MyRidesPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
  user: PropTypes.object,
  showToast: PropTypes.func,
  onBalanceChange: PropTypes.func,
};

export default MyRidesPage;
