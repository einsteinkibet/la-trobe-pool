import { useState } from 'react';
import PropTypes from 'prop-types';
import { userApi } from '../utils/api';
import '../index.css';

const VEHICLE_TYPES = ['sedan', 'hatchback', 'suv', 'van'];

/**
 * Settings — edit profile, vehicle, notification prefs, password, delete account.
 */
const SettingsPage = ({ onBack, user, showToast, onUserUpdate, onLogout }) => {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [homeAddress, setHomeAddress] = useState(user?.homeLocation?.name || '');
  const [hasVehicle, setHasVehicle] = useState(!!user?.hasVehicle);
  const [vehicleType, setVehicleType] = useState(user?.vehicleType || 'sedan');
  const [notifyBookings, setNotifyBookings] = useState(user?.notify_bookings !== 0);
  const [notifyMarketing, setNotifyMarketing] = useState(!!user?.notify_marketing);
  const [savingProfile, setSavingProfile] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  if (!user) {
    return <div className="empty-state"><div className="empty-icon">⚙️</div><h3>Log in to access settings</h3></div>;
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await userApi.updateProfile({
        name, phone, homeAddress,
        hasVehicle, vehicleType,
        notifyBookings, notifyMarketing,
      });
      onUserUpdate?.(res);
      showToast?.('Profile saved');
    } catch (err) {
      showToast?.(err.message || 'Failed to save profile');
    }
    setSavingProfile(false);
  };

  const changePassword = async () => {
    if (newPw.length < 6) return showToast?.('New password must be at least 6 characters');
    setSavingPw(true);
    try {
      await userApi.changePassword(curPw, newPw);
      showToast?.('Password changed');
      setCurPw(''); setNewPw('');
    } catch (err) {
      showToast?.(err.message || 'Failed to change password');
    }
    setSavingPw(false);
  };

  const deleteAccount = async () => {
    if (!confirm('Permanently delete your account and all your rides/bookings? This cannot be undone.')) return;
    try {
      await userApi.deleteAccount();
      showToast?.('Account deleted');
      onLogout?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to delete account');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>⚙️ Settings</h2>
      </div>

      {/* Profile */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0 }}>Profile</h4>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={user.email} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04xx xxx xxx" />
        </div>
        <div className="form-group">
          <label className="form-label">Home suburb / address</label>
          <input className="form-input" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} placeholder="e.g. Reservoir, VIC" />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
          <input type="checkbox" checked={hasVehicle} onChange={(e) => setHasVehicle(e.target.checked)} />
          I drive (offer rides)
        </label>
        {hasVehicle && (
          <div className="form-group">
            <label className="form-label">Vehicle</label>
            <select className="form-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.35rem', display: 'block' }}>
              Solo-ride service — one rider per trip.
            </span>
          </div>
        )}

        <h4 style={{ marginBottom: '0.3rem' }}>Notifications</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.3rem 0' }}>
          <input type="checkbox" checked={notifyBookings} onChange={(e) => setNotifyBookings(e.target.checked)} />
          Booking & ride updates
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.3rem 0' }}>
          <input type="checkbox" checked={notifyMarketing} onChange={(e) => setNotifyMarketing(e.target.checked)} />
          Offers & announcements
        </label>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={savingProfile} onClick={saveProfile}>
          {savingProfile ? 'Saving...' : 'Save profile'}
        </button>
      </div>

      {/* Password */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0 }}>Change password</h4>
        <div className="form-group">
          <label className="form-label">Current password</label>
          <input className="form-input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">New password</label>
          <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <button className="btn btn-secondary" style={{ width: '100%' }} disabled={savingPw || !curPw || !newPw} onClick={changePassword}>
          {savingPw ? 'Updating...' : 'Update password'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0, color: '#b91c1c' }}>Danger zone</h4>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={deleteAccount}>Delete my account</button>
      </div>
    </>
  );
};

SettingsPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
  onUserUpdate: PropTypes.func,
  onLogout: PropTypes.func,
};

export default SettingsPage;
