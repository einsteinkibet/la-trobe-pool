import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { bookingsApi } from '../utils/api';
import '../index.css';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const STATUS = {
  invited: { text: 'Invitation', class: 'badge-pending' },
  pending: { text: 'Awaiting driver', class: 'badge-pending' },
  accepted: { text: 'Confirmed', class: 'badge-success' },
  confirmed: { text: 'Confirmed', class: 'badge-success' },
  completed: { text: 'Completed', class: 'badge-success' },
  rejected: { text: 'Declined', class: 'badge-warning' },
  declined: { text: 'Declined', class: 'badge-warning' },
  cancelled: { text: 'Cancelled', class: 'badge-warning' },
};

/**
 * Bookings — the rider's hub: invitations to respond to, confirmed rides,
 * escrow/fare visibility, cancellations, and post-ride ratings.
 */
const BookingsPage = ({ onBack, onNavigate, user, showToast, onBalanceChange }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetch = async () => {
    if (!user) { showToast?.('Please login to view bookings'); return; }
    setLoading(true);
    try {
      const res = await bookingsApi.getMy();
      setBookings(res.bookings || []);
    } catch (err) {
      showToast?.(err.message || 'Failed to load bookings');
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user]);

  const act = async (id, fn, okMsg) => {
    setBusy(id);
    try {
      const res = await fn();
      showToast?.(res?.message || okMsg);
      onBalanceChange?.();
      await fetch();
    } catch (err) {
      if (err.code === 'NOT_VERIFIED') {
        showToast?.('Verify your student ID first');
        onNavigate?.('verification');
      } else if (err.code === 'INSUFFICIENT_FUNDS' || /balance/i.test(err.message || '')) {
        showToast?.('Not enough wallet balance — top up in Wallet');
        onNavigate?.('wallet');
      } else {
        showToast?.(err.message || 'Action failed');
      }
    }
    setBusy(null);
  };

  const respond = (id, accept) =>
    act(id, () => bookingsApi.respond(id, accept), accept ? 'Invitation accepted' : 'Declined');
  const cancel = (id) => {
    if (!confirm('Cancel this booking? Your fare will be refunded.')) return;
    act(id, () => bookingsApi.cancel(id), 'Booking cancelled');
  };
  const review = (id) => {
    const r = Number(prompt('Rate your driver 1–5 stars:', '5'));
    if (!(r >= 1 && r <= 5)) return showToast?.('Enter a rating 1–5');
    const comment = prompt('Add a comment (optional):', '') || '';
    act(id, () => bookingsApi.review(id, r, comment), 'Thanks for your review!');
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🎫 My Bookings</h2>
      </div>

      {loading ? (
        <Loading text="Loading bookings..." />
      ) : bookings.length > 0 ? (
        <div className="bookings-list">
          {bookings.map((b) => {
            const badge = STATUS[b.status] || { text: b.status, class: '' };
            const disabled = busy === b.id;
            return (
              <div key={b.id} className="booking-card">
                <div className="booking-header">
                  <div className="booking-route">📍 {b.from_location} → 🎓 {b.to_location}</div>
                  <span className={`badge ${badge.class}`}>{badge.text}</span>
                </div>
                <div className="booking-details">
                  <div className="booking-detail"><span>📅</span><span>{fmtDate(b.date)} at {b.time}</span></div>
                  <div className="booking-detail"><span>👤</span><span>Driver: {b.driver_name} {b.driver_rating ? `⭐ ${Number(b.driver_rating).toFixed(1)}` : ''}</span></div>
                  <div className="booking-detail"><span>💵</span><span>Fare {money(b.fare)} ({b.distance_km} km)
                    {b.escrow_status === 'held' && ' · held in escrow'}
                    {b.escrow_status === 'released' && ' · paid'}
                    {b.escrow_status === 'refunded' && ' · refunded'}
                  </span></div>
                </div>

                <div className="booking-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  {b.status === 'invited' && (
                    <>
                      <button className="btn btn-success btn-sm" disabled={disabled} onClick={() => respond(b.id, true)}>
                        Accept {money(b.fare)}
                      </button>
                      <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => respond(b.id, false)}>
                        Decline
                      </button>
                    </>
                  )}
                  {['pending', 'accepted', 'confirmed'].includes(b.status) && (
                    <button className="btn btn-danger btn-sm" disabled={disabled} onClick={() => cancel(b.id)}>
                      Cancel
                    </button>
                  )}
                  {b.status === 'completed' && !b.reviewed && (
                    <button className="btn btn-primary btn-sm" disabled={disabled} onClick={() => review(b.id)}>
                      ⭐ Rate driver
                    </button>
                  )}
                  {b.status === 'completed' && b.reviewed ? <span style={{ fontSize: '0.8rem', color: '#15803d' }}>✓ Reviewed</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h3>No bookings yet</h3>
          <p>Find a ride to get started</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem', maxWidth: '200px' }}
            onClick={() => (onNavigate ? onNavigate('find') : onBack())}>
            Find Rides
          </button>
        </div>
      )}
    </>
  );
};

BookingsPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
  user: PropTypes.object,
  showToast: PropTypes.func,
  onBalanceChange: PropTypes.func,
};

export default BookingsPage;
