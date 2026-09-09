import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { scheduleApi } from '../utils/api';
import '../index.css';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

/**
 * Schedule — the days/times a user travels to campus. Drives the auto-matcher:
 * drivers are suggested riders whose days overlap theirs.
 */
const SchedulePage = ({ onBack, user, showToast }) => {
  const [days, setDays] = useState([]);
  const [arriveBy, setArriveBy] = useState('09:00');
  const [leaveAt, setLeaveAt] = useState('17:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    scheduleApi.get()
      .then((res) => {
        const s = res.schedule || {};
        setDays(s.days || []);
        setArriveBy(s.arrive_by || '09:00');
        setLeaveAt(s.leave_at || '17:00');
      })
      .catch((err) => showToast?.(err.message || 'Failed to load schedule'))
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (key) =>
    setDays((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key]));

  const save = async () => {
    setSaving(true);
    try {
      await scheduleApi.save({ days, arriveBy, leaveAt });
      showToast?.('Schedule saved — you can now be matched on these days');
      onBack?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to save schedule');
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📅</div>
        <h3>Log in to set your schedule</h3>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>📅 My Campus Schedule</h2>
      </div>

      {loading ? (
        <Loading text="Loading schedule..." />
      ) : (
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 0 }}>
            Pick the days you travel to La Trobe. The auto-matcher uses these to pair
            drivers and riders heading in on the same days.
          </p>

          <label className="form-label">Days I go to campus</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggle(d.key)}
                style={{
                  padding: '0.5rem 0.7rem', borderRadius: '8px', cursor: 'pointer',
                  border: days.includes(d.key) ? '2px solid #e4002b' : '1px solid #ccc',
                  background: days.includes(d.key) ? '#fff5f6' : '#fff',
                  fontWeight: days.includes(d.key) ? 600 : 400,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Arrive on campus by</label>
              <input className="form-input" type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Leave campus around</label>
              <input className="form-input" type="time" value={leaveAt} onChange={(e) => setLeaveAt(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={saving || days.length === 0} onClick={save}>
            {saving ? 'Saving...' : 'Save schedule'}
          </button>
        </div>
      )}
    </>
  );
};

SchedulePage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
};

export default SchedulePage;
