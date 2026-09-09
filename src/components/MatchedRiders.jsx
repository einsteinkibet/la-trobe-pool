import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { matchesApi } from '../utils/api';

/**
 * MatchedRiders — DRIVER-side auto-matching.
 * Given the driver's route (from → to), shows riders whose home lies along the
 * corridor, ranked by least detour, each graded A+→D.
 */

// Detour (km extra) → match grade
const grade = (extraKm) => {
  const e = parseFloat(extraKm);
  if (e <= 0.5) return { g: 'A+', c: '#15803d' };
  if (e <= 1.0) return { g: 'A', c: '#16a34a' };
  if (e <= 2.0) return { g: 'B', c: '#ca8a04' };
  if (e <= 3.0) return { g: 'C', c: '#ea580c' };
  return { g: 'D', c: '#b91c1c' };
};

const MatchedRiders = ({ from, to, onInvite }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTouched(true);

    matchesApi
      .findAlongRoute({ from, to })
      .then((res) => {
        if (!cancelled) setMatches(res.matches || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load matches');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [from, to]);

  if (!from || !to) {
    return (
      <p style={{ fontSize: '0.85rem', color: '#6d6d6d', margin: 0 }}>
        Enter your pickup and destination above to see riders along your route.
      </p>
    );
  }

  if (loading) return <p style={{ fontSize: '0.85rem', color: '#6d6d6d' }}>Finding riders along your route…</p>;
  if (error) return <p style={{ fontSize: '0.85rem', color: '#b91c1c' }}>{error}</p>;
  if (touched && matches.length === 0)
    return <p style={{ fontSize: '0.85rem', color: '#6d6d6d' }}>No riders found along this route yet.</p>;

  return (
    <div className="matched-riders">
      <p style={{ fontSize: '0.8rem', color: '#6d6d6d', margin: '0 0 0.5rem' }}>
        {matches.length} rider{matches.length !== 1 ? 's' : ''} along your route — ranked by least detour:
      </p>
      {matches.map((m, i) => {
        const gr = grade(m.detour.extraDist);
        return (
          <div key={m.passenger.id} className="match-row">
            <span className="match-grade" style={{ background: gr.c }}>{gr.g}</span>
            <div className="match-info">
              <div className="match-name">
                {m.passenger.name}
                {m.passenger.verified ? ' ✅' : ''}
                <span className="match-rating"> ⭐ {m.passenger.rating}</span>
              </div>
              <div className="match-meta">
                📍 {m.pickup.address} · +{m.detour.extraDist} km detour ({m.detour.detourPercent}%)
              </div>
            </div>
            {onInvite && (
              <button className="btn-mini" onClick={() => onInvite(m)}>Invite</button>
            )}
          </div>
        );
      })}
    </div>
  );
};

MatchedRiders.propTypes = {
  from: PropTypes.string,
  to: PropTypes.string,
  onInvite: PropTypes.func,
};

export default MatchedRiders;
