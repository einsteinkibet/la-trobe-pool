import { useState } from 'react';
import PropTypes from 'prop-types';
import { userApi } from '../utils/api';
import '../index.css';

const VEHICLE_TYPES = ['sedan', 'hatchback', 'suv', 'van'];

/**
 * Profile page — account, wallet, schedule, and dual-role (rider ⇄ driver).
 */
const ProfilePage = ({ onBack, onNavigate, onLogout, user, guest, showToast, setScreen, onUserUpdate }) => {
  const [savingVehicle, setSavingVehicle] = useState(false);
  const isDriver = !!user?.hasVehicle;

  const becomeDriver = async () => {
    const vt = prompt(`Add a vehicle to start driving (solo-ride — one rider per trip).\nVehicle type (${VEHICLE_TYPES.join(' / ')}):`, 'sedan');
    if (!vt) return;
    setSavingVehicle(true);
    try {
      const res = await userApi.updateProfile({
        hasVehicle: true,
        vehicleType: VEHICLE_TYPES.includes(vt.toLowerCase()) ? vt.toLowerCase() : 'sedan',
      });
      onUserUpdate?.(res.user);
      showToast?.("You're now a driver! Offer a ride to start earning.");
    } catch (err) {
      showToast?.(err.message || 'Could not update profile');
    }
    setSavingVehicle(false);
  };

  const vStatus = user?.verified ? 'approved' : 'unverified';
  const vLabel = { approved: '✅ Verified', pending: '⏳ Under review', rejected: '❌ Rejected', unverified: '🪪 Verify now' }[vStatus];

  const menu = [
    // Verified students have nothing to do here — the verified badge below covers
    // it. Only show the verification entry while there's still action to take.
    ...(vStatus !== 'approved'
      ? [{ icon: '🪪', text: 'Student verification', badge: vLabel, go: () => onNavigate?.('verification') }]
      : []),
    { icon: '💳', text: 'Wallet & payments', go: () => onNavigate?.('wallet') },
    ...(isDriver ? [{ icon: '💸', text: 'Set up payouts', badge: 'Driver', go: () => onNavigate?.('wallet') }] : []),
    { icon: '📅', text: 'My campus schedule', go: () => onNavigate?.('schedule') },
    { icon: '🚗', text: 'My rides', go: () => onNavigate?.('rides') },
    { icon: '🎫', text: 'My bookings', go: () => onNavigate?.('bookings') },
    { icon: '⚙️', text: 'Settings', go: () => onNavigate?.('settings') },
    ...(user?.isAdmin ? [{ icon: '🛡️', text: 'Admin — users & verification', badge: 'Admin', go: () => onNavigate?.('admin') }] : []),
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>👤 Profile</h2>
      </div>

      <div className="profile-header" style={{ marginBottom: '0' }}>
        <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || (guest ? 'G' : 'U')}</div>
        <div className="profile-name">{user?.name || (guest ? 'Guest User' : 'La Trobe Student')}</div>
        <div className="profile-info">{user?.email || 'Tap to login for full access'}</div>
        {!guest && vStatus === 'approved' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem',
            background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: '999px',
            padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600,
          }}>
            ✅ Verified student
          </div>
        )}
        {!guest && user && (
          <div className="profile-stats">
            <div>
              <div className="profile-stat-value">{(user.rating || 0).toFixed ? (user.rating || 0).toFixed(1) : user.rating}</div>
              <div className="profile-stat-label">Rating</div>
            </div>
            <div>
              <div className="profile-stat-value">${Number(user.walletBalance || 0).toFixed(0)}</div>
              <div className="profile-stat-label">Balance</div>
            </div>
            <div>
              <div className="profile-stat-value">{isDriver ? '🚗' : '🎒'}</div>
              <div className="profile-stat-label">{isDriver ? 'Driver' : 'Rider'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="content" style={{ padding: '0 1.25rem 1rem' }}>
        {!guest && vStatus !== 'approved' && (
          <div
            onClick={() => onNavigate?.('verification')}
            style={{ background: '#fff5f6', border: '1px solid #f3c4ca', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem', cursor: 'pointer' }}
          >
            <strong style={{ color: '#e4002b' }}>Verify your student status</strong>
            <div style={{ fontSize: '0.8rem', color: '#777' }}>
              Upload your La Trobe student ID to offer and book rides.
            </div>
          </div>
        )}

        {!guest && (
          <div className="menu-list" style={{ marginBottom: '1rem' }}>
            {menu.map((item, i) => (
              <div key={i} className="menu-item" onClick={item.go}>
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-text">{item.text}</span>
                {item.badge && <span style={{ fontSize: '0.75rem', color: '#777', marginRight: '0.4rem' }}>{item.badge}</span>}
                <span className="menu-arrow">›</span>
              </div>
            ))}
          </div>
        )}

        {!guest && !isDriver && (
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}
            disabled={savingVehicle} onClick={becomeDriver}>
            🚗 Become a driver
          </button>
        )}

        {guest ? (
          <button className="btn btn-primary" style={{ marginBottom: '0.75rem', width: '100%' }}
            onClick={() => setScreen?.('login')}>
            Login / Register
          </button>
        ) : (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </>
  );
};

ProfilePage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
  user: PropTypes.object,
  guest: PropTypes.bool,
  showToast: PropTypes.func,
  setScreen: PropTypes.func,
  onUserUpdate: PropTypes.func,
};

export default ProfilePage;
