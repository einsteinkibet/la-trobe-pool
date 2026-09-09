import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { connectionsApi } from '../utils/api';
import '../index.css';

const DIR_LABEL = { to_campus: '→ La Trobe', from_campus: '← Home' };
const TRIP_TINT = { confirmed: '#dcfce7', cancelled: '#fee2e2', completed: '#e0e7ff', scheduled: '#f8fafc' };

// Read-only status label shown to the driver (who never pays/releases).
const DRIVER_TRIP_LABEL = {
  scheduled: 'Awaiting rider payment',
  confirmed: 'Paid — held in escrow',
  completed: 'Completed · paid out',
  cancelled: 'Skipped',
};

// Upcoming recurring trips for one accepted connection. Loads lazily when opened.
// Riders pay/confirm/release per trip; drivers see read-only status.
const TripsPanel = ({ connectionId, showToast, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await connectionsApi.trips(connectionId);
      setTrips(res.trips || []);
    } catch (err) {
      showToast?.(err.message || 'Could not load trips');
    }
    setLoading(false);
  }, [connectionId, showToast]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && trips.length === 0) load();
  };

  // Run an action then refresh the row from the returned patch.
  const act = async (t, fn, patch) => {
    const key = `${t.date}|${t.direction}`;
    setBusy(key);
    try {
      await fn();
      setTrips((prev) => prev.map((x) => (x.date === t.date && x.direction === t.direction ? { ...x, ...patch } : x)));
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        showToast?.('Not enough balance — top up your wallet to pay.');
        onNavigate?.('wallet');
      } else {
        showToast?.(err.message || 'Could not update trip');
      }
    }
    setBusy(null);
  };

  const pay = (t) => act(t, () => connectionsApi.payTrip(connectionId, t.date, t.direction), { status: 'confirmed', escrowStatus: 'held' });
  const release = (t) => act(t, () => connectionsApi.releaseTrip(connectionId, t.date, t.direction), { status: 'completed', escrowStatus: 'released' });
  const skip = (t) => act(t, () => connectionsApi.setTrip(connectionId, t.date, t.direction, 'cancelled'), { status: 'cancelled', escrowStatus: t.escrowStatus === 'held' ? 'refunded' : 'none' });
  const restore = (t) => act(t, () => connectionsApi.setTrip(connectionId, t.date, t.direction, 'scheduled'), { status: 'scheduled', escrowStatus: 'none' });

  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  const riderActions = (t, key) => {
    if (t.status === 'cancelled') return <button className="btn btn-sm btn-outline" disabled={busy === key} onClick={() => restore(t)}>Restore</button>;
    if (t.status === 'completed') return <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>Paid out ✓</span>;
    if (t.status === 'confirmed') return (
      <>
        <button className="btn btn-sm btn-primary" disabled={busy === key} onClick={() => release(t)}>I rode — release ${t.fare}</button>
        <button className="btn btn-sm btn-danger" disabled={busy === key} onClick={() => skip(t)}>Cancel (refund)</button>
      </>
    );
    return (
      <>
        <button className="btn btn-sm btn-primary" disabled={busy === key} onClick={() => pay(t)}>Pay &amp; confirm ${t.fare}</button>
        <button className="btn btn-sm btn-danger" disabled={busy === key} onClick={() => skip(t)}>Skip</button>
      </>
    );
  };

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button className="btn btn-sm btn-outline" onClick={toggle}>
        {open ? 'Hide upcoming trips' : 'Upcoming trips'}
      </button>
      {open && (
        <div style={{ marginTop: '0.5rem' }}>
          {loading ? (
            <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Loading trips…</p>
          ) : trips.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>No trips in the next two weeks.</p>
          ) : (
            trips.map((t) => {
              const key = `${t.date}|${t.direction}`;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', marginBottom: '0.3rem', borderRadius: '0.4rem', background: TRIP_TINT[t.status] || '#f8fafc' }}>
                  <div style={{ flex: 1, fontSize: '0.8rem' }}>
                    <strong>{fmtDate(t.date)}</strong> · {DIR_LABEL[t.direction] || t.direction}{t.time ? ` · ${t.time}` : ''}
                    {!t.iAmRider && (
                      <span style={{ marginLeft: '0.4rem', color: '#64748b', fontSize: '0.72rem' }}>({DRIVER_TRIP_LABEL[t.status] || t.status})</span>
                    )}
                  </div>
                  {t.iAmRider && riderActions(t, key)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
TripsPanel.propTypes = { connectionId: PropTypes.number.isRequired, showToast: PropTypes.func, onNavigate: PropTypes.func };

/**
 * ConnectionsPage — "Requests to ride together".
 *
 * The route-centric flow: a student sends a request on a match (RoutesPage);
 * the counterpart accepts here. No money moves through the app at soft-launch —
 * once accepted, both sides see the suggested pickup + each other's contact and
 * arrange payment (cash/PayID) themselves.
 */
const ConnectionsPage = ({ onBack, onNavigate, showToast, user }) => {
  const [conns, setConns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConns(await connectionsApi.list());
    } catch (err) {
      showToast?.(err.message || 'Could not load requests');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const respond = async (id, action) => {
    setBusyId(id);
    try {
      await connectionsApi.respond(id, action);
      showToast?.(action === 'accept' ? 'Accepted 🎉 Contact details are now shared.' : 'Request declined.');
      await load();
    } catch (err) {
      showToast?.(err.message || 'Could not update request');
    }
    setBusyId(null);
  };

  const cancel = async (id) => {
    setBusyId(id);
    try {
      await connectionsApi.cancel(id);
      showToast?.('Request withdrawn.');
      await load();
    } catch (err) {
      showToast?.(err.message || 'Could not withdraw request');
    }
    setBusyId(null);
  };

  if (!user) {
    return (
      <>
        <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button className="btn-icon" onClick={onBack}>←</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🤝 Requests</h2>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>Log in to see your ride requests.</p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('login')}>Log in / Sign up</button>
        </div>
      </>
    );
  }

  const incoming = conns.filter((c) => c.canRespond);
  const accepted = conns.filter((c) => c.status === 'accepted');
  const sent = conns.filter((c) => c.status === 'pending' && c.requestedByMe);
  const closed = conns.filter((c) => ['declined', 'cancelled'].includes(c.status));

  const daysText = (c) => (c.sharedDays || []).map((d) => d.day).join(', ');

  const Card = ({ c, children, tint }) => (
    <div className="card" style={{ padding: '0.85rem', marginBottom: '0.6rem', background: tint || '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{c.counterpart?.role === 'driver' ? '🚗' : '🧍'} {c.counterpart?.name || 'Student'}</strong>
        <span style={{ fontSize: '0.75rem', color: '#666' }}>⭐ {c.counterpart?.rating ?? '—'}</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: '#555', margin: '0.3rem 0' }}>
        {c.counterpart?.suburb ? `From ${c.counterpart.suburb} · ` : ''}Days: {daysText(c) || '—'}
      </div>
      {c.meetPoint?.name && (
        <div style={{ fontSize: '0.78rem', color: '#0369a1' }}>📍 Suggested pickup: <strong>{c.meetPoint.name}</strong></div>
      )}
      {children}
    </div>
  );
  Card.propTypes = { c: PropTypes.object.isRequired, children: PropTypes.node, tint: PropTypes.string };

  return (
    <>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🤝 Requests</h2>
      </div>

      {loading ? (
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Loading…</p>
      ) : conns.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🤝</div>
          <h3 style={{ margin: '0.5rem 0' }}>No requests yet</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            Find a match on one of your routes and send a request to ride together.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate?.('routes')}>Go to my routes</button>
        </div>
      ) : (
        <>
          {incoming.length > 0 && (
            <section style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Incoming ({incoming.length})</h4>
              {incoming.map((c) => (
                <Card key={c.id} c={c} tint="#f0fdf4">
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                    <button className="btn btn-sm btn-primary" disabled={busyId === c.id} onClick={() => respond(c.id, 'accept')}>Accept</button>
                    <button className="btn btn-sm btn-outline" disabled={busyId === c.id} onClick={() => respond(c.id, 'decline')}>Decline</button>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {accepted.length > 0 && (
            <section style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Confirmed ({accepted.length})</h4>
              {accepted.map((c) => (
                <Card key={c.id} c={c} tint="#eff6ff">
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ width: '100%', position: 'relative' }}
                      onClick={() => onNavigate?.('messages', { connectionId: c.id })}
                    >
                      💬 Message {c.counterpart?.name?.split(' ')[0] || 'student'}
                      {c.unread > 0 && (
                        <span style={{ marginLeft: '0.4rem', background: 'rgba(255,255,255,0.28)', borderRadius: 999, padding: '0.05rem 0.45rem', fontSize: '0.72rem' }}>
                          {c.unread}
                        </span>
                      )}
                    </button>
                    <div style={{ color: '#888', marginTop: '0.4rem', fontSize: '0.72rem' }}>
                      Arrange your pickup time &amp; spot in chat. Fares are paid in-app per trip below — the rider pays into escrow and releases it after the ride.
                    </div>
                  </div>
                  <TripsPanel connectionId={c.id} showToast={showToast} onNavigate={onNavigate} />
                </Card>
              ))}
            </section>
          )}

          {sent.length > 0 && (
            <section style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Sent — awaiting reply ({sent.length})</h4>
              {sent.map((c) => (
                <Card key={c.id} c={c}>
                  <div style={{ marginTop: '0.5rem' }}>
                    <button className="btn btn-sm btn-outline" disabled={busyId === c.id} onClick={() => cancel(c.id)}>Withdraw</button>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h4 style={{ marginBottom: '0.5rem', color: '#94a3b8' }}>Closed ({closed.length})</h4>
              {closed.map((c) => (
                <Card key={c.id} c={c} tint="#f8fafc">
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>{c.status}</div>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
};

ConnectionsPage.propTypes = {
  onBack: PropTypes.func,
  onNavigate: PropTypes.func,
  showToast: PropTypes.func,
  user: PropTypes.object,
};

export default ConnectionsPage;
