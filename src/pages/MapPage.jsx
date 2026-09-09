import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import HomeMap from '../components/HomeMap';
import { studentsApi } from '../utils/api';
import Loading from '../components/Loading';
import '../index.css';

/**
 * Map page — La Trobe commuter map (keyless Leaflet/OSM) plus the real list of
 * students with a home location, ranked for ride matching.
 */
const MapPage = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsApi.getAllLocations()
      .then((res) => setUsers(res.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🗺️ Commuter Map</h2>
      </div>

      <div className="card" style={{ padding: '0.5rem', marginBottom: '1rem' }}>
        <HomeMap height="50vh" />
      </div>

      {loading ? (
        <Loading text="Loading students..." />
      ) : (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📍 Students near campus ({users.length})</h3>
          {users.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#888' }}>No student locations available yet.</p>
          ) : users.map((u) => (
            <div key={u.id} className="menu-item">
              <span className="menu-icon">{u.rating >= 4.8 ? '⭐' : '👤'}</span>
              <span className="menu-text">{u.name}{u.address ? ` · ${u.address}` : ''}</span>
              <span className="menu-arrow">⭐ {Number(u.rating || 0).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

MapPage.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default MapPage;
